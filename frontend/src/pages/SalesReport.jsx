import Headers from '../components/Header.jsx';
import { useEffect, useState } from "react";
import Select from "react-select";
import baseUrl from '../api/api.js';
import { CSVLink } from 'react-csv';
import { Helmet } from "react-helmet";
import { FiDownload, FiPrinter } from "react-icons/fi";
import { Loader2 } from "lucide-react";
import useSidebar from '../hooks/useSidebar.js';
import { fetchActiveStores } from '../utils/storeService.js';

import { appSelectStyles } from "../components/AppSelect.jsx";
// Add CSS animations
const styles = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      max-height: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      max-height: 200px;
      transform: translateY(0);
    }
  }
  
  @keyframes slideUp {
    from {
      opacity: 1;
      max-height: 200px;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      max-height: 0;
      transform: translateY(-10px);
    }
  }
  
  .payment-breakdown-enter {
    animation: slideDown 0.4s ease-out forwards;
  }
  
  .payment-breakdown-exit {
    animation: slideUp 0.3s ease-in forwards;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

const SalesReport = () => {
  const isSidebarOpen = useSidebar();
  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [selectedStore, setSelectedStore] = useState("all");
  const [reportType, setReportType] = useState("summary");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [showPaymentBreakdown, setShowPaymentBreakdown] = useState(false);
  
  // Advanced filtering removed as requested

  const currentUser = JSON.parse(localStorage.getItem("rootfinuser"));
  const isAdmin = (currentUser?.power || "").toLowerCase() === "admin";
  const isClusterManager = (currentUser?.role || "").toLowerCase() === "cluster_manager";
  const clusterAllowedLocCodes = currentUser?.allowedLocCodes || [];
  const canSelectStore = isAdmin || isClusterManager;
  
  // For store users, set their store as default and disable selection
  useEffect(() => {
    if (!canSelectStore && currentUser?.locCode) {
      setSelectedStore(currentUser.locCode);
    }
    if (isClusterManager && clusterAllowedLocCodes.length > 0 && selectedStore === "all") {
      setSelectedStore(clusterAllowedLocCodes[0]);
    }
  }, []);

  const [activeStores, setActiveStores] = useState([]);

  useEffect(() => {
    fetchActiveStores().then(s => setActiveStores(s || []));
  }, []);

  const storeOptions = [
    { value: "all", label: "All Stores" },
    ...activeStores.map(s => ({ value: s.locCode, label: s.locName || s.name }))
  ];

  const reportTypeOptions = [
    { value: "summary", label: "Sales Summary" },
    { value: "by-item", label: "Sales by Item" },
    { value: "returns", label: "Return Summary" }
  ];

  // Advanced filtering options removed

  const fetchReport = async () => {
    setLoading(true);
    try {
      const endpoint = `api/reports/sales/${reportType}`;
      
      const params = new URLSearchParams({
        dateFrom: fromDate,
        dateTo: toDate,
        locCode: canSelectStore ? selectedStore : currentUser?.locCode,
        userId: currentUser?.email || currentUser?.userId,
        isAdmin: isAdmin ? "true" : "false",
        isClusterManager: isClusterManager ? "true" : "false",
        ...(isClusterManager && clusterAllowedLocCodes.length > 0
          ? { allowedLocCodes: clusterAllowedLocCodes.join(",") }
          : {}),
      });

      console.log("🔍 Fetching report - Store:", selectedStore, "ReportType:", reportType);

      const response = await fetch(`${baseUrl.baseUrl}${endpoint}?${params}`);
      
      if (!response.ok) {
        const text = await response.text();
        console.error("API Error:", response.status, text);
        alert(`API Error: ${response.status} - ${text.substring(0, 100)}`);
        return;
      }
      
      const result = await response.json();

      if (result.success) {
        console.log("✅ Report data received");
        setReportData(result.data);
        prepareCsvData(result.data, reportType);
      } else {
        alert("Failed to fetch report: " + (result.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      alert("Error fetching report: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const prepareCsvData = (data, type) => {
    let csv = [];
    if (type === "summary") {
      csv = data.invoices?.map(inv => ({
        Date: inv.date,
        "Invoice No": inv.invoiceNumber,
        Customer: inv.customer,
        Category: inv.category,
        Amount: inv.amount,
        Discount: inv.discount,
        "Payment Method": inv.paymentMethod,
        Branch: inv.branch
      })) || [];
    } else if (type === "by-item") {
      csv = data.items?.map(item => ({
        "Item Name": item.name,
        SKU: item.sku,
        Category: item.category,
        Size: item.size,
        Quantity: item.quantity,
        "Unit Price": item.unitPrice,
        "Total Amount": item.totalAmount,
        "Invoice Count": item.invoiceCount
      })) || [];
    } else if (type === "returns") {
      csv = data.returns?.map(ret => ({
        Date: ret.date,
        "Invoice No": ret.invoiceNumber,
        Customer: ret.customer,
        Amount: ret.amount,
        Reason: ret.reason,
        Branch: ret.branch
      })) || [];
    }
    setCsvData(csv);
  };

  const formatMoney = (val) =>
    `₹${(Number(val) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePrint = () => {
    if (!reportData) {
      alert("No data available to print.");
      return;
    }
    window.print();
  };

  return (
    <>
      <Helmet>
        <title>Sales Report | RootFin</title>
      </Helmet>
      <div className="no-print">
        <Headers title="Sales Report" />
      </div>

      <div
        className={`invoice-page-wrapper transition-all duration-300 bg-[#FAFAFA] min-h-screen text-[#1B1B1B] ${
          isSidebarOpen ? "ml-[240px]" : "ml-0"
        }`}
      >
        {/* Clean Page Title Header */}
        <div className="no-print bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#1B1B1B]">Sales Report</h1>
        </div>

        <div className="px-6 md:px-8 pt-6 pb-10 space-y-5">
          {/* Top Filter & Action Bar */}
          <div className="no-print flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              {/* From Date */}
              <div className="rf-form-field !mb-0">
                <label className="rf-field-label">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rf-input !w-[168px] !h-[40px] !rounded-[10px]"
                />
              </div>

              {/* To Date */}
              <div className="rf-form-field !mb-0">
                <label className="rf-field-label">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rf-input !w-[168px] !h-[40px] !rounded-[10px]"
                />
              </div>

              {/* Store */}
              <div className="rf-form-field !mb-0 w-[195px]">
                <label className="rf-field-label">Store</label>
                {canSelectStore ? (
                  <Select
                    classNamePrefix="rf-select"
                    options={
                      isClusterManager
                        ? [
                            { value: "all", label: "All My Stores" },
                            ...storeOptions.filter((s) => clusterAllowedLocCodes.includes(s.value)),
                          ]
                        : storeOptions
                    }
                    value={
                      storeOptions.find((s) => s.value === selectedStore) || {
                        value: selectedStore,
                        label: selectedStore,
                      }
                    }
                    onChange={(opt) => setSelectedStore(opt.value)}
                    isSearchable
                    placeholder="Select Store..."
                    styles={appSelectStyles}
                  />
                ) : (
                  <div className="h-[40px] flex items-center px-3.5 border border-[#E5E5E5] rounded-[10px] text-[13px] text-[#525252] bg-[#F4F4F5]">
                    {storeOptions.find((s) => s.value === selectedStore)?.label || selectedStore}
                  </div>
                )}
              </div>

              {/* Report Type */}
              <div className="rf-form-field !mb-0 w-[180px]">
                <label className="rf-field-label">Report Type</label>
                <Select
                  classNamePrefix="rf-select"
                  options={reportTypeOptions}
                  value={reportTypeOptions.find((r) => r.value === reportType)}
                  onChange={(opt) => setReportType(opt.value)}
                  styles={appSelectStyles}
                />
              </div>

              {/* Fetch Data Button */}
              <button
                type="button"
                data-no-confirm="true"
                onClick={fetchReport}
                disabled={loading}
                className="rf-btn-primary !h-[40px] !px-6 !rounded-[10px] !bg-[#9D43D6] hover:!bg-[#8732BE] !text-[13px] !font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-[0_2px_8px_rgba(157,67,214,0.24)]"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{loading ? "Fetching..." : "Fetch Data"}</span>
              </button>
            </div>

            {/* Right Action Buttons: Export CSV & Print PDF */}
            <div className="flex items-center gap-2.5">
              {csvData.length > 0 ? (
                <CSVLink
                  data={csvData}
                  filename={`sales-report-${fromDate}-to-${toDate}.csv`}
                  className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors no-underline cursor-pointer"
                >
                  <span>Export CSV</span>
                  <FiDownload className="w-4 h-4 text-[#1B1B1B]" />
                </CSVLink>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] !text-[#8A8A8A] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 cursor-not-allowed opacity-70"
                >
                  <span>Export CSV</span>
                  <FiDownload className="w-4 h-4 text-[#8A8A8A]" />
                </button>
              )}

              <button
                type="button"
                data-no-confirm="true"
                onClick={handlePrint}
                disabled={!reportData}
                className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Print PDF</span>
                <FiPrinter className="w-4 h-4 text-[#1B1B1B]" />
              </button>
            </div>
          </div>

          {/* Report Display */}
          {reportData ? (
            <div className="space-y-6">
              {reportType === "summary" && (
                <>
                  {/* Divided Summary Stats Row */}
                  <div className="flex flex-wrap items-end justify-between gap-4 pt-1 pb-2 border-b border-[#EAEAEA]">
                    <div className="flex flex-wrap items-center divide-x divide-[#EAEAEA]">
                      <div className="pr-8 md:pr-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          TOTAL INVOICES
                        </div>
                        <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                          {(reportData.summary?.totalInvoices || 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="px-8 md:px-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          TOTAL SALES
                        </div>
                        <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                          {formatMoney(reportData.summary?.totalSales)}
                        </div>
                      </div>
                      <div className="px-8 md:px-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          TOTAL DISCOUNT
                        </div>
                        <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                          {formatMoney(reportData.summary?.totalDiscount)}
                        </div>
                      </div>
                      <div className="pl-8 md:pl-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          NET SALES
                        </div>
                        <div className="text-[22px] font-bold text-[#16A34A] tabular-nums">
                          {formatMoney(reportData.summary?.netSales)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sales by Category Table */}
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1B1B1B] mb-2.5">
                      Sales by Category
                    </h3>
                    <div className="bg-white rounded-[10px] border border-[#EAEAEA] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px]">
                          <thead>
                            <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                              <th className="py-3.5 px-4 text-left">CATEGORY</th>
                              <th className="py-3.5 px-4 text-center">COUNT</th>
                              <th className="py-3.5 px-4 text-center w-[220px]">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F0F0F0] text-[#3F3F46]">
                            {reportData.salesByCategory?.length > 0 ? (
                              reportData.salesByCategory.map((cat, idx) => (
                                <tr key={idx} className="hover:bg-[#FAF5FF]/60 transition-colors">
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] font-medium text-[#212121]">
                                    {cat.category}
                                  </td>
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center tabular-nums">
                                    {cat.count}
                                  </td>
                                  <td className="py-3.5 px-4 text-center font-medium text-[#212121] tabular-nums">
                                    {formatMoney(cat.amount)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="py-10 text-center text-[#8A8A8A]">
                                  No category records found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {reportData.salesByCategory?.length > 0 && (
                            <tfoot>
                              <tr className="bg-[#EAECEF] font-semibold text-[#1B1B1B] text-[13px] border-t border-[#E2E4E8]">
                                <td className="py-3.5 px-4 border-r border-[#D8DADF]">Total</td>
                                <td className="py-3.5 px-4 text-center border-r border-[#D8DADF] tabular-nums">
                                  {reportData.salesByCategory.reduce((s, c) => s + (Number(c.count) || 0), 0)}
                                </td>
                                <td className="py-3.5 px-4 text-center font-bold tabular-nums">
                                  {formatMoney(
                                    reportData.salesByCategory.reduce((s, c) => s + (Number(c.amount) || 0), 0)
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Top Sales Persons Table */}
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1B1B1B] mb-2.5">
                      Top Sales Persons
                    </h3>
                    <div className="bg-white rounded-[10px] border border-[#EAEAEA] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px]">
                          <thead>
                            <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                              <th className="py-3.5 px-4 text-left">NAME</th>
                              <th className="py-3.5 px-4 text-center">NUMBER OF SALES</th>
                              <th className="py-3.5 px-4 text-left">STORE</th>
                              <th className="py-3.5 px-4 text-center w-[220px]">SALES AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F0F0F0] text-[#3F3F46]">
                            {reportData.topSalesPersons?.length > 0 ? (
                              reportData.topSalesPersons.map((person, idx) => (
                                <tr key={idx} className="hover:bg-[#FAF5FF]/60 transition-colors">
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] font-medium text-[#212121]">
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-7 h-7 rounded-full bg-[#F3E8FF] text-[#9D43D6] text-[12px] font-semibold inline-flex items-center justify-center shrink-0">
                                        {(person.name || "?").charAt(0).toUpperCase()}
                                      </span>
                                      <span>{person.name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center">
                                    <span className="inline-block min-w-[44px] px-3 py-0.5 rounded-[8px] bg-[#F3E8FF] text-[#9D43D6] text-[12px] font-semibold tabular-nums">
                                      {person.count}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-[#3F3F46]">
                                    {person.store}
                                  </td>
                                  <td className="py-3.5 px-4 text-center font-semibold text-[#16A34A] tabular-nums">
                                    {formatMoney(person.amount)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-10 text-center text-[#8A8A8A]">
                                  No sales person records found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {reportType === "by-item" && (
                <>
                  {/* Divided Summary Stats Row */}
                  <div className="flex flex-wrap items-end justify-between gap-4 pt-1 pb-2 border-b border-[#EAEAEA]">
                    <div className="flex flex-wrap items-center divide-x divide-[#EAEAEA]">
                      <div className="pr-8 md:pr-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          TOTAL ITEMS
                        </div>
                        <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                          {(reportData.totalItems || 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="px-8 md:px-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          TOTAL QUANTITY
                        </div>
                        <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                          {(reportData.totalQuantity || 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="pl-8 md:pl-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          TOTAL AMOUNT
                        </div>
                        <div className="text-[22px] font-bold text-[#16A34A] tabular-nums">
                          {formatMoney(reportData.totalAmount)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Item Details Table */}
                  <div className="bg-white rounded-[10px] border border-[#EAEAEA] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[13px] min-w-[820px]">
                        <thead>
                          <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                            <th className="py-3.5 px-4 text-left whitespace-nowrap">ITEM NAME</th>
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">SKU</th>
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">CATEGORY</th>
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">SIZE</th>
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">QUANTITY</th>
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">UNIT PRICE</th>
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">TOTAL AMOUNT</th>
                            <th className="py-3.5 px-4 text-center whitespace-nowrap">INVOICES</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0F0F0] text-[#3F3F46]">
                          {reportData.items?.length > 0 ? (
                            reportData.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-[#FAF5FF]/60 transition-colors">
                                <td className="py-3.5 px-4 border-r border-[#F5F5F5] font-medium text-[#212121] max-w-[220px] truncate">
                                  {item.name}
                                </td>
                                <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center text-[#9D43D6] font-medium whitespace-nowrap">
                                  {item.sku || "-"}
                                </td>
                                <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap">
                                  <span className="inline-block min-w-[78px] px-3 py-1 rounded-[8px] bg-[#F3E8FF] text-[#9D43D6] text-[12px] font-medium">
                                    {item.category}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap">
                                  {item.size || "-"}
                                </td>
                                <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center font-medium text-[#212121] tabular-nums">
                                  {item.quantity}
                                </td>
                                <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center tabular-nums">
                                  {formatMoney(item.unitPrice)}
                                </td>
                                <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center font-semibold text-[#16A34A] tabular-nums">
                                  {formatMoney(item.totalAmount)}
                                </td>
                                <td className="py-3.5 px-4 text-center tabular-nums font-medium">
                                  {item.invoiceCount}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-[#8A8A8A]">
                                No item records found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {reportData.items?.length > 0 && (
                          <tfoot>
                            <tr className="bg-[#EAECEF] font-semibold text-[#1B1B1B] text-[13px] border-t border-[#E2E4E8]">
                              <td colSpan={4} className="py-3.5 px-4 border-r border-[#D8DADF]">
                                Total
                              </td>
                              <td className="py-3.5 px-4 text-center border-r border-[#D8DADF] tabular-nums">
                                {(reportData.totalQuantity || 0).toLocaleString("en-IN")}
                              </td>
                              <td className="py-3.5 px-4 border-r border-[#D8DADF]" />
                              <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] tabular-nums">
                                {formatMoney(reportData.totalAmount)}
                              </td>
                              <td className="py-3.5 px-4" />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </>
              )}

              {reportType === "returns" && (
                <>
                  {/* Divided Summary Stats Row */}
                  <div className="flex flex-wrap items-end justify-between gap-4 pt-1 pb-2 border-b border-[#EAEAEA]">
                    <div className="flex flex-wrap items-center divide-x divide-[#EAEAEA]">
                      <div className="pr-8 md:pr-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          TOTAL RETURNS
                        </div>
                        <div className="text-[22px] font-bold text-[#DC2626] tabular-nums">
                          {(reportData.summary?.totalReturns || 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="px-8 md:px-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          TOTAL RETURN AMOUNT
                        </div>
                        <div className="text-[22px] font-bold text-[#DC2626] tabular-nums">
                          {formatMoney(reportData.summary?.totalReturnAmount)}
                        </div>
                      </div>
                      <div className="pl-8 md:pl-12">
                        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                          AVERAGE RETURN
                        </div>
                        <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                          {formatMoney(reportData.summary?.averageReturnAmount)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Returns by Reason */}
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1B1B1B] mb-2.5">
                      Returns by Reason
                    </h3>
                    <div className="bg-white rounded-[10px] border border-[#EAEAEA] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px]">
                          <thead>
                            <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                              <th className="py-3.5 px-4 text-left">REASON</th>
                              <th className="py-3.5 px-4 text-center">COUNT</th>
                              <th className="py-3.5 px-4 text-center w-[220px]">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F0F0F0] text-[#3F3F46]">
                            {reportData.returnsByReason?.length > 0 ? (
                              reportData.returnsByReason.map((reason, idx) => (
                                <tr key={idx} className="hover:bg-[#FAF5FF]/60 transition-colors">
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] font-medium text-[#212121]">
                                    {reason.reason}
                                  </td>
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center tabular-nums">
                                    {reason.count}
                                  </td>
                                  <td className="py-3.5 px-4 text-center font-semibold text-[#DC2626] tabular-nums">
                                    {formatMoney(reason.amount)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="py-10 text-center text-[#8A8A8A]">
                                  No return reasons found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Return Details */}
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1B1B1B] mb-2.5">
                      Return Details
                    </h3>
                    <div className="bg-white rounded-[10px] border border-[#EAEAEA] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px]">
                          <thead>
                            <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                              <th className="py-3.5 px-4 text-left">DATE</th>
                              <th className="py-3.5 px-4 text-left">INVOICE NO.</th>
                              <th className="py-3.5 px-4 text-left">CUSTOMER</th>
                              <th className="py-3.5 px-4 text-center">AMOUNT</th>
                              <th className="py-3.5 px-4 text-left">REASON</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F0F0F0] text-[#3F3F46]">
                            {reportData.returns?.length > 0 ? (
                              reportData.returns.map((ret, idx) => (
                                <tr key={idx} className="hover:bg-[#FAF5FF]/60 transition-colors">
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] whitespace-nowrap text-[#212121]">
                                    {ret.date}
                                  </td>
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] font-medium text-[#212121] whitespace-nowrap tabular-nums">
                                    {ret.invoiceNumber}
                                  </td>
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] whitespace-nowrap">
                                    {ret.customer}
                                  </td>
                                  <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center font-semibold text-[#DC2626] tabular-nums whitespace-nowrap">
                                    {formatMoney(ret.amount)}
                                  </td>
                                  <td className="py-3.5 px-4">{ret.reason}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-10 text-center text-[#8A8A8A]">
                                  No return records found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {reportData.returns?.length > 0 && (
                            <tfoot>
                              <tr className="bg-[#EAECEF] font-semibold text-[#1B1B1B] text-[13px] border-t border-[#E2E4E8]">
                                <td colSpan={3} className="py-3.5 px-4 border-r border-[#D8DADF]">
                                  Total
                                </td>
                                <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] tabular-nums">
                                  {formatMoney(reportData.summary?.totalReturnAmount)}
                                </td>
                                <td className="py-3.5 px-4" />
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-[12px] border border-[#EAEAEA] flex flex-col items-center justify-center py-24 text-[#8A8A8A]">
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-[#9D43D6]" />
                  <span className="text-[13px] font-medium">Fetching sales report...</span>
                </div>
              ) : (
                <span className="text-[13px] font-medium">
                  Select a date range and click Fetch Data
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SalesReport;