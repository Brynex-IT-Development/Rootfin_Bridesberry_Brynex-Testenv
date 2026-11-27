import test from "node:test";
import assert from "node:assert/strict";
import Transaction from "../model/Transaction.js";
import CloseTransaction from "../model/Closing.js";
import { hasDaybookActivity, locCodesWithDaybookActivity } from "../utils/daybookActivity.js";

// Stub the model queries with an in-memory list so no database is needed.
const rows = { txn: [], close: [] };
const matches = (row, filter) => {
    const codeOk = filter.locCode.$in ? filter.locCode.$in.includes(row.locCode) : row.locCode === filter.locCode;
    return codeOk && row.date < filter.date.$lt;
};
Transaction.exists = async (f) => rows.txn.some((r) => matches(r, f)) || null;
CloseTransaction.exists = async (f) => rows.close.some((r) => matches(r, f)) || null;
Transaction.distinct = async (_k, f) => rows.txn.filter((r) => matches(r, f)).map((r) => r.locCode);
CloseTransaction.distinct = async (_k, f) => rows.close.filter((r) => matches(r, f)).map((r) => r.locCode);

test("a brand-new store with no history owes no closing for yesterday", async () => {
    rows.txn = []; rows.close = [];
    assert.equal(await hasDaybookActivity("900", "2026-11-26"), false);
});

test("activity on or before the date means the closing is owed", async () => {
    rows.txn = [{ locCode: "900", date: new Date("2026-11-26T10:00:00Z") }]; rows.close = [];
    assert.equal(await hasDaybookActivity("900", "2026-11-26"), true);
    rows.txn = []; rows.close = [{ locCode: "900", date: new Date("2026-11-20T00:00:00Z") }];
    assert.equal(await hasDaybookActivity("900", "2026-11-26"), true);
});

test("activity only after the date (e.g. today) does not make yesterday owed", async () => {
    rows.txn = [{ locCode: "900", date: new Date("2026-11-27T05:00:00Z") }]; rows.close = [];
    assert.equal(await hasDaybookActivity("900", "2026-11-26"), false);
});

test("batch check returns only locations with history", async () => {
    rows.txn = [{ locCode: "155", date: new Date("2026-11-25T00:00:00Z") }];
    rows.close = [{ locCode: "858", date: new Date("2026-11-26T00:00:00Z") }];
    const owing = await locCodesWithDaybookActivity(["155", "858", "900"], "2026-11-26");
    assert.deepEqual([...owing].sort(), ["155", "858"]);
});
