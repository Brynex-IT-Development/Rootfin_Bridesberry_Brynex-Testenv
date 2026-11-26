import { useCallback, useEffect, useMemo, useState } from "react";
import { CSVLink } from "react-csv";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import baseUrl from "../api/api";
import { useSidebar } from "../hooks/useSidebar.js";
import { useActiveStores } from "../utils/storeService.js";
import { filterAdminOnlyTransactions } from "../utils/adminTransactionVisibility.js";
import Header from "../components/Header.jsx";
import AppSelect from "../components/AppSelect.jsx";
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

      <div className="min-h-screen bg-[#FFFFFF]">
        <Header title="Record Expense" />

        <main
          className={`transition-all duration-300 ${
            isSidebarOpen ? "ml-[240px]" : "ml-0"
          }`}
        >
          <div className="w-full max-w-[1440px] px-8 py-6">
            {/* Row 1: Search Input + New Expense Button */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full sm:w-[270px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center">
                  <Search size={15} className="text-[#212121]" />
                  <span className="h-4 w-[1px] bg-[#E5E5E5] ml-2.5" />
                </div>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name or sku"
                  className="rf-input !pl-12"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <CSVLink
                  data={csvData}
                  filename={`expense-records-${dateFrom}-to-${dateTo}.csv`}
                  className="rf-btn-secondary h-[40px]"
                  title="Download CSV"
                >
                  <Download size={15} />
                  CSV
                </CSVLink>
                <button
                  type="button"
                  onClick={() => navigate("/direct-expenses")}
                  className="inline-flex h-[40px] items-center justify-center gap-2 rounded-lg bg-[#1B1B1B] px-5 text-[13px] font-medium text-white transition hover:bg-black cursor-pointer"
                >
                  <Plus size={15} />
                  New Expense
                </button>
              </div>
            </div>

            {/* Row 2: From Date, To Date, Fetch Data + Filters Toggle */}
            <div className="pb-5 border-b border-[#EFEFEF] flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="rf-form-field !mb-0">
                  <label className="rf-field-label">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="rf-input !w-[165px]"
                  />
                </div>
                <div className="rf-form-field !mb-0">
                  <label className="rf-field-label">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="rf-input !w-[165px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchExpenses()}
                  disabled={loading}
                  className={
                    loading
                      ? "rf-btn-disabled h-[40px] !px-6"
                      : "rf-btn-primary h-[40px] !px-6 cursor-pointer"
                  }
                >
                  {loading ? "Fetching..." : "Fetch Data"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className={`inline-flex h-[40px] items-center gap-2 rounded-lg px-4 text-[13px] font-medium transition cursor-pointer ${
                  showFilters
                    ? "bg-[#EFEFEF] text-[#212121]"
                    : "bg-[#F5F5F5] text-[#4A4A4A] hover:bg-[#EFEFEF]"
                }`}
              >
                Filters
                <SlidersHorizontal size={15} />
              </button>
            </div>

            {/* Row 3: Collapsible Right-Aligned Filter Dropdowns */}
            {showFilters && (
              <div className="py-4 flex flex-wrap items-end justify-end gap-3">
                <div className="rf-form-field !mb-0 w-[180px]">
                  <label className="rf-field-label">Store</label>
                  <AppSelect
                    value={selectedStore}
                    onChange={(event) => setSelectedStore(event.target.value)}
                    disabled={!canSelectStore}
                    className="w-full"
                  >
                    {canSelectStore && <option value="all">All Stores</option>}
                    {visibleStores.map((store) => (
                      <option key={store.locCode} value={store.locCode}>
                        {store.locName}
                      </option>
                    ))}
                  </AppSelect>
                </div>

                <div className="rf-form-field !mb-0 w-[165px]">
                  <label className="rf-field-label">Expense Type</label>
                  <AppSelect
                    value={selectedExpenseType}
                    onChange={(event) =>
                      setSelectedExpenseType(event.target.value)
                    }
                    className="w-full"
                  >
                    <option value="all">All Types</option>
                    <option value="direct">Direct</option>
                    <option value="indirect">Indirect</option>
                  </AppSelect>
                </div>

                <div className="rf-form-field !mb-0 w-[165px]">
                  <label className="rf-field-label">Payment Type</label>
                  <AppSelect
                    value={selectedPaymentType}
                    onChange={(event) =>
                      setSelectedPaymentType(event.target.value)
                    }
                    className="w-full"
                  >
                    <option value="all">All</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="upi">UPI</option>
                    <option value="split">Split</option>
                  </AppSelect>
                </div>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-[38px] w-[38px] rounded-lg bg-[#F5F5F5] hover:bg-[#EAEAEA] text-[#212121] flex items-center justify-center transition cursor-pointer"
                  title="Reset filters"
                  aria-label="Reset filters"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
                {error}
              </div>
            )}

            {/* Expense Records Table */}
            <section className="mt-2 overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-[11px] font-semibold uppercase tracking-wider text-white">
                      <th className="px-4 py-3">Expense Category</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3 text-center">Expense Type</th>
                      <th className="px-4 py-3 text-center">Attachment</th>
                      <th className="px-4 py-3 text-center">Payment Method</th>
                      <th className="px-4 py-3 text-center">Amount</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEFEF] text-[13px] text-[#212121]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-14 text-center text-[#6A6A6A]">
                          Loading expense records...
                        </td>
                      </tr>
                    ) : filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-14 text-center text-[#6A6A6A]">
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
                            className="transition-colors hover:bg-[#FBF5FC]"
                          >
                            <td className="px-4 py-3.5 border-r border-[#F3F3F3] font-medium text-[#212121]">
                              {transaction.category || "-"}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-[#4A4A4A]">
                              {getBranchName(transaction.locCode)}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-center">
                              <span
                                className={`inline-flex items-center justify-center rounded-md px-3.5 py-1 text-[11px] font-semibold ${
                                  type === "direct"
                                    ? "bg-[#FFEDD5] text-[#EA580C]"
                                    : "bg-[#EFE3F7] text-[#9D43D6]"
                                }`}
                              >
                                {type === "direct" ? "Direct" : "Indirect"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-center">
                              {attachmentUrl ? (
                                <a
                                  href={attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-[#9D43D6] hover:text-[#8B3CBD] hover:underline"
                                >
                                  {transaction.attachmentFilename || `Receipt ${index + 1}`}
                                </a>
                              ) : (
                                <span className="text-[#A3A3A3]">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-center text-[#212121] capitalize">
                              {String(transaction.paymentMethod || "cash").toLowerCase() === "upi"
                                ? "UPI"
                                : transaction.paymentMethod || "Cash"}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-center font-semibold text-[#212121] tabular-nums">
                              {formatAmount(transaction.amount)}
                            </td>
                            <td className="max-w-xs px-4 py-3.5 text-[#4A4A4A]">
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
      </div>
    </>
  );
}
