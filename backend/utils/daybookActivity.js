import CloseTransaction from "../model/Closing.js";
import Transaction from "../model/Transaction.js";

/**
 * A day book closing for `date` (YYYY-MM-DD) is only owed by a location that had
 * any day book activity (a transaction or a closing) on or before that date.
 *
 * A store created through Add New Store has no history, so it must not be frozen
 * for "yesterday's day book not closed" before it has ever traded. Once it records
 * anything, the normal daily-closing rule applies.
 */
const endOfDate = (date) => {
    const start = new Date(`${String(date).slice(0, 10)}T00:00:00.000Z`);
    return new Date(start.getTime() + 86400000);
};

export const hasDaybookActivity = async (locCode, date) => {
    const code = (locCode || "").toString().trim();
    if (!code) return false;
    const before = { $lt: endOfDate(date) };
    const [txn, close] = await Promise.all([
        Transaction.exists({ locCode: code, date: before }),
        CloseTransaction.exists({ locCode: code, date: before }),
    ]);
    return Boolean(txn || close);
};

/** Of the given locCodes, returns the Set that had any day book activity on or before `date`. */
export const locCodesWithDaybookActivity = async (locCodes, date) => {
    const codes = [...new Set((locCodes || []).map((c) => (c || "").toString().trim()).filter(Boolean))];
    if (codes.length === 0) return new Set();
    const filter = { locCode: { $in: codes }, date: { $lt: endOfDate(date) } };
    const [txnCodes, closeCodes] = await Promise.all([
        Transaction.distinct("locCode", filter),
        CloseTransaction.distinct("locCode", filter),
    ]);
    return new Set([...txnCodes, ...closeCodes].map((c) => (c || "").toString().trim()));
};
