// backend/route/PublicProductRoutes.js
import express from "express";
import cors from "cors";
import { getPublicProducts, getPublicProductBySku } from "../controllers/PublicProductController.js";
import { createPublicOrder } from "../controllers/PublicOrderController.js";

const router = express.Router();

// Open CORS so an external storefront can call these from the browser.
// Credentials are never sent.
router.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));

// Optional API key for the product feed. Set PUBLIC_API_KEY to require the
// header "x-api-key" on every request. If unset, the feed is open.
router.use((req, res, next) => {
  const required = process.env.PUBLIC_API_KEY;
  if (!required) return next();
  if (req.headers["x-api-key"] !== required) {
    return res.status(401).json({ message: "Invalid or missing API key" });
  }
  next();
});

// Orders change stock and books money, so they always need the key.
const requireOrderKey = (req, res, next) => {
  const required = process.env.PUBLIC_API_KEY;
  if (!required) {
    return res.status(503).json({ message: "Order API is not configured (PUBLIC_API_KEY missing)" });
  }
  if (req.headers["x-api-key"] !== required) {
    return res.status(401).json({ message: "Invalid or missing API key" });
  }
  next();
};

router.get("/products", getPublicProducts);
router.get("/products/:sku", getPublicProductBySku);
router.post("/orders", requireOrderKey, createPublicOrder);

export default router;
