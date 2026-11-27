import test from "node:test";
import assert from "node:assert/strict";
import Store from "../model/Store.js";

// Stub the Store collection so no database is needed.
const rows = [
  { name: "Brides Berry", locCode: "00094", storeType: "branch", isActive: true },
  { name: "Warehouse", locCode: "858", storeType: "warehouse", isActive: true },
  { name: "Kochi", locCode: "00095", storeType: "branch", isActive: true },
];
Store.find = () => ({ lean: async () => rows });

const r = await import("../utils/storeResolver.js");
await r.refreshStores();

test("store names and codes come from the Store collection", () => {
  assert.equal(r.storeName("00094"), "Brides Berry");
  assert.equal(r.storeCode("Brides Berry"), "00094");
  assert.equal(r.storeCode("brides berry"), "00094");
  assert.equal(r.storeCode("BridesBerry"), "00094");
  assert.equal(r.storeCode("Kochi Branch"), "00095");
});

test("old hardcoded codes are no longer known", () => {
  assert.equal(r.storeCode("155"), null);
  assert.equal(r.findStore("155"), null);
});

test("unknown names are passed through unchanged (no prefix stripping)", () => {
  assert.equal(r.storeName("New Store"), "New Store");
  assert.equal(r.mapLocNameToWarehouse("Brides Berry"), "Brides Berry");
});

test("sameStore matches by code or name, never across stores", () => {
  assert.equal(r.sameStore("Brides Berry", "BridesBerry"), true);
  assert.equal(r.sameStore("00094", "brides berry"), true);
  assert.equal(r.sameStore("Brides Berry", "Kochi"), false);
  assert.equal(r.sameStore("Berry", "Brides Berry"), false);
  assert.equal(r.sameStore("", "Kochi"), false);
});

test("the warehouse is identified by storeType, not by a fixed code", () => {
  assert.equal(r.isWarehouseStore("858"), true);
  assert.equal(r.isWarehouseStore("Warehouse"), true);
  assert.equal(r.isWarehouseStore("00094"), false);
  assert.equal(r.warehouseName(), "Warehouse");
  assert.equal(r.mapLocNameToWarehouse(""), "Warehouse");
});
