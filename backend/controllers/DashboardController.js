import Transaction from "../model/Transaction.js";
import CloseTransaction from "../model/Closing.js";
import ReorderAlert from "../model/ReorderAlert.js";
import PurchaseOrder from "../model/PurchaseOrder.js";
import User from "../model/UserModel.js";
import Store from "../model/Store.js";
import { isAllowedStore } from "./StoreController.js";
import { businessDate } from "../utils/daybookDates.js";

const EXPENSE_CATEGORIES = new Set([
  "petty expenses", "staff reimbursement", "maintenance expenses", "telephone internet",
  "utility bill", "salary", "rent", "courier charges", "asset purchase", "promotion_services",
  "spot incentive", "other expenses", "shoe sales return",
  "shirt sales return", "dry cleaning", "altration", "material", "travel exp", "fuel exp",
  "waste management", "water charges", "printing stationary", "staff welfare",
  "staff accommodation", "incentive", "compensation", "write off",
  "office supplies", "bank fees and charges", "travel expense", "directors travelling expense",
  "employee travel expenses", "cluster travelling expense", "telephone expense", "automobile expense",
  "it and internet expenses", "rent expense", "janitorial expense", "postage", "bad debt",
  "salaries and employee wages", "meals and entertainment", "depreciation expense", "consultant expense",
  "repairs and maintenance", "repairs & maintenance", "lodging", "transportation expense",
  "depreciation and amortisation", "epf contribution-employer", "esi contribution-employer",
  "interest and fine", "fines and penalties", "rates & taxes", "interest on tds",
  "fine's and penalty-electricity", "interest & late fee", "telephone & internet expense",
  "office expenses [parent]", "printing and stationery", "printing & stationary", "internet expenses",
  "internet expense", "office expenses", "office expense", "printer consumables", "fuel expenses",
  "legal charges", "charity", "cleaning expenses", "labour charges office", "parking charge",
  "subscription charges", "marketing & promotion", "advertising and marketing", "salary and wages",
  "salary/salary advance", "salary advance", "employee wages", "overtime payment", "consultation charges", "accounting charges",
  "bank charges", "finance charges", "paytm deductions", "car loan interest", "emi", "utility charges",
  "electricity charges", "staff welfare expenses", "staff food and accomodation", "gift expenses",
  "rent expenses - warehouse", "generator expenses", "meeting expenses", "vehicle insurance",
  "printer service", "domain purchase", "filing fees", "selling expenses", "discount allowed",
  "equipment rent", "mca charges", "gst late fees and interest", "rental supplies expense",
  "training & development expenses", "interior designing", "audit fee", "lease registration charges",
  "payment gateway charges", "house rent allowance", "utility connection / government fees",
  "tds late fee", "trademark expense", "cost of goods sold", "labor", "materials", "subcontractor",
  "job costing", "transportation expenses", "freight expenses", "dry cleaning expenses",
  "uniform stitching", "alteration expense", "raw materials / dress accessories", "raw materials and consumables",
  "raw materials", "raw material", "raw materials & consumables", "raw materials/dress accessories",
  "freight charges", "product expenses", "labour charges - warehouse", "uniform expense", "food expense",
  "refund", "store rent"
]);

const makeShortCode = (storeName, locCode) => {
  const cleanName = String(storeName || "").trim();
  if (!cleanName) return `S-${locCode}`;
  const words = cleanName
    .replace(/^suitor\s*guy\s*/i, "")
    .replace(/^sg[\s.-]+/i, "")
    .replace(/^g[\s.-]+/i, "")
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (words.length === 0) return `S-${locCode}`;
  if (words.length === 1) {
    const w = words[0].toUpperCase();
    return w.length <= 5 ? `S-${w}` : `S-${w.slice(0, 4)}`;
  }
  const initials = words.map((w) => w[0]).join("").toUpperCase();
  return `S-${initials.slice(0, 4)}`;
};

const buildActiveStores = async () => {
  const storeAdmins = await User.find(
    {
      role: {
        $in: [
          "store_admin",
          "store_manager",
          "store admin",
          "warehouse_admin",
          "warehouseadmin",
          "warehouse admin",
        ],
      },
      locCode: { $exists: true, $ne: "" },
    },
    { password: 0 }
  ).lean();

  const validLocCodes = storeAdmins
    .map((u) => (u.locCode || "").toString().trim())
    .filter(Boolean);

  let dbStores = [];
  if (validLocCodes.length > 0) {
    dbStores = await Store.find({
      locCode: { $in: validLocCodes },
      isActive: { $ne: false },
    }).lean();
  }

  const storeMap = new Map();
  for (const u of storeAdmins) {
    const code = (u.locCode || "").toString().trim();
    if (!code) continue;
    const key = code.toLowerCase();
    if (!storeMap.has(key)) {
      const storeDoc = dbStores.find(
        (s) => (s.locCode || "").toString().trim().toLowerCase() === key
      );
      const name = storeDoc?.name || storeDoc?.locName || u.storeName || u.username || code;
      storeMap.set(key, {
        locCode: code,
        locName: name,
        shortCode: makeShortCode(name, code),
        isActive: true,
      });
    }
  }

  return Array.from(storeMap.values()).filter(isAllowedStore);
};

export const getDashboardSummary = async (req, res) => {
  try {
    const todayStr = businessDate();
    const defaultFrom = `${todayStr.slice(0, 7)}-01`;

    const fromDate = (req.query.fromDate || defaultFrom).toString().slice(0, 10);
    const toDate = (req.query.toDate || todayStr).toString().slice(0, 10);
    const requestedLocCode = (req.query.locCode || "all").toString().trim();

    const role = (req.query.role || req.headers["x-user-role"] || "").toLowerCase().trim();
    const userPower = (req.query.userPower || "").toLowerCase().trim();
    const userLocCode = (req.query.userLocCode || "").toString().trim();
    const canSeeAdminOnly =
      req.query.canSeeAdminOnly === "true" ||
      ["admin", "super_admin", "superadmin", "super admin", "financial_head", "financial_admin"].includes(role) ||
      ["admin", "super_admin", "superadmin"].includes(userPower);

    const isPrivileged =
      canSeeAdminOnly ||
      role.includes("cluster");

    const allActiveStores = await buildActiveStores();

    // Determine visible stores based on user role
    let visibleStores = allActiveStores;
    if (!isPrivileged && userLocCode) {
      const matched = allActiveStores.filter(
        (s) => s.locCode.toLowerCase() === userLocCode.toLowerCase()
      );
      visibleStores = matched.length > 0
        ? matched
        : [{ locCode: userLocCode, locName: userLocCode, shortCode: `S-${userLocCode}`, isActive: true }];
    }

    const effectiveLocCode = !isPrivileged && userLocCode
      ? userLocCode
      : requestedLocCode;

    // Date range for MongoDB queries (cover full start & end days in UTC/IST safely)
    const rangeStart = new Date(`${fromDate}T00:00:00.000Z`);
    const rangeEnd = new Date(`${toDate}T23:59:59.999Z`);

    // Target day for Daybook Status check (use toDate if <= today, else today)
    const statusTargetDate = toDate <= todayStr ? toDate : todayStr;
    const statusTargetUtc = new Date(`${statusTargetDate}T00:00:00.000Z`);
    const statusStartWindow = new Date(statusTargetUtc.getTime() - 12 * 3600 * 1000);
    const statusEndWindow = new Date(statusTargetUtc.getTime() + 36 * 3600 * 1000);

    // Transaction query (fetch for all visible stores if "all", or specific store)
    const txnQuery = {
      date: { $gte: rangeStart, $lte: rangeEnd },
    };
    if (effectiveLocCode && effectiveLocCode !== "all") {
      txnQuery.locCode = effectiveLocCode;
    } else if (!isPrivileged && visibleStores.length > 0) {
      txnQuery.locCode = { $in: visibleStores.map((s) => s.locCode) };
    }

    // Reorder alerts, POs, late closures queries
    const reorderQuery = { status: "active" };
    const poQuery = { status: { $nin: ["cancelled", "received", "closed"] } };
    const lateClosureQuery = { status: "pending_approval" };

    if (!isPrivileged && userLocCode) {
      lateClosureQuery.locCode = new RegExp(`^${userLocCode}$`, "i");
      poQuery.locCode = new RegExp(`^${userLocCode}$`, "i");
    } else if (effectiveLocCode && effectiveLocCode !== "all") {
      lateClosureQuery.locCode = new RegExp(`^${effectiveLocCode}$`, "i");
    }

    const [
      transactions,
      dayCloses,
      reorderAlertCount,
      activePurchaseOrderCount,
      lateClosureCount,
    ] = await Promise.all([
      Transaction.find(txnQuery).lean(),
      CloseTransaction.find({
        date: { $gte: statusStartWindow, $lte: statusEndWindow },
      }).lean(),
      ReorderAlert.countDocuments(reorderQuery).catch(() => 0),
      PurchaseOrder.countDocuments(poQuery).catch(() => 0),
      CloseTransaction.countDocuments(lateClosureQuery).catch(() => 0),
    ]);

    // Aggregate MongoDB financials
    const totals = {
      income: { cash: 0, bank: 0, upi: 0, rbl: 0, total: 0 },
      returnableIncome: { total: 0 },
      expenses: { cash: 0, bank: 0, upi: 0, rbl: 0, total: 0 },
    };

    const storeTotalsMap = new Map();
    const storesForRanking =
      effectiveLocCode && effectiveLocCode !== "all"
        ? visibleStores.filter((s) => s.locCode.toLowerCase() === effectiveLocCode.toLowerCase())
        : visibleStores;

    storesForRanking.forEach((s) => {
      storeTotalsMap.set(s.locCode.toLowerCase(), {
        locCode: s.locCode,
        storeName: s.locName,
        shortCode: s.shortCode,
        income: 0,
        expense: 0,
        difference: 0,
      });
    });

    for (const t of transactions) {
      const tp = (t.type || "").toLowerCase().trim();
      const sub = (t.subCategory || "").toLowerCase().trim();
      const cat = (t.category || "").toLowerCase().trim();
      const inv = (t.invoiceNo || "").toUpperCase();
      const rmk = (t.remark || t.remarks || "").toUpperCase();
      const expType = (t.expenseType || "").toLowerCase().trim();

      if (t.isAdminLevel && !canSeeAdminOnly) continue;

      const isShoeOrShirtSale =
        sub === "shoe sales" || sub === "shirt sales" || sub === "mixed sales" ||
        cat === "shoe sales" || cat === "shirt sales" || cat === "mixed sales";
      const isSalesReturn =
        sub === "shoe sales return" || sub === "shirt sales return" || sub === "mixed sales return" ||
        cat === "shoe sales return" || cat === "shirt sales return" || cat === "mixed sales return";
      const isReturnInvoice = inv.startsWith("RTN-") || inv.startsWith("RET-");
      const isDirectOrIndirect =
        expType === "direct" || expType === "indirect" ||
        rmk.includes("[DIRECT") || rmk.includes("[INDIRECT") ||
        tp === "direct" || tp === "indirect" || tp === "direct expense" || tp === "indirect expense";

      const isBankToCash =
        cat === "bank to cash" || sub === "bank to cash" ||
        cat.includes("bank to cash") || sub.includes("bank to cash") ||
        cat.includes("cash to branch") || sub.includes("cash to branch");
      const isCashToBank =
        !isBankToCash && (
          cat === "bulk amount transfer" || cat === "cash to bank" ||
          sub === "bulk amount transfer" || sub === "cash to bank" ||
          tp === "money transfer"
        );

      if (isBankToCash || isCashToBank) continue;

      const isExpenseCategory = tp === "expense" || isDirectOrIndirect || EXPENSE_CATEGORIES.has(cat);
      const isActualExpense = isExpenseCategory || isReturnInvoice;

      if (
        !isActualExpense &&
        !isShoeOrShirtSale &&
        !isSalesReturn &&
        !isReturnInvoice &&
        (inv.startsWith("INV-") || inv.startsWith("RTN-") || inv.startsWith("RET-"))
      ) {
        continue;
      }

      const cash = Number(t.cash || 0);
      const rbl = Number(t.rbl || t.rblRazorPay || 0);
      const bank = Number(t.bank || 0);
      const upi = Number(t.upi || 0);
      const rowTotal = cash + bank + upi + rbl;
      const absCash = Math.abs(cash);
      const absBank = Math.abs(bank);
      const absUpi = Math.abs(upi);
      const absRbl = Math.abs(rbl);
      const absTotal = absCash + absBank + absUpi + absRbl;

      const lc = (t.locCode || "").toString().trim();
      const lcKey = lc.toLowerCase();
      if (lc && !storeTotalsMap.has(lcKey) && (effectiveLocCode === "all" || lcKey === effectiveLocCode.toLowerCase())) {
        storeTotalsMap.set(lcKey, {
          locCode: lc,
          storeName: lc,
          shortCode: makeShortCode(lc, lc),
          income: 0,
          expense: 0,
          difference: 0,
        });
      }
      const storeEntry = storeTotalsMap.get(lcKey);

      if (cat.includes("returnable income") || sub.includes("returnable income")) {
        totals.returnableIncome.total += Math.abs(rowTotal || Number(t.amount || 0));
      } else if (
        cat.includes("security refund") ||
        sub.includes("security refund") ||
        (tp === "return" && !isSalesReturn && !isReturnInvoice)
      ) {
        // Security refund reduces held returnable income or is tracked separately
        continue;
      } else if (isReturnInvoice || tp === "return" || isSalesReturn || isExpenseCategory) {
        totals.expenses.cash += absCash;
        totals.expenses.bank += absBank;
        totals.expenses.upi += absUpi;
        totals.expenses.rbl += absRbl;
        totals.expenses.total += absTotal;
        if (storeEntry) storeEntry.expense += absTotal;
      } else if (tp === "income" || isShoeOrShirtSale) {
        totals.income.cash += cash;
        totals.income.bank += bank;
        totals.income.upi += upi;
        totals.income.rbl += rbl;
        totals.income.total += rowTotal;
        if (storeEntry) storeEntry.income += rowTotal;
      }
    }

    const storeRankings = Array.from(storeTotalsMap.values()).map((s) => ({
      ...s,
      difference: s.income - s.expense,
    }));

    // Build Daybook Status list for target date
    const closedMap = new Map();
    dayCloses.forEach((c) => {
      if (businessDate(c.date) === statusTargetDate) {
        closedMap.set((c.locCode || "").toString().trim().toLowerCase(), c);
      }
    });

    const daybookStores =
      effectiveLocCode && effectiveLocCode !== "all"
        ? visibleStores.filter((s) => s.locCode.toLowerCase() === effectiveLocCode.toLowerCase())
        : visibleStores;

    const daybookStatus = daybookStores.map((store) => {
      const closeDoc = closedMap.get(store.locCode.toLowerCase());
      return {
        locCode: store.locCode,
        storeName: store.locName,
        status: closeDoc ? "closed" : "not_closed",
        closeStatus: closeDoc?.status || null,
        closedAt: closeDoc?.updatedAt || closeDoc?.createdAt || null,
        cash: closeDoc ? Number(closeDoc.cash || 0) : 0,
        closeCash: closeDoc ? Number(closeDoc.Closecash || 0) : 0,
        bank: closeDoc ? Number(closeDoc.bank || 0) : 0,
      };
    });

    const netDifference = {
      cash: totals.income.cash - totals.expenses.cash,
      bank: totals.income.bank - totals.expenses.bank,
      upi: totals.income.upi - totals.expenses.upi,
      rbl: totals.income.rbl - totals.expenses.rbl,
      total: totals.income.total - totals.expenses.total,
    };

    return res.status(200).json({
      success: true,
      meta: {
        fromDate,
        toDate,
        locCode: effectiveLocCode,
        statusDate: statusTargetDate,
      },
      stores: visibleStores,
      kpis: {
        totalIncome: totals.income,
        returnableIncome: totals.returnableIncome,
        totalExpenses: totals.expenses,
        netDifference,
      },
      storeRankings,
      daybookStatus,
      quickOverview: {
        reorderAlerts: reorderAlertCount,
        purchaseOrders: activePurchaseOrderCount,
        lateClosures: lateClosureCount,
      },
    });
  } catch (error) {
    console.error("getDashboardSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard summary",
      error: error.message,
    });
  }
};
