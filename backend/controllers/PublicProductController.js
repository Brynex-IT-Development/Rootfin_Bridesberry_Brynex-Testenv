// backend/controllers/PublicProductController.js
// Read-only product feed for external storefronts. Exposes only the fields
// an e-commerce site needs; never returns costs, vendors, or internal ids.
import ShoeItem from "../model/ShoeItem.js";
import ItemGroup from "../model/ItemGroup.js";
import { config, availableIn, hasWarehouseRecord } from "./PublicOrderController.js";

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Shape one product. Stock is the sellable quantity in the web warehouse only.
const shapeProduct = ({ sku, name, sellingPrice, mrp, hsnCode, unit, isActive, warehouseStocks }) => ({
  sku: (sku || "").toString().trim(),
  name,
  sellingPrice: toNumber(sellingPrice),
  mrp: toNumber(mrp),
  hsnCode: (hsnCode || "").toString().trim(),
  status: isActive === false ? "inactive" : "active",
  stock: availableIn(warehouseStocks, config().warehouse),
  unit: (unit || "").toString().trim(),
});

// Build the flat list: standalone items plus every variant inside a group.
// Only products stocked in the web warehouse are included.
// Variants inherit the group's unit and active status.
export const loadPublicProducts = async () => {
  const warehouse = config().warehouse;
  const [items, groups] = await Promise.all([
    ShoeItem.find({}).lean(),
    ItemGroup.find({}).lean(),
  ]);

  const products = items
    .filter((i) => i.sku && hasWarehouseRecord(i.warehouseStocks, warehouse))
    .map((i) => shapeProduct({
      sku: i.sku,
      name: i.itemName,
      sellingPrice: i.sellingPrice,
      mrp: i.mrp,
      hsnCode: i.hsnCode,
      unit: i.unit,
      isActive: i.isActive,
      warehouseStocks: i.warehouseStocks,
    }));

  for (const g of groups) {
    for (const v of g.items || []) {
      if (!v.sku || !hasWarehouseRecord(v.warehouseStocks, warehouse)) continue;
      products.push(shapeProduct({
        sku: v.sku,
        name: v.name ? `${g.name} - ${v.name}` : g.name,
        sellingPrice: v.sellingPrice,
        mrp: v.mrp,
        hsnCode: v.hsnCode || g.hsnCode,
        unit: g.unit,
        isActive: g.isActive === false ? false : v.isActive,
        warehouseStocks: v.warehouseStocks,
      }));
    }
  }

  return products;
};

// GET /api/public/products
// Optional query: ?status=active|inactive
export const getPublicProducts = async (req, res) => {
  try {
    let products = await loadPublicProducts();
    const status = (req.query.status || "").toString().toLowerCase();
    if (status === "active" || status === "inactive") {
      products = products.filter((p) => p.status === status);
    }
    res.json({ count: products.length, products });
  } catch (err) {
    console.error("Public products list failed:", err);
    res.status(500).json({ message: "Failed to load products" });
  }
};

// GET /api/public/products/:sku
export const getPublicProductBySku = async (req, res) => {
  try {
    const wanted = (req.params.sku || "").toString().trim().toLowerCase();
    const products = await loadPublicProducts();
    const product = products.find((p) => p.sku.toLowerCase() === wanted);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("Public product lookup failed:", err);
    res.status(500).json({ message: "Failed to load product" });
  }
};
