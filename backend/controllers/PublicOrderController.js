// backend/controllers/PublicOrderController.js
// Accepts paid orders from the external storefront (payment taken via PhonePe).
// Each order becomes a SalesInvoice, reduces stock in the single warehouse,
// and posts the same financial transaction a POS sale would.
import ShoeItem from "../model/ShoeItem.js";
import ItemGroup from "../model/ItemGroup.js";
import SalesInvoice from "../model/SalesInvoice.js";
import { nextGlobalSalesInvoice } from "../utils/nextSalesInvoice.js";
import { updateStockOnInvoiceCreate, reverseStockOnInvoiceDelete } from "../utils/ultraEnhancedStockManagement.js";
import { createFinancialTransaction } from "./SalesInvoiceController.js";
import { ensureStores, findStore, sameStore } from "../utils/storeResolver.js";

// Web store settings. The storefront sells from the store whose location code is
// WEB_STORE_LOC_CODE; its name comes from the backend Store collection (no
// hardcoded store names/codes).
export const config = () => {
  const locCode = (process.env.WEB_STORE_LOC_CODE || "").toString().trim();
  const store = locCode ? findStore(locCode) : null;
  const name = store?.name || "";
  return {
    warehouse: name,             // stock is deducted from and shown for this store
    branch: name,                // web branch on the invoice
    locCode: store ? locCode : "", // location code used for the financial transaction
    userId: "store front",       // user recorded on the invoice
    category: "Sales",
    subCategory: "Online",
  };
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Look up a SKU in standalone items first, then inside item groups.
const findBySku = async (sku) => {
  const rx = new RegExp(`^${escapeRegex(sku.trim())}$`, "i");

  const shoe = await ShoeItem.findOne({ sku: rx }).lean();
  if (shoe) {
    return {
      standalone: true,
      itemGroupId: null,
      itemId: String(shoe._id),
      itemName: shoe.itemName,
      displayName: shoe.itemName,
      sku: shoe.sku.trim(),
      rate: Number(shoe.sellingPrice) || 0,
      size: shoe.size || "",
      isActive: shoe.isActive !== false,
      warehouseStocks: shoe.warehouseStocks || [],
    };
  }

  const group = await ItemGroup.findOne({ "items.sku": rx }).lean();
  if (!group) return null;
  const variant = (group.items || []).find((v) => v.sku && rx.test(v.sku.trim()));
  if (!variant) return null;

  return {
    standalone: false,
    itemGroupId: String(group._id),
    itemId: String(variant._id),
    itemName: variant.name,
    displayName: group.name ? `${group.name} - ${variant.name}` : variant.name,
    sku: variant.sku.trim(),
    rate: Number(variant.sellingPrice) || 0,
    size: variant.size || "",
    isActive: group.isActive !== false && variant.isActive !== false,
    warehouseStocks: variant.warehouseStocks || [],
  };
};

// Sellable quantity in the given warehouse (availableForSale, else stockOnHand).
const findWarehouseStock = (warehouseStocks, warehouse) => {
  if (!warehouse) return undefined;
  return (warehouseStocks || []).find((s) => sameStore(s.warehouse, warehouse));
};

// True when the item has a stock record for this warehouse.
export const hasWarehouseRecord = (warehouseStocks, warehouse) =>
  Boolean(findWarehouseStock(warehouseStocks, warehouse));

export const availableIn = (warehouseStocks, warehouse) => {
  const ws = findWarehouseStock(warehouseStocks, warehouse);
  if (!ws) return 0;
  const raw = ws.availableForSale != null && ws.availableForSale !== ""
    ? Number(ws.availableForSale)
    : Number(ws.stockOnHand);
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
};

const buildLine = (found, qty, rate) => ({
  item: found.displayName,
  itemData: {
    _id: found.itemId,
    itemName: found.itemName,
    itemGroupId: found.itemGroupId,
    sku: found.sku,
    isFromGroup: !found.standalone,
  },
  itemGroupId: found.itemGroupId,
  itemSku: found.sku,
  size: found.size,
  quantity: qty,
  rate,
  tax: "",
  amount: Math.round(rate * qty * 100) / 100,
});

const orderSummary = (invoice) => ({
  orderRef: invoice.orderNumber,
  invoiceNumber: invoice.invoiceNumber,
  status: invoice.status,
  finalTotal: invoice.finalTotal,
  items: invoice.lineItems.map((l) => ({
    sku: l.itemSku,
    name: l.item,
    quantity: l.quantity,
    rate: l.rate,
    amount: l.amount,
  })),
});

// POST /api/public/orders
// Body: { orderRef, customer, customerPhone?, paymentReference, items: [{ sku, quantity }] }
export const createPublicOrder = async (req, res) => {
  await ensureStores();
  const cfg = config();
  if (!cfg.warehouse) {
    return res.status(503).json({ message: "Web store is not configured: set WEB_STORE_LOC_CODE to an existing store's location code." });
  }
  const { orderRef, customer, customerPhone = "", paymentReference = "", items } = req.body || {};

  if (typeof orderRef !== "string" || !orderRef.trim()) {
    return res.status(400).json({ message: "orderRef is required" });
  }
  if (typeof customer !== "string" || !customer.trim()) {
    return res.status(400).json({ message: "customer is required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items must be a non-empty array" });
  }

  // Validate and merge duplicate SKUs.
  const requested = new Map();
  for (const it of items) {
    const sku = (it?.sku || "").toString().trim();
    const qty = Number(it?.quantity);
    if (!sku || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: "Each item needs a sku and a positive whole quantity" });
    }
    const key = sku.toLowerCase();
    const prev = requested.get(key);
    requested.set(key, { sku, qty: (prev?.qty || 0) + qty });
  }

  try {
    // Idempotency: a retried order returns the one already created.
    const existing = await SalesInvoice.findOne({ orderNumber: orderRef.trim() }).lean();
    if (existing) {
      return res.status(200).json({ ...orderSummary(existing), duplicate: true });
    }

    // Check every line before touching stock.
    const problems = [];
    const lines = [];
    for (const { sku, qty } of requested.values()) {
      const found = await findBySku(sku);
      if (!found) {
        problems.push({ sku, reason: "not found" });
        continue;
      }
      if (!found.isActive) {
        problems.push({ sku, reason: "inactive" });
        continue;
      }
      const available = availableIn(found.warehouseStocks, cfg.warehouse);
      if (available < qty) {
        problems.push({ sku, reason: "insufficient stock", available, requested: qty });
        continue;
      }
      lines.push({ found, qty });
    }
    if (problems.length) {
      return res.status(409).json({ message: "Some items cannot be ordered", problems });
    }

    // Deduct stock one line at a time. If any line fails, put back the lines already taken.
    const applied = [];
    const rollback = async () => {
      for (const l of applied) {
        try {
          await reverseStockOnInvoiceDelete([l], cfg.warehouse);
        } catch (err) {
          console.error("Rollback failed for line:", l.itemSku, err);
        }
      }
    };

    const lineItems = [];
    for (const { found, qty } of lines) {
      const line = buildLine(found, qty, found.rate);
      let report;
      try {
        report = await updateStockOnInvoiceCreate([line], cfg.warehouse);
      } catch (err) {
        report = { failed: 1, error: err.message };
      }
      if (report?.failed > 0) {
        await rollback();
        return res.status(409).json({
          message: `Stock could not be reserved for ${found.sku}`,
          problems: [{ sku: found.sku, reason: report.error || report.failures?.[0]?.reason || "stock update failed" }],
        });
      }
      applied.push(line);
      lineItems.push(line);
    }

    // Save the sales invoice, mirroring a POS sale paid by UPI.
    const subTotal = Math.round(lineItems.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    let invoice;
    try {
      const invoiceNumber = await nextGlobalSalesInvoice("INV-");
      invoice = await SalesInvoice.create({
        invoiceNumber,
        invoiceDate: new Date(),
        customer: customer.trim(),
        customerPhone: customerPhone.toString().trim(),
        branch: cfg.branch,
        orderNumber: orderRef.trim(),
        terms: "Due on Receipt",
        warehouse: cfg.warehouse,
        category: cfg.category,
        subCategory: cfg.subCategory,
        remark: 0,
        paymentMethod: "UPI",
        isSplitPayment: false,
        lineItems,
        customerNotes: "Thanks for your business.",
        subTotal,
        discountAmount: 0,
        totalTax: 0,
        tdsTcsAmount: 0,
        adjustmentAmount: 0,
        finalTotal: subTotal,
        status: "paid",
        userId: cfg.userId,
        locCode: cfg.locCode,
        notes: paymentReference ? `Web order. PhonePe reference: ${paymentReference}` : "Web order",
      });
    } catch (err) {
      await rollback();
      throw err;
    }

    // Post the financial transaction. A failure here is reported but does not undo the order.
    let financialPosted = true;
    try {
      await createFinancialTransaction(invoice);
    } catch (err) {
      financialPosted = false;
      console.error(`Financial transaction failed for ${invoice.invoiceNumber}:`, err);
    }

    return res.status(201).json({ ...orderSummary(invoice), financialPosted });
  } catch (err) {
    console.error("Public order failed:", err);
    res.status(500).json({ message: "Failed to create order" });
  }
};
