// backend/cont/TransactionController.js
import Transaction from "../model/Transaction.js";
import CloseTransaction from "../model/Closing.js";
import { propagateCashDiff } from "../utils/cashPropagation.js";
import {
  clearCachePattern,
  generateCacheKey,
  getCachedData,
  setCachedData,
} from "../utils/cacheManager.js";

// Optimized function to get transactions with caching and better queries
export const getOptimizedTransactions = async (req, res) => {
  const { DateFrom, DateTo, category, type } = req.query;
  const locCode = req.query.locCode ?? req.query.LocCode;
  
  try {
    // Generate cache key
    const cacheKey = generateCacheKey('transactions', { locCode, DateFrom, DateTo, category, type });
    
    // Check cache first
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Build optimized query with indexes
    if (!DateFrom || !DateTo) {
      return res.status(400).json({ message: "Both 'DateFrom' and 'DateTo' are required" });
    }

    const fromDate = new Date(DateFrom);
    const toDate = new Date(DateTo);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);

    const query = { date: { $gte: fromDate, $lte: toDate } };
    if (locCode && locCode !== "all") query.locCode = String(locCode);

    // Add optional filters
    if (category && category !== 'all') {
      query.category = category;
    }
    if (type && type !== 'all') {
      query.type = { $regex: `^${String(type).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
    }

    // Use aggregation pipeline for better performance
    const pipeline = [
      { $match: query },
      {
        $addFields: {
          // Ensure numeric fields for calculations
          cashNum: { $convert: { input: "$cash", to: "double", onError: 0, onNull: 0 } },
          rblNum: { $convert: { input: "$rbl", to: "double", onError: 0, onNull: 0 } },
          bankNum: { $convert: { input: "$bank", to: "double", onError: 0, onNull: 0 } },
          upiNum: { $convert: { input: "$upi", to: "double", onError: 0, onNull: 0 } }
        }
      },
      {
        $addFields: {
          totalTransaction: { $add: ["$cashNum", "$rblNum", "$bankNum", "$upiNum"] }
        }
      },
      { $sort: { date: -1, createdAt: -1 } },
      {
        $addFields: {
          hasAttachment: {
            $gt: [{ $ifNull: ["$attachment.data", null] }, null]
          },
          attachmentFilename: "$attachment.filename"
        }
      },
      { $project: { attachment: 0 } }
    ];

    const transactions = await Transaction.aggregate(pipeline);

    // Calculate totals efficiently
    const totals = transactions.reduce((acc, tx) => ({
      cash: acc.cash + (tx.cashNum || 0),
      rbl: acc.rbl + (tx.rblNum || 0),
      bank: acc.bank + (tx.bankNum || 0),
      upi: acc.upi + (tx.upiNum || 0),
      total: acc.total + (tx.totalTransaction || 0)
    }), { cash: 0, rbl: 0, bank: 0, upi: 0, total: 0 });

    const result = {
      success: true,
      data: transactions,
      totals,
      count: transactions.length,
      filters: { locCode, DateFrom, DateTo, category, type }
    };

    // Cache for 5 minutes
    setCachedData(cacheKey, result, 300);

    res.json(result);

  } catch (error) {
    console.error('Error in getOptimizedTransactions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
import { nextInvoice } from "../utlis/nextInvoice.js";
import parseBase64  from "../utlis/parseBase64.js";  
// CommonJS style



export const CreatePayment = async (req, res) => {
  try {
    const {
      type,
      category,
      subCategory,
      expenseType,
      entryType,
      remark,
      amount,
      cash,
      rbl,
      bank,
      upi,
      paymentMethod,
      bankAccount,
      locCode,
      isAdminLevel,
      quantity,
      date,
      invoiceNo,        // may be omitted
      isSecurityReturn,
      attachment        // 🔺 ADDED  (base-64 string from React)
    } = req.body;

    /* ───────── basic validation ───────── */
    const normalizedType = String(type || "").trim();
    const normalizedPaymentMethod = String(paymentMethod || "").toLowerCase().trim();
    const numericAmount = Number(amount);
    const isExpense = normalizedType.toLowerCase() === "expense";

    if (
      !normalizedType || !String(category || "").trim() || !Number.isFinite(numericAmount) || numericAmount === 0 ||
      cash === undefined || bank === undefined || upi === undefined ||
      !["cash", "bank", "upi", "split"].includes(normalizedPaymentMethod) || !date || !String(locCode || "").trim()
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (Number.isNaN(new Date(date).getTime())) {
      return res.status(400).json({ message: "Invalid transaction date" });
    }

    if (isExpense && !attachment) {
      return res.status(400).json({ message: "Receipt attachment is required for an expense" });
    }

    const paymentParts = [cash, bank, upi].map((value) => Number(value || 0));
    if (paymentParts.some((value) => !Number.isFinite(value))) {
      return res.status(400).json({ message: "Payment amounts must be valid numbers" });
    }
    if (
      normalizedPaymentMethod === "split" &&
      Math.abs(paymentParts.reduce((sum, value) => sum + Math.abs(value), 0) - Math.abs(numericAmount)) > 0.01
    ) {
      return res.status(400).json({ message: "Cash, bank, and UPI split must equal the total amount" });
    }

    /* ───────── decide if we need an invoice ───────── */
    const isMoneyTransfer =
      normalizedType.toLowerCase() === "money transfer" &&
      ["cash to bank", "bank to cash", "bulk amount transfer"].includes(String(category).toLowerCase().trim());

    let finalInvoice = invoiceNo; // keep client’s invoice if sent

    if (!finalInvoice) {
      if (isSecurityReturn) {
        finalInvoice = `SECURITY-${locCode}-${Date.now()}`;
      } else if (isMoneyTransfer) {
        finalInvoice = `TRANSFER-${locCode}-${Date.now()}`;
      } else {
        finalInvoice = await nextInvoice(locCode);
      }
    }

    /* ───────── decode the attachment (if any) ───────── */
    let attachmentObj = undefined;                // 🔺 ADDED
    if (attachment) {
      try {
        attachmentObj = parseBase64(attachment);  // { filename, contentType, data }
      } catch (err) {
        return res.status(400).json({ message: "Invalid attachment data" });
      }
    }

    /* ───────── create & save ───────── */
    const expenseValue = (value) => {
      const numericValue = Number(value || 0);
      if (!isExpense) return String(value ?? "0");
      return numericValue === 0 ? "0" : String(-Math.abs(numericValue));
    };

    const newTx = await Transaction.create({
      type: isExpense ? "expense" : normalizedType,
      category: String(category).trim(),
      subCategory: String(subCategory || "").trim(),
      expenseType: String(expenseType || "").trim(),
      entryType: String(entryType || "").trim(),
      remark,
      amount: expenseValue(amount),
      quantity,
      cash: expenseValue(cash),
      rbl: expenseValue(rbl || 0),
      bank: expenseValue(bank),
      upi: expenseValue(upi),
      locCode: String(locCode).trim(),
      paymentMethod: normalizedPaymentMethod,
      bankAccount: String(bankAccount || "").trim(),
      isAdminLevel: isAdminLevel === true || isAdminLevel === "true",
      date,
      invoiceNo: finalInvoice,
      attachment: attachmentObj                     // 🔺 ADDED
    });

    // A newly recorded payment must be visible immediately to optimized reports.
    clearCachePattern("transactions:");

    // ✅ Propagate cash to CloseTransaction for date >= txDate
    const cashAmount = Number(newTx.cash) || 0;
    if (cashAmount !== 0 && locCode && date) {
      await propagateCashDiff(locCode, date, cashAmount, true);
    }

    res.status(201).json(newTx);

  } catch (err) {
    console.error("CreatePayment error:", err);
    if (err.code === 11000 && err.keyPattern?.invoiceNo) {
      return res.status(409).json({ message: "Duplicate invoice number" });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


/* ========= download route handler (keep in same file or split) ========= */
export const DownloadAttachment = async (req, res) => {
  try {
    const tx = await Transaction
      .findById(req.params.id)
      .select("attachment");

    if (!tx || !tx.attachment || !tx.attachment.data) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    res
      .set({
        "Content-Type":        tx.attachment.contentType,
        "Content-Disposition": `attachment; filename="${tx.attachment.filename}"`
      })
      .send(tx.attachment.data);
  } catch (err) {
    res.status(500).json({ message: "Download failed", error: err.message });
  }
};






export const GetPayment = async (req, res) => {
    try {
        const { LocCode, DateFrom, DateTo } = req.query;

        console.log(`\n📊 GetPayment Request:`);
        console.log(`   LocCode: "${LocCode}"`);
        console.log(`   DateFrom: "${DateFrom}"`);
        console.log(`   DateTo: "${DateTo}"`);

        if (!DateFrom || !DateTo) {
            return res.status(400).json({ message: "Both 'DateFrom' and 'DateTo' are required" });
        }

        // Convert to Date objects and normalize to start and end of the day
        const fromDate = new Date(DateFrom);
        const toDate = new Date(DateTo);

        fromDate.setUTCHours(0, 0, 0, 0); // Start of the day
        toDate.setUTCHours(23, 59, 59, 999); // End of the day

        console.log(`   Parsed fromDate: ${fromDate.toISOString()}`);
        console.log(`   Parsed toDate: ${toDate.toISOString()}`);

        // Build query — if LocCode is "all" or omitted, fetch all stores
        const query = { date: { $gte: fromDate, $lte: toDate } };
        if (LocCode && LocCode !== "all") {
            query.locCode = String(LocCode);
        }

        // Query transactions based on LocCode and Date Range — exclude binary attachment but include hasAttachment flag
        const transactions = await Transaction.aggregate([
          { $match: query },
          {
            $addFields: {
              hasAttachment: { $cond: [{ $gt: [{ $ifNull: ["$attachment.data", null] }, null] }, true, false] },
              attachmentFilename: "$attachment.filename"
            }
          },
          { $project: { attachment: 0 } },
          { $sort: { date: -1 } }
        ]).option({ allowDiskUse: true });

        console.log(`   Found ${transactions.length} transactions`);
        
        // ✅ Lightweight logging - only log summary info, not full objects
        if (transactions.length === 0) {
            console.log(`   ⚠️ No transactions found for this query`);
        }

        res.status(200).json({
            data: transactions
        });
    } catch (error) {
        console.error("GetPayment error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
        
    }
};





