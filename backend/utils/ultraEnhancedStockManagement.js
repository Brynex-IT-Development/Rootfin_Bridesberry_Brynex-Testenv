// Sales stock management — reduces stock on sale and restores it on return/delete.
//
// Every change is applied with a single atomic MongoDB `$inc`, so concurrent
// sales (two stores selling sizes of the same item group at the same moment)
// can never overwrite each other. The same item/warehouse matching is used for
// deduction and reversal so a sale and its reversal always net to zero.
import ShoeItem from "../model/ShoeItem.js";
import ItemGroup from "../model/ItemGroup.js";
import { checkAndCreateReorderAlerts } from "./reorderNotification.js";
import { ensureStores, findStore, sameStore, storeName } from "./storeResolver.js";
import { updateMonthlyStockForSale } from "./monthlyStockTracking.js";

const STOCK_FIELDS = ["stockOnHand", "availableForSale", "physicalStockOnHand", "physicalAvailableForSale"];

const norm = (v) => (v ?? "").toString().toLowerCase().trim();

const findWarehouseIndex = (warehouseStocks, warehouse) =>
  Array.isArray(warehouseStocks)
    ? warehouseStocks.findIndex((ws) => ws?.warehouse && sameStore(ws.warehouse, warehouse))
    : -1;

/**
 * Locate a line item inside its group. Exact matches only (id, SKU, item code,
 * full name) — partial name matching could silently reduce the wrong size.
 */
const findGroupItemIndex = (group, lineItem) => {
  const items = Array.isArray(group?.items) ? group.items : [];
  const data = lineItem.itemData || {};
  const id = (data._id || data.id || "").toString();
  if (id) {
    const i = items.findIndex((gi) => gi._id?.toString() === id);
    if (i !== -1) return i;
  }
  const skus = [data.sku, lineItem.itemSku, lineItem.itemCode].map(norm).filter(Boolean);
  for (const sku of skus) {
    const i = items.findIndex((gi) => norm(gi.sku) === sku || norm(gi.itemCode) === sku);
    if (i !== -1) return i;
  }
  const names = [data.itemName, data.name, lineItem.item].map(norm).filter(Boolean);
  for (const name of names) {
    const i = items.findIndex((gi) => norm(gi.name) === name);
    if (i !== -1) return i;
  }
  return -1;
};

const buildInc = (prefix, delta) =>
  Object.fromEntries(STOCK_FIELDS.map((f) => [`${prefix}${f}`, delta]));

const newWarehouseEntry = (warehouse, delta) => ({
  warehouse: storeName(warehouse) || warehouse,
  ...Object.fromEntries(STOCK_FIELDS.map((f) => [f, delta])),
});

/**
 * Apply a signed quantity change (negative = sale, positive = return) to one line item.
 * A deduction is only applied if enough stock is on hand at that moment (checked
 * atomically) — stock never goes below zero.
 * Returns { ok, reason, available }.
 */
const applyLineItemDelta = async (lineItem, warehouse, delta) => {
  const groupId = lineItem.itemData?.itemGroupId || lineItem.itemGroupId;
  const isDeduction = delta < 0;
  const need = -delta;
  const storeLabel = storeName(warehouse) || warehouse;
  // Only create a missing warehouse entry (for returns) for a real store, never a fallback name.
  const canCreateEntry = !isDeduction && Boolean(findStore(warehouse));
  const insufficient = (name, available) => ({
    ok: false,
    available: Math.max(0, available || 0),
    reason: `Not enough stock for "${name}" at ${storeLabel}: ${Math.max(0, available || 0)} available, ${need} needed`,
  });

  if (groupId) {
    const group = await ItemGroup.findById(groupId).select("name items._id items.name items.sku items.itemCode items.warehouseStocks._id items.warehouseStocks.warehouse items.warehouseStocks.stockOnHand").lean();
    if (!group) return { ok: false, reason: `Item group not found: ${groupId}` };

    const itemIndex = findGroupItemIndex(group, lineItem);
    if (itemIndex === -1) return { ok: false, reason: `Item not found in group "${group.name}"` };

    const groupItem = group.items[itemIndex];
    const wsIndex = findWarehouseIndex(groupItem.warehouseStocks, warehouse);

    if (wsIndex !== -1) {
      const ws = groupItem.warehouseStocks[wsIndex];
      // The stock condition lives in the query filter: timestamps always bump
      // updatedAt, so modifiedCount can't tell us whether stock actually changed.
      const wsMatch = isDeduction ? { _id: ws._id, stockOnHand: { $gte: need } } : { _id: ws._id };
      const res = await ItemGroup.updateOne(
        { _id: groupId, items: { $elemMatch: { _id: groupItem._id, warehouseStocks: { $elemMatch: wsMatch } } } },
        { $inc: buildInc("items.$[it].warehouseStocks.$[ws].", delta) },
        { arrayFilters: [{ "it._id": groupItem._id }, { "ws._id": ws._id }] }
      );
      if (!res.matchedCount) {
        if (!isDeduction) return { ok: false, reason: "Stock entry changed during update" };
        const fresh = await ItemGroup.findById(groupId).select("items._id items.warehouseStocks._id items.warehouseStocks.stockOnHand").lean();
        const fws = fresh?.items?.find((it) => it._id.equals(groupItem._id))?.warehouseStocks?.find((w) => w._id.equals(ws._id));
        return insufficient(groupItem.name, fws?.stockOnHand);
      }
    } else if (isDeduction) {
      return insufficient(groupItem.name, 0);
    } else if (canCreateEntry) {
      await ItemGroup.updateOne(
        { _id: groupId },
        { $push: { "items.$[it].warehouseStocks": newWarehouseEntry(warehouse, delta) } },
        { arrayFilters: [{ "it._id": groupItem._id }] }
      );
    } else {
      return { ok: false, reason: `Warehouse "${warehouse}" not found for item` };
    }

    if (isDeduction) {
      await updateMonthlyStockForSale(groupId, groupItem._id.toString(), warehouse, need, groupItem.name);
    }
    return { ok: true };
  }

  const itemId = lineItem.itemData?._id;
  if (!itemId) return { ok: false, reason: "No itemData._id for standalone item" };

  const shoeItem = await ShoeItem.findById(itemId).select("itemName warehouseStocks._id warehouseStocks.warehouse warehouseStocks.stockOnHand").lean();
  if (!shoeItem) return { ok: false, reason: `Standalone item not found: ${itemId}` };

  const wsIndex = findWarehouseIndex(shoeItem.warehouseStocks, warehouse);
  if (wsIndex !== -1) {
    const ws = shoeItem.warehouseStocks[wsIndex];
    const res = await ShoeItem.updateOne(
      { _id: itemId, warehouseStocks: { $elemMatch: isDeduction ? { _id: ws._id, stockOnHand: { $gte: need } } : { _id: ws._id } } },
      { $inc: buildInc("warehouseStocks.$.", delta) }
    );
    if (!res.matchedCount) {
      if (!isDeduction) return { ok: false, reason: "Stock entry changed during update" };
      const fresh = await ShoeItem.findById(itemId).select("warehouseStocks._id warehouseStocks.stockOnHand").lean();
      return insufficient(shoeItem.itemName, fresh?.warehouseStocks?.find((w) => w._id.equals(ws._id))?.stockOnHand);
    }
  } else if (isDeduction) {
    return insufficient(shoeItem.itemName, 0);
  } else if (canCreateEntry) {
    await ShoeItem.updateOne({ _id: itemId }, { $push: { warehouseStocks: newWarehouseEntry(warehouse, delta) } });
  } else {
    return { ok: false, reason: `Warehouse "${warehouse}" not found for item` };
  }
  return { ok: true };
};

/**
 * Apply stock changes for all line items. sign = -1 for a sale, +1 for a return/reversal.
 * With { allOrNothing: true } the first failure undoes the lines already applied and stops.
 */
const applyInvoiceStock = async (lineItems, warehouse, sign, { allOrNothing = false } = {}) => {
  const results = { ok: true, totalItems: 0, successful: 0, failed: 0, failures: [] };
  if (!Array.isArray(lineItems) || lineItems.length === 0) return results;

  await ensureStores();
  const applied = [];

  for (const lineItem of lineItems) {
    const itemCode = lineItem.itemCode || lineItem.item || lineItem.itemData?.sku || "Unknown";
    const quantity = parseFloat(lineItem.quantity) || 0;
    if (quantity <= 0) continue;
    results.totalItems++;

    let outcome;
    try {
      outcome = await applyLineItemDelta(lineItem, warehouse, sign * quantity);
    } catch (error) {
      outcome = { ok: false, reason: error.message };
    }

    if (outcome.ok) {
      results.successful++;
      applied.push(lineItem);
      continue;
    }

    results.ok = false;
    results.failed++;
    results.failures.push({ itemCode, quantity, reason: outcome.reason, available: outcome.available });

    if (allOrNothing) {
      for (const done of applied) {
        try {
          await applyLineItemDelta(done, warehouse, -sign * (parseFloat(done.quantity) || 0));
        } catch (error) {
          console.error("Stock rollback failed for", done.item, error);
        }
      }
      results.successful = 0;
      break;
    }
  }

  if (results.failures.length > 0) {
    console.warn(`⚠️ Stock ${sign < 0 ? "deduction" : "reversal"} at "${warehouse}" failed:`, results.failures);
  }
  return results;
};

/** Human-readable message for a failed stock operation. */
export const stockFailureMessage = (results) =>
  (results?.failures || []).map((f) => f.reason).join("\n") || "Stock could not be updated";

/**
 * Reduce stock for a sale. All-or-nothing: if any line lacks stock, nothing is
 * deducted and { ok: false, failures } is returned. Stock never goes below zero.
 */
export const updateStockOnInvoiceCreate = async (lineItems, warehouse) => {
  const results = await applyInvoiceStock(lineItems, warehouse, -1, { allOrNothing: true });
  if (results.ok) {
    try {
      await checkAndCreateReorderAlerts(lineItems, warehouse);
    } catch (error) {
      console.error("Error checking reorder points:", error);
    }
  }
  return results;
};

/** Restore stock for a return, or when a sale is deleted. */
export const reverseStockOnInvoiceDelete = (lineItems, warehouse) => applyInvoiceStock(lineItems, warehouse, +1);

/**
 * Re-sync stock after an invoice is edited. All-or-nothing: if the edit needs more
 * stock than is available, every change is undone and { ok: false, failures } is
 * returned so the edit can be rejected. `isReturn` flips the direction.
 */
export const adjustStockOnInvoiceEdit = async ({ oldLineItems = [], oldWarehouse, newLineItems = [], newWarehouse, isReturn }) => {
  const sign = isReturn ? 1 : -1;

  // Work out what to put back (restore) and what to take (deduct), per store.
  let restore;
  let deduct;
  if (!sameStore(oldWarehouse, newWarehouse) && norm(oldWarehouse) !== norm(newWarehouse)) {
    restore = { items: oldLineItems, warehouse: oldWarehouse };
    deduct = { items: newLineItems, warehouse: newWarehouse };
  } else {
    const keyOf = (li) => [
      li.itemData?.itemGroupId || li.itemGroupId || "",
      li.itemData?._id || li.itemData?.sku || li.itemSku || li.item || "",
    ].map((v) => v.toString()).join("|");
    const net = new Map();
    const add = (li, factor) => {
      const k = keyOf(li);
      const entry = net.get(k) || { lineItem: li, qty: 0 };
      entry.qty += factor * (parseFloat(li.quantity) || 0);
      if (factor > 0) entry.lineItem = li;
      net.set(k, entry);
    };
    oldLineItems.forEach((li) => add(li, -1));
    newLineItems.forEach((li) => add(li, +1));
    const increased = [];
    const decreased = [];
    for (const { lineItem, qty } of net.values()) {
      if (qty > 0) increased.push({ ...lineItem, quantity: qty });
      else if (qty < 0) decreased.push({ ...lineItem, quantity: -qty });
    }
    restore = { items: decreased, warehouse: newWarehouse };
    deduct = { items: increased, warehouse: newWarehouse };
  }

  // For a sale, "restore" adds stock and "deduct" removes it; for a return it's the opposite.
  const first = await applyInvoiceStock(restore.items, restore.warehouse, -sign, { allOrNothing: true });
  if (!first.ok) return first;
  const second = await applyInvoiceStock(deduct.items, deduct.warehouse, sign, { allOrNothing: true });
  if (!second.ok) {
    await applyInvoiceStock(restore.items, restore.warehouse, sign); // undo the first step
    return second;
  }
  return { ok: true };
};
