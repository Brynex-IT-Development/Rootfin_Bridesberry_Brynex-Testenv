import ExpenseTarget from "../model/ExpenseTarget.js";

const cleanTargetKey = (value = "") => String(value).trim();

export const upsertExpenseTarget = async (req, res) => {
  try {
    const storeCode = cleanTargetKey(req.body.storeCode);
    const category = cleanTargetKey(req.body.category).toLowerCase();
    const subCategory = cleanTargetKey(req.body.subCategory);
    const rawTargetAmount = req.body.targetAmount;
    const targetAmount = Number(rawTargetAmount);

    if (
      !storeCode || !category || (typeof rawTargetAmount === "string" && !rawTargetAmount.trim()) || rawTargetAmount === null ||
      rawTargetAmount === undefined || !Number.isFinite(targetAmount) || targetAmount < 0
    ) {
      return res.status(400).json({
        message: "storeCode, category, and a non-negative targetAmount are required",
      });
    }

    const target = await ExpenseTarget.findOneAndUpdate(
      { storeCode, category, subCategory },
      { $set: { targetAmount } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, data: target });
  } catch (error) {
    console.error("upsertExpenseTarget error:", error);
    return res.status(500).json({ message: "Unable to save expense limit", error: error.message });
  }
};

export const getExpenseTarget = async (req, res) => {
  try {
    const storeCode = cleanTargetKey(req.query.storeCode);
    const category = cleanTargetKey(req.query.category).toLowerCase();
    const subCategory = cleanTargetKey(req.query.subCategory);

    if (!storeCode || !category) {
      return res.status(400).json({ message: "storeCode and category are required" });
    }

    const target = await ExpenseTarget.findOne({ storeCode, category, subCategory }).lean();
    return res.json({ success: true, data: target });
  } catch (error) {
    console.error("getExpenseTarget error:", error);
    return res.status(500).json({ message: "Unable to load expense limit", error: error.message });
  }
};

export const getAllExpenseTargets = async (req, res) => {
  try {
    const query = {};
    const storeCode = cleanTargetKey(req.query.storeCode);
    const category = cleanTargetKey(req.query.category).toLowerCase();

    if (storeCode && storeCode !== "all") query.storeCode = storeCode;
    if (category && category !== "all") query.category = category;

    const targets = await ExpenseTarget.find(query).sort({ storeCode: 1, category: 1, subCategory: 1 }).lean();
    return res.json({ success: true, data: targets });
  } catch (error) {
    console.error("getAllExpenseTargets error:", error);
    return res.status(500).json({ message: "Unable to load expense limits", error: error.message });
  }
};
