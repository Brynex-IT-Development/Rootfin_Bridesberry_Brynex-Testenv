import express from "express";
import {
  getAllExpenseTargets,
  getExpenseTarget,
  upsertExpenseTarget,
} from "../controllers/ExpenseTargetController.js";

const router = express.Router();

router.get("/all", getAllExpenseTargets);
router.get("/", getExpenseTarget);
router.post("/", upsertExpenseTarget);

export default router;
