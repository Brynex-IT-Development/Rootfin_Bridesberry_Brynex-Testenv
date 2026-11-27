import { findStore, getWarehouseStore } from "./storeService";

/**
 * Maps a login/location name (or locCode) to the store name used on stock records.
 * Stores come only from the backend store list — no hardcoded names or codes.
 * Unknown names are returned unchanged.
 */
export const mapLocNameToWarehouse = (locName) => {
  const raw = (locName || "").toString().trim();
  if (!raw) return "";
  return findStore(raw)?.locName || raw;
};

/** Name of the central warehouse store from the backend ("" when none). */
export const getWarehouseName = () => getWarehouseStore()?.locName || "";
