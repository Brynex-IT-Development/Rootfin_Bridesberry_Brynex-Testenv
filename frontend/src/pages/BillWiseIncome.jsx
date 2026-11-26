import { CSVLink } from "react-csv";
import Headers from '../components/Header.jsx';
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Select from "react-select";
import { appSelectStyles } from "../components/AppSelect.jsx";
import useFetch from '../hooks/useFetch.jsx';
import baseUrl from '../api/api.js';
import { Minus, Plus } from "lucide-react";
import { useEnterToSave } from "../hooks/useEnterToSave";
import { daybookToday, previousDaybookDate } from "../utils/daybookDates.js";
import { excludeAdminOnlyTransactions } from "../utils/adminTransactionVisibility.js";

const headers = [
    { label: "Date", key: "date" },
    { label: "Invoice No", key: "invoiceNo" },
    { label: "Customer Name", key: "customerName" },
    { label: "Category", key: "Category" },
    { label: "Sub Category", key: "SubCategory" },
    { label: "Remarks", key: "remarks" },
    { label: "Amount", key: "amount" },
    { label: "Total Transaction", key: "totalTransaction" },
    { label: "Discount", key: "discountAmount" },
    { label: "Bill Value", key: "billValue" },
    { label: "Cash", key: "cash" },
    { label: "Razorpay", key: "rbl" },
    { label: "Card/Bank", key: "bank" },
    { label: "UPI", key: "upi" },
];

const categories = [
    { value: "all", label: "All Categories" },
    { value: "booking", label: "Booking" },
    { value: "RentOut", label: "Rent Out" },
    { value: "Refund", label: "Refund" },
    { value: "Return", label: "Return" },
    { value: "Cancel", label: "Cancel" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expense" },
    { value: "money transfer", label: "Cash to Bank" },
];

const subCategories = [
    { value: "all", label: "All Sub Categories" },
    { value: "advance", label: "Advance" },
    { value: "Balance Payable", label: "Balance Payable" },
    { value: "security", label: "Security" },
    { value: "cancellation Refund", label: "Cancellation Refund" },
    { value: "security Refund", label: "Security Refund" },
    { value: "compensation", label: "Compensation" },
    { value: "petty expenses", label: "Petty Expenses" },
    { value: "shoe sales", label: "Shoe Sales" },
    { value: "shirt sales", label: "Shirt Sales" },
    { value: "mixed sales", label: "Mixed Sales (Shoes & Shirts)" },
    { value: "bulk amount transfer", label: "Bulk Amount Transfer" }
];

// Maps raw DB category/subCategory values → human-readable labels
const CATEGORY_LABEL_MAP = {
  "dry cleaning":         "Dry Cleaning",
  "altration":            "Altration",
  "material":             "Material",
  "courier charges":      "Courier Charges",
  "maintenance expenses": "Repairs & Maintenance",
  "travel exp":           "Travel Exp",
  "fuel exp":             "Fuel Exp",
  "petty expenses":       "Office Expense",
  "telephone internet":   "Internet Expense",
  "utility bill":         "Electricity Charges",
  "waste management":     "Waste Management",
  "water charges":        "Water Charges",
  "salary":               "Salary / Salary Advance",
  "printing stationary":  "Printing & Stationary",
  "staff welfare":        "Staff Welfare",
  "staff reimbursement":  "Staff Accommodation",
  "rent":                 "Rent",
  "asset purchase":       "Asset Purchase",
  "incentive":            "Incentive",
  "spot incentive":       "Incentive",
  "other expenses":       "Refund",
  "bulk amount transfer": "Cash to Bank",
  "write off":            "Write Off",
  "promotion_services":   "Promotion / Services",
  "shoe sales return":    "Shoe Sales Return",
  "shirt sales return":   "Shirt Sales Return",
};
const getCatLabel = (val) => CATEGORY_LABEL_MAP[(val || "").toLowerCase().trim()] || val;

const denominations = [
    { label: "500", value: 500 },
    { label: "200", value: 200 },
    { label: "100", value: 100 },
    { label: "50", value: 50 },
    { label: "20", value: 20 },
    { label: "10", value: 10 },
    { label: "Coins", value: 1 },
];

const calculateDaybookTotals = (transactions, openingCash) => {
    const bankAmount = transactions.reduce((sum, item) => sum +
        (parseInt(item.bookingBankAmount, 10) || 0) +
        (parseInt(item.rentoutBankAmount, 10) || 0) +
        (parseInt(item.rentoutUPIAmount, 10) || 0) +
        (parseInt(item.bookingUPIAmount, 10) || 0) -
        (parseInt(item.deleteBankAmount, 10) || 0) -
        (parseInt(item.deleteUPIAmount, 10) || 0) +
        (parseInt(item.returnBankAmount, 10) || 0), 0);
    const bankAmount1 = transactions.reduce((sum, item) => sum + (parseInt(item.bank, 10) || 0), 0);
    const bankAmountupi = transactions.reduce((sum, item) => sum + (parseInt(item.upi, 10) || 0), 0);
    const rblAmount = transactions.reduce((sum, item) => sum + (parseInt(item.rbl, 10) || 0), 0);
    const dayCashTransactions = transactions.reduce((sum, item) => sum + (parseInt(item.cash, 10) || 0), 0);
    return {
        totalBankAmount: bankAmount,
        totalBankAmount1: bankAmount1,
        totalBankAmountupi: bankAmountupi,
        totalRblAmount: rblAmount,
        dayCashTransactions,
        totalCash: dayCashTransactions + openingCash
    };
};

const customSelectStyles = {
    control: (provided, state) => ({
        ...provided,
        backgroundColor: '#ffffff',
        borderColor: state.isFocused ? '#18181b' : '#e2e8f0',
        borderRadius: '0px',
        padding: '1px 2px',
        minHeight: '38px',
        boxShadow: state.isFocused ? '0 0 0 1px #18181b' : 'none',
        '&:hover': {
            borderColor: '#cbd5e1',
        },
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#1e293b',
        cursor: 'pointer',
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? '#18181b' : state.isFocused ? '#f1f5f9' : '#ffffff',
        color: state.isSelected ? '#ffffff' : '#334155',
        fontSize: '0.875rem',
        cursor: 'pointer',
    }),
    menu: (provided) => ({
        ...provided,
        borderRadius: '0px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        zIndex: 50,
        overflow: 'hidden',
    }),
};

const DayBookInc = ({ admin = false }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const handleSidebarChange = (e) => {
            if (e.detail && typeof e.detail.isOpen === "boolean") {
                setIsSidebarOpen(e.detail.isOpen);
            }
        };
        window.addEventListener("sidebar-changed", handleSidebarChange);
        return () => window.removeEventListener("sidebar-changed", handleSidebarChange);
    }, []);

    const today = daybookToday();
    const yesterday = previousDaybookDate(today);
    const requestedCloseDate = new URLSearchParams(window.location.search).get("closeDate");
    const currentDate = requestedCloseDate === yesterday ? yesterday : today;
    const currentusers = JSON.parse(localStorage.getItem("rootfinuser"));
    const exemptFromLock = admin || currentusers?.power === "admin" ||
        ["admin", "superadmin", "cluster_manager", "financial_head"].includes((currentusers?.role || "").toLowerCase());
    const [freezeReason, setFreezeReason] = useState(null);
    const [lockLoading, setLockLoading] = useState(!exemptFromLock);
    const [preOpen, setPreOpen] = useState(null);
    const [preOpen1, setPreOpen1] = useState(null);
    const [loading, setLoading] = useState(false);
    const [dayBookDataLoading, setDayBookDataLoading] = useState(true);
    const [closingDataLoading, setClosingDataLoading] = useState(true);
    const [localLoadError, setLocalLoadError] = useState("");
    // Save is locked for a short settling period after figures load, so a half-loaded
    // total can never be saved.
    const [stabilized, setStabilized] = useState(false);
    // Set once this page's save succeeded; the page stays here and shows the result.
    const [savedFinished, setSavedFinished] = useState(false);
    const [savedMessage, setSavedMessage] = useState("");
    // { message, retry } for a failed PDF; retry re-runs the same export.
    const [pdfToast, setPdfToast] = useState(null);
    const isLateClose = currentDate !== today;

    // Edit functionality states
    const [editingIndex, setEditingIndex] = useState(null);
    const [editedTransaction, setEditedTransaction] = useState({});
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Store for edited transactions to override TWS data
    const [editedTransactionsMap, setEditedTransactionsMap] = useState({});

    // Filter states
    const [selectedCategory, setSelectedCategory] = useState(categories[0]);
    const [selectedSubCategory, setSelectedSubCategory] = useState(subCategories[0]);
    
    const [quantities, setQuantities] = useState(() => {
        const saved = localStorage.getItem(`denominations_${currentDate}_${currentusers?.locCode}`);
        return saved ? JSON.parse(saved) : Array(denominations.length).fill("");
    });

    const userPower = (currentusers?.power || "").toLowerCase().trim();
    const userRole = (currentusers?.role || "").toLowerCase().trim();
    const showAction =
        userPower === "admin" ||
        userPower === "super_admin" ||
        userPower === "superadmin" ||
        userRole === "admin" ||
        userRole === "super_admin" ||
        userRole === "superadmin" ||
        userRole === "super admin";

    const [year, month, day] = currentDate.split("-");
    const date = `${day}-${month}-${year}`;
    const formattedDate = previousDaybookDate(currentDate);

    const displayFormattedDate = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(new Date(`${currentDate}T12:00:00+05:30`));

    useEffect(() => {
        if (exemptFromLock || !currentusers?.locCode) {
            setLockLoading(false);
            return;
        }
        const checkYesterday = async () => {
            setLockLoading(true);
            try {
                const params = new URLSearchParams({ locCode: String(currentusers.locCode), date: yesterday });
                const response = await fetch(`${baseUrl.baseUrl}user/getsaveCashBank?${params}`);
                if (!response.ok) throw new Error("Unable to check yesterday's day book");
                const result = await response.json();
                setFreezeReason(!result.data && currentDate !== yesterday ? "missing_yesterday" :
                    result.data?.status === "pending_approval" ? "pending_approval" : null);
            } catch (_error) {
                setFreezeReason("check_failed");
            } finally {
                setLockLoading(false);
            }
        };
        checkYesterday();
    }, [currentDate, currentusers?.locCode, exemptFromLock, yesterday]);

    const apiUrl = currentusers?.locCode ? `https://rentalapi.rootments.live/api/GetBooking/GetBookingList?LocCode=${currentusers?.locCode}&DateFrom=${currentDate}&DateTo=${currentDate}` : null;
    const apiurl1 = currentusers?.locCode ? `https://rentalapi.rootments.live/api/GetBooking/GetRentoutList?LocCode=${currentusers?.locCode}&DateFrom=${currentDate}&DateTo=${currentDate}` : null;
    const apiUrl2 = currentusers?.locCode ? `https://rentalapi.rootments.live/api/GetBooking/GetReturnList?LocCode=${currentusers?.locCode}&DateFrom=${currentDate}&DateTo=${currentDate}` : null;
    const apiUrl3 = currentusers?.locCode ? `https://rentalapi.rootments.live/api/GetBooking/GetDeleteList?LocCode=${currentusers?.locCode}&DateFrom=${currentDate}&DateTo=${currentDate}` : null;
    const apiUrl4_fallback = currentusers?.locCode ? `${baseUrl.baseUrl}user/Getpayment?LocCode=${currentusers?.locCode}&DateFrom=${currentDate}&DateTo=${currentDate}` : null;
    const apiUrl5 = `${baseUrl.baseUrl}user/saveCashBank`;
    const apiUrl6 = currentusers?.locCode ? `${baseUrl.baseUrl}user/getsaveCashBank?locCode=${currentusers?.locCode}&date=${formattedDate}` : null;
    const apiUrl7 = currentusers?.locCode ? `${baseUrl.baseUrl}user/getsaveCashBank?locCode=${currentusers?.locCode}&date=${currentDate}` : null;

    const locCode = currentusers?.locCode;
    const email = currentusers?.email;

    const printRef = useRef(null);
    const csvLinkRef = useRef(null);

    const handlePrint = () => {
        window.print();
    };

    const fetchOptions = useMemo(() => ({}), []);

    const { data, loading: bookingLoading, error: bookingError } = useFetch(apiUrl, fetchOptions);
    const { data: data1, loading: rentoutLoading, error: rentoutError } = useFetch(apiurl1, fetchOptions);
    const { data: data2, loading: returnLoading, error: returnError } = useFetch(apiUrl2, fetchOptions);
    const { data: data3, loading: cancelLoading, error: cancelError } = useFetch(apiUrl3, fetchOptions);

    const [dayBookData, setDayBookData] = useState([]);

    // Fetch mongo transactions once on mount
    useEffect(() => {
        if (!currentusers?.locCode || !apiUrl4_fallback) {
            setDayBookData([]);
            setDayBookDataLoading(false);
            return;
        }
        setDayBookDataLoading(true);
        fetch(apiUrl4_fallback)
            .then(r => {
                if (!r.ok) throw new Error("Unable to load daybook transactions.");
                return r.json();
            })
            .then(json => setDayBookData(excludeAdminOnlyTransactions(json?.data || [])))
            .catch(() => setLocalLoadError("Unable to load daybook transactions."))
            .finally(() => setDayBookDataLoading(false));
    }, [apiUrl4_fallback, currentusers?.locCode]);

    const daybookLoadError = currentusers?.locCode ? (bookingError || rentoutError || returnError || cancelError) : null;
    const isDataReady = !bookingLoading && !rentoutLoading && !returnLoading && !cancelLoading &&
        !dayBookDataLoading && !daybookLoadError;

    // Re-arm the settling timer whenever figures are (re)loading, and unlock save ~2.5s after they settle.
    const figuresSettled = isDataReady && !closingDataLoading;
    useEffect(() => {
        if (!figuresSettled) {
            setStabilized(false);
            return undefined;
        }
        const timer = window.setTimeout(() => setStabilized(true), 2500);
        return () => window.clearTimeout(timer);
    }, [figuresSettled, currentDate]);

    const processedTransactions = useMemo(() => {
        if (!isDataReady) return { booking: [], rentOut: [], return: [], cancel: [], mongo: [] };

        const bookingTransactions = (data?.dataSet?.data || []).map(transaction => {
            const bookingCashAmount = parseInt(transaction?.bookingCashAmount || 0, 10);
            const bookingBankAmount = parseInt(transaction?.bookingBankAmount || 0, 10);
            const bookingUPIAmount = parseInt(transaction?.bookingUPIAmount || 0, 10);
            const rblAmount = parseInt(transaction?.rblRazorPay || 0, 10);
            const invoiceAmount = parseInt(transaction?.invoiceAmount || 0, 10);
            const discountAmount = parseInt(transaction?.discountAmount || 0, 10);

            const totalAmount = bookingCashAmount + bookingBankAmount + bookingUPIAmount + rblAmount;

            return {
                ...transaction,
                date: transaction?.bookingDate || null,
                time: transaction?.time || transaction?.bookingTime || "10:34 am",
                customerName: transaction?.customerName || transaction?.customer || "Customer",
                bookingCashAmount,
                bookingBankAmount,
                billValue: transaction.invoiceAmount,
                discountAmount: discountAmount,
                invoiceAmount,
                bookingBank1: bookingBankAmount,
                TotaltransactionBooking: totalAmount,
                Category: "Booking",
                SubCategory: "Advance",
                totalTransaction: totalAmount,
                cash: bookingCashAmount,
                rbl: rblAmount,
                bank: bookingBankAmount,
                upi: bookingUPIAmount,
                amount: totalAmount,
                remarks: transaction?.remarks || transaction?.remark || "-"
            };
        });

        const rentOutTransactions = (data1?.dataSet?.data || []).map(transaction => {
            const rentoutCashAmount = parseInt(transaction?.rentoutCashAmount ?? 0, 10);
            const rentoutBankAmount = parseInt(transaction?.rentoutBankAmount ?? 0, 10);
            const invoiceAmount = parseInt(transaction?.invoiceAmount ?? 0, 10);
            const advanceAmount = parseInt(transaction?.advanceAmount ?? 0, 10);
            const rentoutUPIAmount = parseInt(transaction?.rentoutUPIAmount ?? 0, 10);
            const rblAmount = parseInt(transaction?.rblRazorPay ?? 0, 10);
            const securityAmount = parseInt(transaction?.securityAmount ?? 0, 10);

            const totalAmount = rentoutCashAmount + rentoutBankAmount + rentoutUPIAmount + rblAmount;

            return {
                ...transaction,
                date: transaction?.rentOutDate ?? "",
                time: transaction?.time || transaction?.rentOutTime || "10:34 am",
                customerName: transaction?.customerName || transaction?.customer || "Customer",
                rentoutCashAmount,
                rentoutBankAmount,
                invoiceAmount,
                discountAmount: parseInt(transaction.discountAmount || 0),
                billValue: transaction.invoiceAmount,
                securityAmount,
                advanceAmount,
                Balance: invoiceAmount - advanceAmount,
                rentoutUPIAmount,
                Category: "RentOut",
                SubCategory: "Security",
                SubCategory1: "Balance Payable",
                totalTransaction: totalAmount,
                cash: rentoutCashAmount,
                rbl: rblAmount,
                bank: rentoutBankAmount,
                upi: rentoutUPIAmount,
                amount: totalAmount,
                remarks: transaction?.remarks || transaction?.remark || "-"
            };
        });

        const returnOutTransactions = (data2?.dataSet?.data || []).map(transaction => {
            const returnCashAmount = -(parseInt(transaction?.returnCashAmount || 0, 10));
            const returnRblAmount = -(parseInt(transaction?.rblRazorPay || 0, 10));
            const returnBankAmount = returnRblAmount !== 0 ? 0 : -(parseInt(transaction?.returnBankAmount || 0, 10));
            const returnUPIAmount = returnRblAmount !== 0 ? 0 : -(parseInt(transaction?.returnUPIAmount || 0, 10));
            const invoiceAmount = parseInt(transaction?.invoiceAmount || 0, 10);
            const advanceAmount = parseInt(transaction?.advanceAmount || 0, 10);
            const RsecurityAmount = -(parseInt(transaction?.securityAmount || 0, 10));

            const totalAmount = returnCashAmount + returnRblAmount + returnBankAmount + returnUPIAmount;

            return {
                ...transaction,
                date: transaction?.returnedDate || null,
                time: transaction?.time || transaction?.returnedTime || "10:34 am",
                customerName: transaction?.customerName || transaction?.customer || "Customer",
                returnBankAmount,
                returnCashAmount,
                returnUPIAmount,
                invoiceAmount,
                advanceAmount,
                discountAmount: parseInt(transaction.discountAmount || 0),
                billValue: invoiceAmount,
                amount: totalAmount,
                totalTransaction: totalAmount,
                RsecurityAmount,
                Category: "Return",
                SubCategory: "Security Refund",
                cash: returnCashAmount,
                rbl: returnRblAmount,
                bank: returnBankAmount,
                upi: returnUPIAmount,
                remarks: transaction?.remarks || transaction?.remark || "-"
            };
        });

        const canCelTransactions = (data3?.dataSet?.data || []).map(transaction => {
            const deleteCashAmount = -Math.abs(parseInt(transaction.deleteCashAmount || 0));
            const deleteRblAmount = -Math.abs(parseInt(transaction.rblRazorPay || 0));
            const originalRblAmount = parseInt(transaction.rblRazorPay || 0);
            const deleteBankAmount = originalRblAmount !== 0 ? 0 : -Math.abs(parseInt(transaction.deleteBankAmount || 0));
            const deleteUPIAmount = originalRblAmount !== 0 ? 0 : -Math.abs(parseInt(transaction.deleteUPIAmount || 0));

            const totalAmount = deleteCashAmount + deleteRblAmount + deleteBankAmount + deleteUPIAmount;

            return {
                ...transaction,
                date: transaction.cancelDate,
                time: transaction?.time || transaction?.cancelTime || "10:34 am",
                customerName: transaction?.customerName || transaction?.customer || "Customer",
                Category: "Cancel",
                SubCategory: "cancellation Refund",
                discountAmount: parseInt(transaction.discountAmount || 0),
                billValue: transaction.invoiceAmount,
                amount: totalAmount,
                totalTransaction: totalAmount,
                cash: deleteCashAmount,
                rbl: deleteRblAmount,
                bank: deleteBankAmount,
                upi: deleteUPIAmount,
                remarks: transaction?.remarks || transaction?.remark || "-"
            };
        });

        const expenseCategoryValues = new Set([
            "petty expenses","staff reimbursement","maintenance expenses","telephone internet",
            "utility bill","salary","rent","courier charges","asset purchase","promotion_services",
            "spot incentive","bulk amount transfer","other expenses","shoe sales return",
            "shirt sales return","dry cleaning","altration","material","travel exp","fuel exp",
            "waste management","water charges","printing stationary","staff welfare",
            "staff accommodation","incentive","write off",
        ]);
        const incomeCategoryValues = new Set([
            "shoe sales","shirt sales","mixed sales","compensation","advance","balance payable",
            "compensation from cancellation","compensation from product damage",
        ]);
        const inferType = (tx) => {
            const t = (tx.type || "").toLowerCase();
            if (t) return tx.type;
            const c = (tx.category || tx.Category || "").toLowerCase();
            if (expenseCategoryValues.has(c)) return "expense";
            if (incomeCategoryValues.has(c)) return "income";
            return tx.Category || tx.category || "";
        };

        // The endpoint is already scoped to this location and business date.
        // Include every recorded transaction so new income/expense categories
        // affect the daybook without requiring another hard-coded allow-list.
        const mongoTransactions = (dayBookData || []).map(transaction => {
            const isReturn = (transaction.type || "").toLowerCase() === "return";
            const rawSubCat = transaction.subCategory || transaction.SubCategory || transaction.category || "";
            const subCatLabel = isReturn && rawSubCat && !rawSubCat.toLowerCase().endsWith("return")
                ? `${rawSubCat} Return`
                : rawSubCat;
            return {
                ...transaction,
                locCode: currentusers?.locCode,
                date: transaction.date ? transaction.date.split("T")[0] : transaction.date,
                time: transaction.time || (transaction.date && transaction.date.includes("T") ? new Date(transaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase() : "10:34 am"),
                Category: inferType(transaction),
                SubCategory: subCatLabel,
                invoiceNo: transaction.invoiceNo || transaction.invoiceNumber || transaction.invoiceId || transaction.locCode,
                customerName: transaction.customerName || transaction.customer || transaction.custName || "-",
                cash1: transaction.cash,
                bank1: transaction.bank,
                discountAmount: parseInt(transaction.discountAmount || 0),
                billValue: transaction.billValue || transaction.invoiceAmount || transaction.amount || 0,
                Tupi: transaction.upi,
                rbl: transaction.rbl || transaction.rblRazorPay || 0,
                cash: transaction.cash !== undefined ? transaction.cash : transaction.cash1,
                bank: transaction.bank !== undefined ? transaction.bank : transaction.bank1,
                upi: transaction.upi !== undefined ? transaction.upi : transaction.Tupi,
                amount: transaction.amount || (parseInt(transaction.cash || 0) + parseInt(transaction.bank || 0) + parseInt(transaction.upi || 0) + parseInt(transaction.rbl || transaction.rblRazorPay || 0)),
                totalTransaction: transaction.totalTransaction || (parseInt(transaction.cash || 0) + parseInt(transaction.bank || 0) + parseInt(transaction.upi || 0) + parseInt(transaction.rbl || transaction.rblRazorPay || 0)),
                remark: (() => { const r = transaction.remark || transaction.remarks || ""; return (r === "Thanks for your business." || r === "Thanks for your business") ? "" : r; })(),
                remarks: (() => { const r = transaction.remark || transaction.remarks || ""; return (r === "Thanks for your business." || r === "Thanks for your business") ? "-" : (r || "-"); })()
            };
        });

        return {
            booking: bookingTransactions,
            rentOut: rentOutTransactions,
            return: returnOutTransactions,
            cancel: canCelTransactions,
            mongo: mongoTransactions
        };
    }, [data, data1, data2, data3, dayBookData, isDataReady, currentusers?.locCode]);

    const allTransactions = useMemo(() => {
        const combined = [
            ...processedTransactions.booking,
            ...processedTransactions.rentOut,
            ...processedTransactions.return,
            ...processedTransactions.cancel,
            ...processedTransactions.mongo,
        ];

        return combined.map(t => {
            const invoicePart = String(t.invoiceNo || t.locCode || "").trim();
            const categoryPart = (t.Category || t.type || "").toLowerCase();
            const key = `${invoicePart}-${categoryPart}`;
            const override = editedTransactionsMap[key];

            if (override) {
                const isBooking = (t.Category || '').toLowerCase() === 'booking';
                const isReturn  = (t.Category || '').toLowerCase() === 'return';
                const isCancel  = (t.Category || '').toLowerCase() === 'cancel';
                const editedTotal = Number(override.amount || override.totalTransaction || 0);

                return {
                    ...t,
                    _id: override._id || t._id,
                    cash: override.cash !== undefined ? override.cash : t.cash,
                    rbl: override.rbl !== undefined ? override.rbl : t.rbl,
                    bank: override.bank !== undefined ? override.bank : t.bank,
                    upi: override.upi !== undefined ? override.upi : t.upi,
                    securityAmount: override.securityAmount !== undefined ? override.securityAmount : t.securityAmount,
                    Balance: override.Balance !== undefined ? override.Balance : t.Balance,
                    billValue: override.billValue !== undefined ? override.billValue : t.billValue,
                    bookingCashAmount: isBooking ? override.cash : t.bookingCashAmount,
                    bookingBankAmount: isBooking ? override.bank : t.bookingBankAmount,
                    bookingBank1: isBooking ? override.bank : t.bookingBank1,
                    bookingUPIAmount: isBooking ? override.upi : t.bookingUPIAmount,
                    TotaltransactionBooking: isBooking ? editedTotal : t.TotaltransactionBooking,
                    returnCashAmount: isReturn ? override.cash : t.returnCashAmount,
                    returnBankAmount: isReturn ? override.bank : t.returnBankAmount,
                    returnUPIAmount: isReturn ? override.upi : t.returnUPIAmount,
                    returnRblAmount: isReturn ? override.rbl : t.returnRblAmount,
                    deleteCashAmount: isCancel ? -Math.abs(override.cash) : t.deleteCashAmount,
                    deleteBankAmount: isCancel ? -Math.abs(override.bank) : t.deleteBankAmount,
                    deleteUPIAmount: isCancel ? -Math.abs(override.upi) : t.deleteUPIAmount,
                    amount: override.amount || editedTotal,
                    totalTransaction: override.totalTransaction || editedTotal,
                };
            }
            return t;
        });
    }, [processedTransactions, editedTransactionsMap]);

    const dedupedTransactions = useMemo(() => {
        return Array.from(
            new Map(
                allTransactions.map((tx) => {
                    const dateKey = tx.date ? new Date(tx.date).toISOString().split("T")[0] : "";
                    const invoiceKey = tx.invoiceNo || tx._id || tx.locCode || "";
                    const categoryKey = tx.Category || tx.category || "";
                    const key = `${invoiceKey}-${dateKey}-${categoryKey}`;
                    return [key, tx];
                })
            ).values()
        );
    }, [allTransactions]);

    const filteredTransactions = useMemo(() => {
        const selectedCategoryValue = selectedCategory?.value?.toLowerCase() || "all";
        const selectedSubCategoryValue = selectedSubCategory?.value?.toLowerCase() || "all";

        return dedupedTransactions.filter((t) =>
            (selectedCategoryValue === "all" || (t.category?.toLowerCase() === selectedCategoryValue || t.Category?.toLowerCase() === selectedCategoryValue || t.type?.toLowerCase() === selectedCategoryValue)) &&
            (selectedSubCategoryValue === "all" || (t.subCategory?.toLowerCase() === selectedSubCategoryValue || t.SubCategory?.toLowerCase() === selectedSubCategoryValue || t.type?.toLowerCase() === selectedSubCategoryValue || t.subCategory1?.toLowerCase() === selectedSubCategoryValue || t.SubCategory1?.toLowerCase() === selectedSubCategoryValue || t.category?.toLowerCase() === selectedSubCategoryValue))
        );
    }, [dedupedTransactions, selectedCategory?.value, selectedSubCategory?.value]);

    const openingCash = parseInt(preOpen?.cash ?? preOpen?.Closecash ?? 0, 10);

    const calculatedTotals = useMemo(() => calculateDaybookTotals(filteredTransactions, openingCash), [filteredTransactions, openingCash]);
    const closingTotals = useMemo(() => calculateDaybookTotals(dedupedTransactions, openingCash), [dedupedTransactions, openingCash]);

    const totalCalculatedAmount = useMemo(() => {
        return filteredTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    }, [filteredTransactions]);

    const totalCalculatedTxn = useMemo(() => {
        return filteredTransactions.reduce((sum, tx) => sum + (Number(tx.totalTransaction) || 0), 0);
    }, [filteredTransactions]);

    // The opening-balance row is part of the table, so the footer must include
    // it in Amount, Total Transaction, and Cash. It must not affect bill value
    // or any non-cash payment column.
    const totalAmountWithOpening = totalCalculatedAmount + openingCash;
    const totalTransactionWithOpening = totalCalculatedTxn + openingCash;

    const totalCalculatedDiscount = useMemo(() => {
        return filteredTransactions.reduce((sum, tx) => sum + (Number(tx.discountAmount) || 0), 0);
    }, [filteredTransactions]);

    const totalCalculatedBillValue = useMemo(() => {
        return filteredTransactions.reduce((sum, tx) => sum + (Number(tx.billValue != null ? tx.billValue : (tx.invoiceAmount || 0)) || 0), 0);
    }, [filteredTransactions]);

    const handleQuantityChange = useCallback((index, value) => {
        if (preOpen1 != null) return;
        setQuantities(prev => {
            const next = [...prev];
            next[index] = value === "" ? "" : Math.max(0, parseInt(value, 10) || 0);
            return next;
        });
    }, [preOpen1]);

    const incrementQuantity = useCallback((index) => {
        if (preOpen1 != null) return;
        setQuantities(prev => {
            const next = [...prev];
            const currentVal = parseInt(next[index], 10) || 0;
            next[index] = currentVal + 1;
            return next;
        });
    }, [preOpen1]);

    const decrementQuantity = useCallback((index) => {
        if (preOpen1 != null) return;
        setQuantities(prev => {
            const next = [...prev];
            const currentVal = parseInt(next[index], 10) || 0;
            next[index] = Math.max(0, currentVal - 1);
            return next;
        });
    }, [preOpen1]);

    const totalAmount = useMemo(() => {
        return denominations.reduce(
            (sum, denom, index) => sum + (parseInt(quantities[index], 10) || 0) * denom.value,
            0
        );
    }, [quantities]);

    const savedData = useMemo(() => ({
        date,
        locCode,
        email,
        totalCash: closingTotals.totalCash,
        totalAmount,
        totalBankAmount: closingTotals.totalBankAmount
    }), [date, locCode, email, closingTotals.totalCash, totalAmount, closingTotals.totalBankAmount]);

    // Renders the day book print container to a single landscape A4 page and downloads it.
    // Used both for the automatic download after a late save and the manual "Download Report".
    const downloadDaybookPdf = async () => {
        if (!printRef.current) {
            throw new Error("Day book report is not available for download.");
        }

        const [{ default: html2canvas }, jspdfModule] = await Promise.all([
            // html2canvas-pro understands the oklch() colors Tailwind v4 emits; plain html2canvas throws on them.
            import("html2canvas-pro"),
            import("jspdf"),
        ]);
        const JsPDF = jspdfModule.jsPDF || jspdfModule.default;

        const canvas = await html2canvas(printRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            scrollX: 0,
            scrollY: 0,
            windowWidth: 1400,
            ignoreElements: (element) => element.classList?.contains("no-print"),
            onclone: (clonedDocument) => {
                const pdfHeader = clonedDocument.querySelector("[data-pdf-header]");
                if (pdfHeader) pdfHeader.style.display = "flex";
            },
        });

        const pdf = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 5;

        // Scale the whole report down (never up) so it fits on one page, keeping its aspect ratio.
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2;
        const ratio = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
        const imgWidth = canvas.width * ratio;
        const imgHeight = canvas.height * ratio;
        const x = (pageWidth - imgWidth) / 2;
        const y = (pageHeight - imgHeight) / 2;

        pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, imgWidth, imgHeight);
        pdf.save(`DayBook_Close_${currentDate}_${locCode}.pdf`);
    };

    // Runs the PDF export and reports failure through a toast with a retry action.
    // Never throws: callers have already completed their save and must not be failed by a PDF error.
    const runPdfExport = async () => {
        try {
            await downloadDaybookPdf();
            setPdfToast(null);
            return true;
        } catch (pdfError) {
            console.error("Error generating day book PDF:", pdfError);
            setPdfToast({ message: "The PDF could not be generated.", retry: true });
            return false;
        }
    };

    const CreateCashBank = async () => {
        if (!isDataReady || closingDataLoading) {
            alert("Day book figures are still loading. Please try again shortly.");
            return;
        }
        if (selectedCategory?.value !== "all" || selectedSubCategory?.value !== "all") {
            alert("Select All Categories and All Sub Categories before closing the day book.");
            return;
        }
        if (savedData.totalAmount === 0) {
            const confirmed = window.confirm(
                'Physical cash count is 0. Are you sure you want to close the day with zero cash? Click OK to proceed or Cancel to go back and enter the denomination count.'
            );
            if (!confirmed) return;
        }
        setLoading(true);
        try {
            // `status` is sent for clarity only; the server derives it from the date and ignores this value.
            const response = await fetch(apiUrl5, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...savedData, status: isLateClose ? "pending_approval" : "closed" }),
            });

            if (response.status === 401) {
                setLoading(false);
                return alert("Error: Data already saved for this day.");
            } else if (!response.ok) {
                setLoading(false);
                return alert("Error: The day book could not be saved. Please try again.");
            }

            const data = await response.json();
            localStorage.setItem(`denominations_${currentDate}_${locCode}`, JSON.stringify(quantities));

            // Stay on this page: mark it saved, show the outcome, and update the closing figures in place.
            const serverStatus = data?.data?.status;
            setPreOpen1(data?.data ?? { Closecash: totalAmount });
            setSavedFinished(true);
            setSavedMessage(serverStatus === "pending_approval"
                ? "Data saved successfully. This late day book is pending accountant approval."
                : "Data saved successfully.");
            setLoading(false);

            // The PDF is downloaded automatically only after a late save. A failed PDF never fails the save.
            if (isLateClose) {
                await runPdfExport();
            }

        } catch (error) {
            console.error("Error saving data:", error);
            alert("An unexpected error occurred.");
            setLoading(false);
        }
    };

    const GetCreateCashBank = async () => {
        try {
            if (!currentusers?.locCode || !apiUrl6) {
                setPreOpen(null);
                setClosingDataLoading(false);
                return;
            }
            const response = await fetch(apiUrl6, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 404 || response.status === 400) {
                    setPreOpen(null);
                    return;
                }
                throw new Error(`Error fetching opening balance: ${response.status}`);
            }

            const data = await response.json();
            setPreOpen(data?.data);
        } catch (error) {
            console.error("Error fetching opening balance:", error);
            setPreOpen(null);
        } finally {
            setClosingDataLoading(false);
        }
    };

    const takeCreateCashBank = async () => {
        try {
            if (!currentusers?.locCode || !apiUrl7) {
                setPreOpen1(null);
                return;
            }
            const response = await fetch(apiUrl7, { method: 'GET' });
            if (response.status === 404 || response.status === 400) {
                return;
            }
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API ${response.status}: ${text}`);
            }
            const json = await response.json();
            setPreOpen1(json.data);
        } catch (err) {
            console.error("Error fetching closing data:", err);
            if (currentusers?.locCode) {
                setLocalLoadError("Unable to check today's saved closure.");
            }
        }
    };

    useEffect(() => {
        GetCreateCashBank();
        takeCreateCashBank();
        
        const fetchEditedTransactions = async () => {
            if (!currentusers?.locCode) return;
            try {
                const apiUrl = `${baseUrl.baseUrl}api/tws/getEditedTransactions?fromDate=${currentDate}&toDate=${currentDate}&locCode=${currentusers?.locCode}`;
                const res = await fetch(apiUrl);
                const json = await res.json();
                
                const overrideRows = json?.data || [];
                const editedObj = {};
                overrideRows.forEach(row => {
                    const invoicePart = String(row.invoiceNo || row.invoice).trim();
                    const categoryPart = (row.type || row.category || "").toLowerCase();
                    const key = `${invoicePart}-${categoryPart}`;
                    if (invoicePart) {
                        editedObj[key] = {
                            ...row,
                            _id: row._id,
                            invoiceNo: invoicePart,
                            cash: Number(row.cash || 0),
                            rbl: Number(row.rbl || 0),
                            bank: Number(row.bank || 0),
                            upi: Number(row.upi || 0),
                            securityAmount: Number(row.securityAmount || 0),
                            Balance: Number(row.Balance || 0),
                            billValue: Number(row.billValue || row.invoiceAmount || 0),
                            amount: Number(row.amount || 0),
                            totalTransaction: Number(row.totalTransaction || 0),
                        };
                    }
                });
                setEditedTransactionsMap(editedObj);
            } catch (err) {
                console.warn("⚠️ Failed to fetch edited transactions:", err.message);
            }
        };
        
        fetchEditedTransactions();
    }, []);

    const handleEditClick = async (transaction, index) => {
        setIsSyncing(true);

        if (!transaction._id) {
            const cashVal = transaction.cash || transaction.bookingCashAmount || transaction.rentoutCashAmount || 0;
            const rblVal = transaction.rbl || 0;
            const bankVal = transaction.bank || transaction.bookingBankAmount || transaction.rentoutBankAmount || 0;
            const upiVal = transaction.upi || transaction.bookingUPIAmount || transaction.rentoutUPIAmount || 0;
            const totalAmount = Number(cashVal) + Number(rblVal) + Number(bankVal) + Number(upiVal);
            
            const patchedTransaction = {
                invoiceNo: transaction.invoiceNo || transaction.locCode || "",
                customerName: transaction.customerName || "",
                locCode: currentusers?.locCode,
                type: transaction.Category || transaction.type || 'income',
                category: transaction.SubCategory || transaction.category || 'General',
                subCategory: transaction.SubCategory || transaction.category || '',
                paymentMethod: 'cash',
                date: new Date(transaction.date || currentDate),
                cash: String(cashVal),
                rbl: String(rblVal),
                bank: String(bankVal),
                upi: String(upiVal),
                amount: String(totalAmount),
                securityAmount: Number(transaction.securityAmount || 0),
                Balance: Number(transaction.Balance || 0),
                billValue: Number(transaction.billValue || transaction.invoiceAmount || 0),
                totalTransaction: totalAmount,
                editedBy: "000000000000000000000000",
                editedAt: new Date(),
            };

            try {
                const response = await fetch(`${baseUrl.baseUrl}user/syncTransaction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patchedTransaction),
                });

                const result = await response.json();

                if (!response.ok) {
                    alert("❌ Failed to sync transaction.\n" + (result?.error || 'Unknown error'));
                    setIsSyncing(false);
                    return;
                }

                transaction._id = result.data._id;
                filteredTransactions[index]._id = result.data._id;
            } catch (err) {
                alert("❌ Sync error: " + err.message);
                setIsSyncing(false);
                return;
            }
        }

        setEditedTransaction({
            _id: transaction._id,
            cash: transaction.cash || transaction.bookingCashAmount || transaction.rentoutCashAmount || transaction.returnCashAmount || -(transaction.deleteCashAmount) || 0,
            rbl: transaction.rbl || 0,
            bank: transaction.bank || transaction.bookingBankAmount || transaction.rentoutBankAmount || transaction.returnBankAmount || -(transaction.deleteBankAmount) || 0,
            upi: transaction.upi || transaction.bookingUPIAmount || transaction.rentoutUPIAmount || transaction.returnUPIAmount || -(transaction.deleteUPIAmount) || 0,
            securityAmount: transaction.securityAmount || 0,
            Balance: transaction.Balance || 0,
            date: transaction.date || "",
            customerName: transaction.customerName || "",
            invoiceNo: transaction.invoiceNo || transaction.locCode || "",
            Category: transaction.Category || transaction.type || "",
            SubCategory: transaction.SubCategory || transaction.category || "",
            SubCategory1: transaction.SubCategory1 || transaction.subCategory1 || "",
            remark: transaction.remark || "",
            billValue: transaction.billValue || transaction.invoiceAmount || 0,
            totalTransaction: transaction.totalTransaction || transaction.amount || 0,
            amount: transaction.amount || 0
        });

        setEditingIndex(index);
        setIsSyncing(false);
    };

    const handleInputChange = (field, raw) => {
        if (raw === '' || raw === '-') {
            setEditedTransaction(prev => ({ ...prev, [field]: raw }));
            return;
        }

        const numericValue = Number(raw);
        if (isNaN(numericValue)) return;

        setEditedTransaction(prev => {
            const cash = field === 'cash' ? numericValue : Number(prev.cash) || 0;
            const rbl = field === 'rbl' ? numericValue : Number(prev.rbl) || 0;
            const bank = field === 'bank' ? numericValue : Number(prev.bank) || 0;
            const upi = field === 'upi' ? numericValue : Number(prev.upi) || 0;

            const security = field === 'securityAmount'
                ? numericValue
                : Number(prev.securityAmount) || 0;

            const balance = field === 'Balance'
                ? numericValue
                : Number(prev.Balance) || 0;

            const isRentOut = (prev.Category || '').toLowerCase() === 'rentout';
            const splitTotal = security + balance;
            const payTotal = cash + rbl + bank + upi;

            return {
                ...prev,
                [field]: numericValue,
                cash, rbl, bank, upi,
                securityAmount: security,
                Balance: balance,
                amount: isRentOut ? splitTotal : payTotal,
                totalTransaction: isRentOut ? splitTotal : payTotal,
            };
        });
    };

    const handleSave = async () => {
        const {
            _id,
            cash, rbl, bank, upi,
            date,
            invoiceNo = "",
            invoice = "",
            customerName,
            securityAmount,
            Balance,
            paymentMethod,
        } = editedTransaction;

        if (!_id) {
            alert("❌ Cannot update: missing transaction ID.");
            return;
        }

        try {
            const numSec = Number(securityAmount) || 0;
            const numBal = Number(Balance) || 0;

            let adjCash = Number(cash) || 0;
            let adjRbl = Number(rbl) || 0;
            let adjBank = Number(bank) || 0;
            let adjUpi = Number(upi) || 0;

            const negRow = ["return", "cancel"].includes(
                (editedTransaction.Category || "").toLowerCase()
            );
            if (negRow) {
                adjCash = -Math.abs(adjCash);
                adjRbl = -Math.abs(adjRbl);
                adjBank = -Math.abs(adjBank);
                adjUpi = -Math.abs(adjUpi);
            }

            const isRentOut = editedTransaction.Category === "RentOut";
            const originalBillValue = editedTransaction.billValue;
            const computedTotal = isRentOut
                ? numSec + numBal
                : adjCash + adjRbl + adjBank + adjUpi;

            const paySum = adjCash + adjRbl + adjBank + adjUpi;
            if (!isRentOut && paySum !== computedTotal) {
                if (adjCash !== 0) { adjCash = computedTotal; adjRbl = adjBank = adjUpi = 0; }
                else if (adjRbl !== 0) { adjRbl = computedTotal; adjCash = adjBank = adjUpi = 0; }
                else if (adjBank !== 0) { adjBank = computedTotal; adjCash = adjRbl = adjUpi = 0; }
                else { adjUpi = computedTotal; adjCash = adjRbl = adjBank = 0; }
            }

            const payload = {
                cash: adjCash,
                rbl: adjRbl,
                bank: adjBank,
                upi: adjUpi,
                date,
                invoiceNo: invoiceNo || invoice,
                customerName: customerName || "",
                paymentMethod,
                securityAmount: numSec,
                Balance: numBal,
                billValue: originalBillValue,
                amount: computedTotal,
                totalTransaction: computedTotal,
                type: editedTransaction.Category || "RentOut",
                category: editedTransaction.SubCategory || "Security",
                subCategory1: editedTransaction.SubCategory1 || "Balance Payable",
            };

            const res = await fetch(`${baseUrl.baseUrl}user/editTransaction/${_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (!res.ok) {
                alert("❌ Update failed: " + (json?.message || "Unknown error"));
                return;
            }
            alert("✅ Transaction updated.");
            
            const updatedRow = {
                _id,
                invoiceNo: invoiceNo || invoice,
                cash: adjCash,
                rbl: adjRbl,
                bank: adjBank,
                upi: adjUpi,
                securityAmount: numSec,
                Balance: numBal,
                billValue: originalBillValue,
                amount: computedTotal,
                totalTransaction: computedTotal,
            };
            
            const key = `${String(invoiceNo || invoice).trim()}-${(editedTransaction.Category || '').toLowerCase()}`;
            setEditedTransactionsMap(prev => ({
                ...prev,
                [key]: updatedRow
            }));
            
            setEditingIndex(null);
            setEditedTransaction({});

        } catch (err) {
            console.error("Update error:", err);
            alert("❌ Update failed: " + err.message);
        }
    };

    useEnterToSave(() => {
        if (editingIndex !== null) {
            handleSave();
        }
    }, editingIndex === null);

    const csvData = filteredTransactions.map(transaction => ({
      ...transaction,
      SubCategory: getCatLabel(transaction.SubCategory || transaction.subCategory || transaction.category || ""),
      cash:
        -(parseInt(transaction.deleteCashAmount)) ||
        parseInt(transaction.rentoutCashAmount) ||
        parseInt(transaction.bookingCashAmount) ||
        parseInt(transaction.returnCashAmount) ||
        parseInt(transaction.cash1) || 0,
      rbl: parseInt(transaction.rbl) || 0,
      bank:
        parseInt(transaction.rentoutBankAmount) ||
        parseInt(transaction.bookingBank1) ||
        parseInt(transaction.returnBankAmount) ||
        parseInt(transaction.deleteBankAmount) * -1 ||
        parseInt(transaction.bank1) || 0,
      upi:
        parseInt(transaction.rentoutUPIAmount) ||
        parseInt(transaction.bookingUPIAmount) ||
        parseInt(transaction.returnUPIAmount) ||
        parseInt(transaction.deleteUPIAmount) * -1 ||
        parseInt(transaction.Tupi) || 0,
    }));

    const isDaybookClosed = preOpen1 != null;

    const handleDownloadReport = () => {
        if (isDaybookClosed) runPdfExport();
    };

    const physicalCash = preOpen1?.Closecash != null ? preOpen1.Closecash : totalAmount;
    const difference = physicalCash - calculatedTotals.totalCash;

    if (lockLoading) return <div className="p-8 text-center">Verifying daybook status...</div>;
    if (freezeReason) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
                <div className="max-w-md rounded-2xl border-t-4 border-red-500 bg-white p-8 text-center shadow-xl">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {freezeReason === "missing_yesterday"
                            ? "Day Book Frozen — yesterday's day book is not closed"
                            : freezeReason === "pending_approval"
                                ? "Day Book Frozen — late closure pending approval"
                                : "Day Book Frozen"}
                    </h1>
                    <p className="mt-4 text-gray-600">
                        {freezeReason === "missing_yesterday"
                            ? "Close yesterday's day book now. It will be sent for accountant approval."
                            : freezeReason === "pending_approval"
                                ? "Yesterday's late day book closure is awaiting accountant approval. This page unfreezes once it is approved."
                                : "Daybook status could not be checked. Please try again."}
                    </p>
                    <button
                        type="button"
                        onClick={() => freezeReason === "missing_yesterday"
                            ? window.location.assign(`/?closeDate=${yesterday}`)
                            : window.location.reload()}
                        className="mt-6 rounded-lg bg-purple-600 px-5 py-2.5 font-semibold text-white"
                    >
                        {freezeReason === "missing_yesterday" ? "Close Yesterday's Day Book" : "Check Status Again"}
                    </button>
                </div>
            </div>
        );
    }
    if ((daybookLoadError || localLoadError) && currentusers?.locCode) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
                    <h1 className="text-xl font-bold">Day book could not be loaded</h1>
                    <p className="mt-3 text-gray-600">{localLoadError || daybookLoadError}</p>
                    <button type="button" onClick={() => window.location.reload()}
                        className="mt-5 rounded-lg bg-purple-600 px-5 py-2.5 text-white">Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div>
                <style>{`
                    @media print {
                        @page {
                            size: tabloid landscape;
                            margin: 5mm;
                        }
                        * {
                            box-sizing: border-box !important;
                        }
                        body { 
                            font-family: Arial, sans-serif !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                        }
                        .no-print { display: none !important; }
                        nav, header, aside, .sidebar { display: none !important; }
                        .ml-\\[240px\\] { margin-left: 0 !important; width: 100% !important; }
                        table { 
                            width: 100% !important; 
                            border-collapse: collapse !important; 
                            font-size: 9px !important;
                        }
                        th, td { 
                            border: 1px solid #000 !important; 
                            padding: 4px 6px !important; 
                        }
                        th { 
                            background-color: #18181b !important; 
                            color: white !important;
                        }
                    }
                `}</style>
                
                <Headers title={"Day Book"} />

                <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
                    {/* Clean Page Title Header */}
                    <div className="bg-white px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between no-print">
                        <h1 className="text-[18px] font-semibold text-[#212121]">Day Book</h1>
                    </div>

                    <div className="px-8 py-6 bg-[#FFFFFF] min-h-screen">

                        {isLateClose && (
                            <div className="no-print mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                <span className="font-semibold">Closing yesterday</span> — {displayFormattedDate}. This late closure will be sent for accountant approval.
                            </div>
                        )}

                        {(savedFinished || isDaybookClosed) && (
                            <div className="no-print mb-4 flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold uppercase text-white">Saved &amp; Finished</span>
                                <span>{savedMessage || "Data saved successfully."}</span>
                            </div>
                        )}

                        {pdfToast && (
                            <div role="alert" className="no-print fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
                                <span>{pdfToast.message}</span>
                                <button type="button" onClick={runPdfExport} className="rounded bg-purple-500 px-3 py-1 font-semibold hover:bg-purple-400">Retry</button>
                                <button type="button" onClick={() => setPdfToast(null)} className="text-gray-300 hover:text-white">Dismiss</button>
                            </div>
                        )}

                        {/* Top Section: Category Filters & Date */}
                        <div className="mb-5 flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
                            {/* Left Filters */}
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="w-[190px] sm:w-[210px]">
                                    <label className="rf-field-label !text-[#6A6A6A]">Category</label>
                                    <Select
                                        classNamePrefix="rf-select"
                                        options={categories}
                                        value={selectedCategory}
                                        onChange={setSelectedCategory}
                                        styles={appSelectStyles}
                                        isSearchable={false}
                                    />
                                </div>
                                <div className="w-[190px] sm:w-[210px]">
                                    <label className="rf-field-label !text-[#6A6A6A]">Sub Category</label>
                                    <Select
                                        classNamePrefix="rf-select"
                                        options={subCategories}
                                        value={selectedSubCategory}
                                        onChange={setSelectedSubCategory}
                                        styles={appSelectStyles}
                                        isSearchable={false}
                                    />
                                </div>
                            </div>

                            {/* Right Date Display */}
                            <div className="text-right">
                                <span className="block text-[11px] font-medium text-[#6A6A6A] mb-0.5">Date</span>
                                <span className="text-[14px] font-semibold text-[#212121]">{displayFormattedDate}</span>
                            </div>
                        </div>

                        <div ref={printRef} id="daybook-print-report">
                            <div
                                data-pdf-header
                                className="hidden items-end justify-between border-b border-gray-300 mb-5 pb-3"
                            >
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">Day Book Report</h1>
                                    <p className="mt-1 text-xs text-gray-500">Location: {locCode || "-"}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs font-semibold text-gray-500">Date</span>
                                    <span className="text-sm font-bold text-gray-900">{displayFormattedDate}</span>
                                </div>
                            </div>
                            {/* Main Transactions Table */}
                            <div className="bg-white border border-[#E5E5E5] rounded-none overflow-hidden mb-7">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[1200px]">
                                        <thead>
                                            <tr className="bg-[#1B1B1B] text-white h-[38px]">
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">TIME</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">INVOICE NO.</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">CUSTOMER NAME</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">CATEGORY</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">SUB CATEGORY</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">REMARKS</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider text-right whitespace-nowrap">AMOUNT</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider text-right whitespace-nowrap">TOTAL TXN</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider text-right whitespace-nowrap">DISCOUNT</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider text-right whitespace-nowrap">BILL VALUE</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider text-right whitespace-nowrap">CASH</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider text-right whitespace-nowrap">RAZORPAY</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider text-right whitespace-nowrap">CARD/BANK</th>
                                                <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider text-right whitespace-nowrap">UPI</th>
                                                {showAction && <th className="h-[38px] px-3.5 text-[11px] font-semibold uppercase tracking-wider text-center whitespace-nowrap">ACTION</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#EFEFEF] text-[13px]">
                                            {/* Special Row: OPENING BALANCE */}
                                            <tr className="bg-[#FAFAFA] font-medium text-[#212121] h-[44px] hover:bg-[#FBF5FC] transition-colors border-b border-[#EFEFEF]">
                                                <td colSpan="6" className="h-[44px] px-3.5 font-semibold text-[12px] uppercase tracking-wider text-[#212121] border-r border-[#F3F3F3]">
                                                    OPENING BALANCE
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right font-medium text-[#212121] border-r border-[#F3F3F3] tabular-nums">
                                                    {preOpen?.cash ?? preOpen?.Closecash ?? 0}
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right font-medium text-[#212121] border-r border-[#F3F3F3] tabular-nums">
                                                    {preOpen?.cash ?? preOpen?.Closecash ?? 0}
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right text-[#6A6A6A] border-r border-[#F3F3F3]">-</td>
                                                <td className="h-[44px] px-3.5 text-right text-[#6A6A6A] border-r border-[#F3F3F3]">-</td>
                                                <td className="h-[44px] px-3.5 text-right font-medium text-[#212121] border-r border-[#F3F3F3] tabular-nums">
                                                    {preOpen?.cash ?? preOpen?.Closecash ?? 0}
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right text-[#6A6A6A] border-r border-[#F3F3F3]">-</td>
                                                <td className="h-[44px] px-3.5 text-right text-[#6A6A6A] border-r border-[#F3F3F3]">-</td>
                                                <td className="h-[44px] px-3.5 text-right text-[#6A6A6A]">-</td>
                                                {showAction && <td className="h-[44px] px-3.5 border-l border-[#F3F3F3]"></td>}
                                            </tr>

                                            {/* Data Rows */}
                                            {filteredTransactions.length > 0 ? (
                                                filteredTransactions.map((tx, idx) => {
                                                    const isEditing = editingIndex === idx;
                                                    const displayTime = tx.time || "10:34 am";
                                                    const displayInvoice = tx.invoiceNo || tx.locCode || "-";
                                                    const displayCustomer = tx.customerName || "-";
                                                    const displayCategory = tx.Category || tx.type || tx.category || "-";
                                                    const displaySubCategory = getCatLabel(tx.SubCategory || tx.subCategory || "-");
                                                    const displayRemarks = tx.remarks || tx.remark || "-";
                                                    const displayAmount = tx.amount != null ? tx.amount : 0;
                                                    const displayTotalTxn = tx.totalTransaction != null ? tx.totalTransaction : 0;
                                                    const displayDiscount = tx.discountAmount ? tx.discountAmount : "-";
                                                    const displayBillValue = tx.billValue != null ? tx.billValue : (tx.invoiceAmount || "-");
                                                    const displayCash = tx.cash != null ? tx.cash : 0;
                                                    const displayRazorpay = tx.rbl != null ? tx.rbl : 0;
                                                    const displayBank = tx.bank != null ? tx.bank : 0;
                                                    const displayUpi = tx.upi != null ? tx.upi : 0;

                                                    return (
                                                        <tr key={tx._id || idx} className="h-[46px] bg-white hover:bg-[#FBF5FC] transition-colors text-[#212121]">
                                                            <td className="h-[46px] px-3.5 text-[13px] text-[#4A4A4A] border-r border-[#F3F3F3] whitespace-nowrap">{displayTime}</td>
                                                            <td className="h-[46px] px-3.5 text-[13px] text-[#212121] border-r border-[#F3F3F3] whitespace-nowrap">{displayInvoice}</td>
                                                            <td className="h-[46px] px-3.5 text-[13px] text-[#212121] border-r border-[#F3F3F3] whitespace-nowrap">{displayCustomer}</td>
                                                            <td className="h-[46px] px-3.5 text-[13px] text-[#4A4A4A] border-r border-[#F3F3F3] whitespace-nowrap">{displayCategory}</td>
                                                            <td className="h-[46px] px-3.5 text-[13px] text-[#4A4A4A] border-r border-[#F3F3F3] whitespace-nowrap">{displaySubCategory}</td>
                                                            <td className="h-[46px] px-3.5 text-[13px] text-[#6A6A6A] border-r border-[#F3F3F3] max-w-[160px] truncate">{displayRemarks}</td>
                                                            <td className="h-[46px] px-3.5 text-[13px] text-right font-medium border-r border-[#F3F3F3] whitespace-nowrap tabular-nums">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editedTransaction.amount}
                                                                        onChange={(e) => handleInputChange("amount", e.target.value)}
                                                                        className="w-20 p-1 border border-[#E5E5E5] rounded-[6px] text-xs text-right outline-none focus:border-[#9B48D7]"
                                                                    />
                                                                ) : displayAmount}
                                                            </td>
                                                            <td className="h-[46px] px-3.5 text-[13px] text-right font-medium border-r border-[#F3F3F3] whitespace-nowrap tabular-nums">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editedTransaction.totalTransaction}
                                                                        onChange={(e) => handleInputChange("totalTransaction", e.target.value)}
                                                                        className="w-20 p-1 border border-[#E5E5E5] rounded-[6px] text-xs text-right outline-none focus:border-[#9B48D7]"
                                                                    />
                                                                ) : displayTotalTxn}
                                                            </td>
                                                            <td className="h-[46px] px-3.5 text-right text-[13px] text-[#6A6A6A] border-r border-[#F3F3F3] whitespace-nowrap">
                                                                {displayDiscount}
                                                            </td>
                                                            <td className="h-[46px] px-3.5 text-right font-medium text-[13px] border-r border-[#F3F3F3] whitespace-nowrap tabular-nums">
                                                                {displayBillValue}
                                                            </td>
                                                            <td className="h-[46px] px-3.5 text-right font-medium text-[13px] border-r border-[#F3F3F3] whitespace-nowrap tabular-nums">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editedTransaction.cash}
                                                                        onChange={(e) => handleInputChange("cash", e.target.value)}
                                                                        className="w-16 p-1 border border-[#E5E5E5] rounded-[6px] text-xs text-right outline-none focus:border-[#9B48D7]"
                                                                        aria-label="Cash amount"
                                                                    />
                                                                ) : displayCash}
                                                            </td>
                                                            <td className="h-[46px] px-3.5 text-right font-medium text-[13px] border-r border-[#F3F3F3] whitespace-nowrap tabular-nums">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editedTransaction.rbl}
                                                                        onChange={(e) => handleInputChange("rbl", e.target.value)}
                                                                        className="w-16 p-1 border border-[#E5E5E5] rounded-[6px] text-xs text-right outline-none focus:border-[#9B48D7]"
                                                                        aria-label="Razorpay amount"
                                                                    />
                                                                ) : displayRazorpay}
                                                            </td>
                                                            <td className="h-[46px] px-3.5 text-right font-medium text-[13px] border-r border-[#F3F3F3] whitespace-nowrap tabular-nums">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editedTransaction.bank}
                                                                        onChange={(e) => handleInputChange("bank", e.target.value)}
                                                                        className="w-16 p-1 border border-[#E5E5E5] rounded-[6px] text-xs text-right outline-none focus:border-[#9B48D7]"
                                                                        aria-label="Card or bank amount"
                                                                    />
                                                                ) : displayBank}
                                                            </td>
                                                            <td className="h-[46px] pl-3.5 pr-6 text-right font-medium text-[13px] whitespace-nowrap tabular-nums">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editedTransaction.upi}
                                                                        onChange={(e) => handleInputChange("upi", e.target.value)}
                                                                        className="w-16 p-1 border border-[#E5E5E5] rounded-[6px] text-xs text-right outline-none focus:border-[#9B48D7]"
                                                                        aria-label="UPI amount"
                                                                    />
                                                                ) : displayUpi}
                                                            </td>
                                                            {showAction && (
                                                                <td className="py-3 px-3 text-center border-l border-[#F3F3F3] whitespace-nowrap">
                                                                    {isEditing ? (
                                                                        <button
                                                                            onClick={handleSave}
                                                                            className="bg-emerald-600 text-white px-2.5 py-1 rounded-md text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                                                                        >
                                                                            Save
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleEditClick(tx, idx)}
                                                                            className="bg-[#1B1B1B] text-white px-2.5 py-1 rounded-md text-xs font-semibold hover:bg-black cursor-pointer"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={showAction ? 15 : 14} className="py-12 text-center text-[#A3A3A3] text-[13px]">
                                                        No transactions found
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-[#DCDCDC] text-[#212121] font-semibold h-[44px] border-t border-[#D4D4D4]">
                                                <td colSpan="6" className="h-[44px] px-3.5 font-semibold text-[12px] uppercase tracking-wider">
                                                    TOTAL
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right text-[13px] font-semibold tabular-nums">
                                                    {totalAmountWithOpening}
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right text-[13px] font-semibold tabular-nums">
                                                    {totalTransactionWithOpening}
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right text-[#6A6A6A]">
                                                    {totalCalculatedDiscount > 0 ? totalCalculatedDiscount : "-"}
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right text-[13px] font-semibold tabular-nums">
                                                    {totalCalculatedBillValue > 0 ? totalCalculatedBillValue : "-"}
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right text-[13px] font-semibold tabular-nums">
                                                    {calculatedTotals.totalCash}
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right text-[13px] font-semibold tabular-nums">
                                                    {calculatedTotals.totalRblAmount}
                                                </td>
                                                <td className="h-[44px] px-3.5 text-right text-[13px] font-semibold tabular-nums">
                                                    {calculatedTotals.totalBankAmount1}
                                                </td>
                                                <td className="h-[44px] pl-3.5 pr-6 text-right text-[13px] font-semibold tabular-nums">
                                                    {calculatedTotals.totalBankAmountupi}
                                                </td>
                                                {showAction && <td className="h-[44px] px-3.5"></td>}
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Bottom 2-Column Section: Physical Denomination Count & Cash Summary */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                                {/* Left Box: Denomination Count */}
                                <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
                                    <div className="bg-[#1B1B1B] text-white px-6 h-[40px] flex justify-between items-center">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider w-1/3 text-center">DENOMINATION</span>
                                        <span className="text-[11px] font-semibold uppercase tracking-wider w-1/3 text-center">QUANTITY</span>
                                        <span className="text-[11px] font-semibold uppercase tracking-wider w-1/3 text-center">AMOUNT</span>
                                    </div>

                                    <div className="divide-y divide-[#EFEFEF]">
                                        {denominations.map((denom, index) => {
                                            const amt = (parseInt(quantities[index], 10) || 0) * denom.value;
                                            return (
                                                <div key={denom.label} className="px-6 py-3 flex justify-between items-center hover:bg-[#FBF5FC] transition-colors">
                                                    <span className="text-[13px] font-medium text-[#4A4A4A] w-1/3 text-center">{denom.label}</span>
                                                    <div className="w-1/3 flex justify-center">
                                                        <div className="inline-flex items-center border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
                                                            <button
                                                                type="button"
                                                                onClick={() => decrementQuantity(index)}
                                                                disabled={preOpen1 != null}
                                                                className="w-8 h-8 flex items-center justify-center text-[#6A6A6A] hover:text-[#212121] hover:bg-[#F7F7F7] transition-colors border-r border-[#E5E5E5] disabled:opacity-40 cursor-pointer"
                                                            >
                                                                <Minus size={13} />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={quantities[index]}
                                                                onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                                readOnly={preOpen1 != null}
                                                                placeholder="0"
                                                                className="w-12 h-8 text-center text-[13px] font-medium text-[#212121] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => incrementQuantity(index)}
                                                                disabled={preOpen1 != null}
                                                                className="w-8 h-8 flex items-center justify-center text-[#6A6A6A] hover:text-[#212121] hover:bg-[#F7F7F7] transition-colors border-l border-[#E5E5E5] disabled:opacity-40 cursor-pointer"
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <span className="text-[13px] font-semibold text-[#212121] w-1/3 text-center tabular-nums">
                                                        {amt.toFixed(2)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Physical Total Footer */}
                                    <div className="bg-[#DCDCDC] px-6 py-3.5 flex justify-between items-center border-t border-[#D4D4D4]">
                                        <span className="text-[13px] font-semibold text-[#212121] w-1/3 text-center">Physical Total</span>
                                        <span className="w-1/3" />
                                        <span className="text-[14px] font-bold text-[#212121] w-1/3 text-center tabular-nums">
                                            {totalAmount.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Right Box: Cash Summary Card */}
                                <div className="lg:col-span-5 bg-white border border-[#212121]/75 rounded-xl p-6 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-[17px] font-semibold text-[#212121] mb-5">Cash Summary</h3>
                                        <div className="space-y-3.5">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[13px] text-[#6A6A6A] font-medium">Closing Cash</span>
                                                <span className="text-[15px] font-semibold text-[#212121] tabular-nums">
                                                    {calculatedTotals.totalCash.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[13px] text-[#6A6A6A] font-medium">Physical Cash</span>
                                                <span className="text-[15px] font-semibold text-[#212121] tabular-nums">
                                                    {physicalCash.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="border-t border-dashed border-[#E5E5E5] my-3" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-[13px] font-semibold text-[#212121]">Difference</span>
                                                <span className={`text-[15px] font-semibold tabular-nums ${
                                                    difference < 0 ? "text-[#DC2626]" : "text-[#16A34A]"
                                                }`}>
                                                    {difference.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between gap-4 mt-7 no-print">
                                        <button
                                            type="button"
                                            onClick={handleDownloadReport}
                                            disabled={!isDaybookClosed}
                                            title={!isDaybookClosed ? "Close the day book before downloading the report" : "Download day book report"}
                                            className="rf-btn-cancel !px-5 !py-2.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Download Report
                                        </button>

                                        {loading || !isDataReady || closingDataLoading ? (
                                            <button
                                                disabled
                                                className="rf-btn-disabled !px-5 !py-2.5 flex items-center justify-center gap-2"
                                            >
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                <span>{loading ? "Saving..." : "Loading day book..."}</span>
                                            </button>
                                        ) : preOpen1 == null && !stabilized ? (
                                            <button
                                                disabled
                                                className="rf-btn-disabled !px-5 !py-2.5 text-center"
                                            >
                                                Stabilizing…
                                            </button>
                                        ) : preOpen1 == null ? (
                                            <button
                                                type="button"
                                                onClick={CreateCashBank}
                                                className="rf-btn-primary !px-5 !py-2.5 cursor-pointer"
                                            >
                                                {isLateClose ? "Save & Finish Day (Late)" : "Save & Finish Day"}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handlePrint}
                                                className="rf-btn-primary !px-5 !py-2.5 cursor-pointer"
                                            >
                                                Print Summary
                                            </button>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Hidden CSV link for download trigger */}
                        <div className="hidden">
                            <CSVLink
                                ref={csvLinkRef}
                                data={csvData}
                                headers={headers}
                                filename={`${currentDate} DayBook report.csv`}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
};

export default DayBookInc;
