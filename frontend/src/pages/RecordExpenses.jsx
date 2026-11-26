import { useCallback, useEffect, useMemo, useState } from "react";
import { CSVLink } from "react-csv";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Download,
  Menu,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import baseUrl from "../api/api";
import { useSidebar } from "../hooks/useSidebar.js";
import { useActiveStores } from "../utils/storeService.js";
import { filterAdminOnlyTransactions } from "../utils/adminTransactionVisibility.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";

const toDateInput = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getInitialDates = () => {
  const now = new Date();
  return {
    from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateInput(now),
  };
};

const cleanRemark = (remark) => {
  const cleaned = String(remark || "")
    .replace(/^\[(DIRECT|INDIRECT)[^\]]*\]\s*/i, "")
    .trim();
  return cleaned || "-";
};

const getExpenseType = (transaction) => {
  const explicit = String(transaction.expenseType || "").toLowerCase();
  if (explicit === "direct" || explicit === "indirect") return explicit;
  return /\[DIRECT/i.test(transaction.remark || "") ? "direct" : "indirect";
};

const formatAmount = (value) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(Number(value) || 0));

export default function RecordExpenses() {
  const isSidebarOpen = useSidebar();
  const navigate = useNavigate();
  const { stores } = useActiveStores();
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("rootfinuser")) || {},
    []
  );

  const role = String(currentUser.role || "").toLowerCase();
  const power = String(currentUser.power || "").toLowerCase();
  const canSelectStore =
    power === "admin" || ["admin", "superadmin", "financial_head"].includes(role);
  const initialDates = useMemo(getInitialDates, []);

  const visibleStores = useMemo(() => {
    const byCode = new Map(
      stores
        .filter((store) => store?.locCode)
        .map((store) => [String(store.locCode), {
          locCode: String(store.locCode),
          locName: store.locName || store.name || String(store.locCode),
        }])
    );
    const assignedCode = String(currentUser.locCode || "").trim();
    if (assignedCode && !byCode.has(assignedCode)) {
      byCode.set(assignedCode, {
        locCode: assignedCode,
        locName:
          currentUser.storeName ||
          currentUser.locName ||
          currentUser.username ||
          `Store #${assignedCode}`,
      });
    }
    return [...byCode.values()];
  }, [
    currentUser.locCode,
    currentUser.locName,
    currentUser.storeName,
    currentUser.username,
    stores,
  ]);

  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo, setDateTo] = useState(initialDates.to);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState(
    canSelectStore ? "all" : String(currentUser.locCode || "")
  );
  const [selectedExpenseType, setSelectedExpenseType] = useState("all");
  const [selectedPaymentType, setSelectedPaymentType] = useState("all");
  const [showFilters, setShowFilters] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getBranchName = useCallback(
    (locCode) => {
      const store = visibleStores.find(
        (item) => String(item.locCode) === String(locCode)
      );
      return store?.locName || (locCode ? `Store #${locCode}` : "-");
    },
    [visibleStores]
  );

  const fetchExpenses = useCallback(
    async (overrides = {}) => {
      const requestedFrom = overrides.dateFrom || dateFrom;
      const requestedTo = overrides.dateTo || dateTo;
      const requestedStore =
        overrides.selectedStore ??
        (canSelectStore ? selectedStore : String(currentUser.locCode || ""));

      if (!requestedFrom || !requestedTo || requestedFrom > requestedTo) {
        setError("Choose a valid date range.");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          LocCode: requestedStore || "all",
          DateFrom: requestedFrom,
          DateTo: requestedTo,
        });
        const response = await fetch(
          `${baseUrl.baseUrl}user/Getpayment?${params.toString()}`
        );
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.message || "Unable to load expense records.");
        }
        const rows = Array.isArray(json) ? json : json?.data || [];
        setTransactions(
          filterAdminOnlyTransactions(rows, currentUser).filter(
            (transaction) =>
              String(transaction.type || "").toLowerCase() === "expense"
          )
        );
      } catch (fetchError) {
        console.error("Error fetching expense data:", fetchError);
        setError(fetchError.message || "Unable to load expense records.");
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    },
    [
      canSelectStore,
      currentUser.locCode,
      dateFrom,
      dateTo,
      selectedStore,
    ]
  );

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const filteredTransactions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return transactions.filter((transaction) => {
      if (
        term &&
        ![
          transaction.category,
          transaction.remark,
          transaction.invoiceNo,
          transaction.bankAccount,
          getBranchName(transaction.locCode),
        ].some((value) => String(value || "").toLowerCase().includes(term))
      ) {
        return false;
      }
      if (
        selectedStore !== "all" &&
        String(transaction.locCode) !== String(selectedStore)
      ) {
        return false;
      }
      if (
        selectedExpenseType !== "all" &&
        getExpenseType(transaction) !== selectedExpenseType
      ) {
        return false;
      }
      if (
        selectedPaymentType !== "all" &&
        String(transaction.paymentMethod || "cash").toLowerCase() !==
          selectedPaymentType
      ) {
        return false;
      }
      return true;
    });
  }, [
    getBranchName,
    searchTerm,
    selectedExpenseType,
    selectedPaymentType,
    selectedStore,
    transactions,
  ]);

  const csvData = useMemo(
    () =>
      filteredTransactions.map((transaction) => ({
        Date: String(transaction.date || "").split("T")[0],
        "Expense Category": transaction.category || "",
        Branch: getBranchName(transaction.locCode),
        "Expense Type":
          getExpenseType(transaction) === "direct" ? "Direct" : "Indirect",
        "Payment Method": transaction.paymentMethod || "cash",
        "Bank Account": transaction.bankAccount || "",
        Amount: Math.abs(Number(transaction.amount) || 0),
        Remarks: cleanRemark(transaction.remark),
        "Invoice No": transaction.invoiceNo || "",
      })),
    [filteredTransactions, getBranchName]
  );

  const resetFilters = () => {
    const dates = getInitialDates();
    setDateFrom(dates.from);
    setDateTo(dates.to);
    setSearchTerm("");
    setSelectedStore(canSelectStore ? "all" : String(currentUser.locCode || ""));
    setSelectedExpenseType("all");
    setSelectedPaymentType("all");
    fetchExpenses({
      dateFrom: dates.from,
      dateTo: dates.to,
      selectedStore: canSelectStore ? "all" : String(currentUser.locCode || ""),
    });
  };

  return (
    <>
      <Helmet>
        <title>Record Expense | RootFin</title>
      </Helmet>

      <main
        className={`min-h-screen bg-[#fafafb] transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
        <div className="w-full px-5 py-7 sm:px-8 lg:px-12">
          <Breadcrumbs currentTitle="Record Expense" className="mb-4" />
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("toggle-sidebar"))
                }
                className="rounded-xl border border-gray-200 bg-white p-3 text-slate-700 shadow-sm transition hover:bg-slate-50"
                aria-label="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
              <div className="relative w-full sm:w-80">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search expenses"
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <CSVLink
                data={csvData}
                filename={`expense-records-${dateFrom}-to-${dateTo}.csv`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <Download size={17} />
                Download CSV
              </CSVLink>
              <button
                type="button"
                onClick={() => navigate("/direct-expenses")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18181b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
              >
                <Plus size={18} />
                New Expense
              </button>
            </div>
          </div>

          <section className="mb-7">
            <div className="flex flex-wrap items-end gap-4">
              <label className="space-y-1.5 text-xs font-medium text-slate-500">
                From Date
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="block rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-purple-500"
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-500">
                To Date
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="block rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-purple-500"
                />
              </label>
              <button
                type="button"
                onClick={() => fetchExpenses()}
                disabled={loading}
                className="h-[42px] rounded-xl bg-[#9b48d7] px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8735c3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Fetching..." : "Fetch Data"}
              </button>
              <CSVLink
                data={csvData}
                filename={`expense-records-${dateFrom}-to-${dateTo}.csv`}
                className="inline-flex h-[42px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download size={16} />
                CSV
              </CSVLink>
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className={`inline-flex h-[42px] items-center gap-2 rounded-xl px-5 text-sm font-medium shadow-sm transition ${
                  showFilters
                    ? "bg-slate-200 text-slate-800"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Filters
                <SlidersHorizontal size={16} />
              </button>
            </div>

            {showFilters && (
              <div className="mt-6 flex flex-wrap items-end justify-end gap-3">
                <label className="space-y-1.5 text-[11px] font-medium text-slate-500">
                  Store
                  <span className="relative block">
                    <select
                      value={selectedStore}
                      onChange={(event) => setSelectedStore(event.target.value)}
                      disabled={!canSelectStore}
                      className="min-w-40 appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 disabled:bg-slate-50"
                    >
                      {canSelectStore && <option value="all">All Stores</option>}
                      {visibleStores.map((store) => (
                        <option key={store.locCode} value={store.locCode}>
                          {store.locName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </span>
                </label>

                <label className="space-y-1.5 text-[11px] font-medium text-slate-500">
                  Expense Type
                  <span className="relative block">
                    <select
                      value={selectedExpenseType}
                      onChange={(event) =>
                        setSelectedExpenseType(event.target.value)
                      }
                      className="min-w-36 appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-xs font-medium text-slate-700 outline-none focus:border-purple-500"
                    >
                      <option value="all">All Types</option>
                      <option value="direct">Direct</option>
                      <option value="indirect">Indirect</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </span>
                </label>

                <label className="space-y-1.5 text-[11px] font-medium text-slate-500">
                  Payment Type
                  <span className="relative block">
                    <select
                      value={selectedPaymentType}
                      onChange={(event) =>
                        setSelectedPaymentType(event.target.value)
                      }
                      className="min-w-32 appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-xs font-medium text-slate-700 outline-none focus:border-purple-500"
                    >
                      <option value="all">All</option>
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="upi">UPI</option>
                      <option value="split">Split</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </span>
                </label>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl border border-gray-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50"
                  title="Reset filters"
                  aria-label="Reset filters"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            )}
          </section>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[1450px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#333] text-[11px] font-semibold uppercase tracking-wide text-white">
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Expense Category</th>
                    <th className="px-5 py-4">Branch</th>
                    <th className="px-5 py-4 text-center">Expense Type</th>
                    <th className="px-5 py-4">Attachment</th>
                    <th className="px-5 py-4">Payment Method</th>
                    <th className="px-5 py-4">Bank Account</th>
                    <th className="px-5 py-4 text-right">Amount</th>
                    <th className="px-5 py-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center text-slate-400">
                        Loading expense records...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center text-slate-400">
                        No expense records found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((transaction, index) => {
                      const type = getExpenseType(transaction);
                      const attachmentUrl =
                        transaction.hasAttachment && transaction._id
                          ? `${baseUrl.baseUrl}user/transaction/${transaction._id}/attachment`
                          : "";
                      return (
                        <tr
                          key={transaction._id || `${transaction.invoiceNo}-${index}`}
                          className="transition hover:bg-slate-50/80"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                            {String(transaction.date || "").split("T")[0] || "-"}
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-950">
                            {transaction.category || "-"}
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {getBranchName(transaction.locCode)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                type === "direct"
                                  ? "bg-orange-100 text-orange-600"
                                  : "bg-purple-100 text-purple-600"
                              }`}
                            >
                              {type === "direct" ? "Direct" : "Indirect"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {attachmentUrl ? (
                              <a
                                href={attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-purple-600 hover:text-purple-800 hover:underline"
                              >
                                {transaction.attachmentFilename || `Receipt ${index + 1}`}
                              </a>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs font-semibold uppercase text-slate-800">
                            {transaction.paymentMethod || "cash"}
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {transaction.bankAccount || "-"}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-slate-950">
                            {formatAmount(transaction.amount)}
                          </td>
                          <td className="max-w-sm px-5 py-4 text-xs text-slate-500">
                            <span className="line-clamp-2">
                              {cleanRemark(transaction.remark)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
