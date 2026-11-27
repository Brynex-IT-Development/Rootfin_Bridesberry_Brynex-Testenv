import Store, { onStoreChange } from "../model/Store.js";

/**
 * Single source of truth for stores on the backend.
 *
 * Every store (name, locCode, type) comes from the Store collection — there are
 * no hardcoded store names or location codes anywhere else. Lookups are
 * synchronous against an in-memory cache so they can be used inside loops; the
 * cache is loaded at startup, refreshed after store changes, and re-read in the
 * background once it is older than CACHE_TTL_MS.
 */

const CACHE_TTL_MS = 60 * 1000;

let cache = [];
let loadedAt = 0;
let inflight = null;

/** Comparison key for a store name: case, spaces and punctuation ignored. */
export const storeKey = (value) => (value ?? "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

/** Same key with a trailing "branch" removed, so "Kochi Branch" == "Kochi". */
const baseKey = (value) => storeKey(value).replace(/branch$/, "");

export const refreshStores = async () => {
  if (inflight) return inflight;
  inflight = Store.find({}, { name: 1, locCode: 1, storeType: 1, isActive: 1 })
    .lean()
    .then((rows) => {
      cache = rows.map((s) => ({
        name: (s.name || "").toString().trim(),
        locCode: (s.locCode || "").toString().trim(),
        storeType: s.storeType || "branch",
        isActive: s.isActive !== false,
      }));
      loadedAt = Date.now();
      return cache;
    })
    .catch((err) => {
      console.warn("storeResolver: could not load stores:", err.message);
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

// Any write to the Store collection reloads the cache.
onStoreChange(() => {
  loadedAt = 0;
  refreshStores();
});

/** Awaitable: returns the store list, loading it if the cache is empty or stale. */
export const ensureStores = async () => {
  if (cache.length === 0 || Date.now() - loadedAt > CACHE_TTL_MS) await refreshStores();
  return cache;
};

/** Synchronous: current cached store list (kicks off a background refresh when stale). */
export const getStores = () => {
  if (Date.now() - loadedAt > CACHE_TTL_MS) refreshStores();
  return cache;
};

/** Finds a store by locCode, or by name (ignoring case/spacing and a "Branch" suffix). */
export const findStore = (nameOrCode) => {
  const raw = (nameOrCode ?? "").toString().trim();
  if (!raw) return null;
  const stores = getStores();
  const byCode = stores.find((s) => s.locCode === raw);
  if (byCode) return byCode;
  const key = storeKey(raw);
  const byName = stores.find((s) => storeKey(s.name) === key);
  if (byName) return byName;
  const base = baseKey(raw);
  return (base && stores.find((s) => baseKey(s.name) === base)) || null;
};

/** Canonical store name for a name or locCode; unknown values are returned trimmed. */
export const storeName = (nameOrCode) => {
  if (nameOrCode === undefined || nameOrCode === null) return null;
  const raw = nameOrCode.toString().trim();
  if (!raw) return null;
  return findStore(raw)?.name || raw;
};

/** locCode for a store name (or code), or null when there is no such store. */
export const storeCode = (nameOrCode) => findStore(nameOrCode)?.locCode || null;

/** True when two names/codes refer to the same store. */
export const sameStore = (a, b) => {
  const ra = (a ?? "").toString().trim();
  const rb = (b ?? "").toString().trim();
  if (!ra || !rb) return false;
  const sa = findStore(ra);
  const sb = findStore(rb);
  if (sa && sb) return sa.locCode === sb.locCode;
  const ka = baseKey(storeName(ra));
  const kb = baseKey(storeName(rb));
  return Boolean(ka) && ka === kb;
};

/** The central warehouse store (Store.storeType === "warehouse"), if one exists. */
export const warehouseStore = () =>
  getStores().find((s) => s.storeType === "warehouse" && s.isActive) ||
  getStores().find((s) => s.storeType === "warehouse") ||
  null;

/** Name of the central warehouse store, or "" when none is configured. */
export const warehouseName = () => warehouseStore()?.name || "";

/** True when the name/locCode belongs to a warehouse-type store. */
export const isWarehouseStore = (nameOrCode) => findStore(nameOrCode)?.storeType === "warehouse";

/**
 * Maps a login/location name (or locCode) to the store name used on stock records.
 * Empty input falls back to the central warehouse store.
 */
export const mapLocNameToWarehouse = (locName) => storeName(locName) || warehouseName();
