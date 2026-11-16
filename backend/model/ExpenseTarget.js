import mongoose from "mongoose";

const expenseTargetSchema = new mongoose.Schema(
  {
    storeCode: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, lowercase: true },
    subCategory: { type: String, default: "", trim: true },
    targetAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

expenseTargetSchema.index(
  { storeCode: 1, category: 1, subCategory: 1 },
  { unique: true }
);

export default mongoose.model("ExpenseTarget", expenseTargetSchema);
