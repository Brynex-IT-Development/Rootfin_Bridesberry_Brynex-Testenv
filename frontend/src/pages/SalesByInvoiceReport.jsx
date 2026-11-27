import Headers from '../components/Header.jsx';
import { useEffect, useState } from "react";
import baseUrl from '../api/api.js';
import { CSVLink } from 'react-csv';
import { Helmet } from "react-helmet";
import { SlidersHorizontal, Download, Calendar, ChevronDown, X } from "lucide-react";
import useSidebar from '../hooks/useSidebar.js';
import { fetchActiveStores } from '../utils/storeService.js';

import AppSelect from "../components/AppSelect.jsx";
import { isWarehouseStore } from "../utils/storeService";
import { isAdminOrSuperAdmin } from "../utils/roleUtils";
/* ── tiny native select wrapper ── */
const NativeSelect = ({ value, onChange, options, placeholder }) => (
  <div className="relative">
    <AppSelect
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rf-input !w-full !h-[40px] !rounded-[10px] !text-[13px] !text-[#1B1B1B] bg-white cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value || "__null__"} value={o.value || ""}>{o.label}</option>
      ))}
    </AppSelect>
  </div>
);

const SalesByInvoiceReport = () => {
  const isSidebarOpen = useSidebar();
  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [selectedStore, setSelectedStore] = useState("all");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [csvData, setCsvData] = useState([]);

  // Advanced filter states
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [skuSearch, setSkuSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("rootfinuser"));
  const isAdmin = (currentUser?.power || "").toLowerCase() === "admin" || isAdminOrSuperAdmin(currentUser);
  const userRole = (currentUser?.role || "").toLowerCase();
  const isSuperOrAdmin = userRole === 'super_admin' || userRole === 'superadmin' || userRole === 'admin';
  const isMainAdmin = isSuperOrAdmin || isWarehouseStore(currentUser?.locCode);
  const isWarehouse = (currentUser?.power || "").toLowerCase() === "warehouse";
  const canSeeCost = isAdmin || isWarehouse || isMainAdmin;
  const isClusterManager = (currentUser?.role || "").toLowerCase() === "cluster_manager";
  const clusterAllowedLocCodes = currentUser?.allowedLocCodes || [];
  const canSelectStore = isAdmin || isClusterManager;

  useEffect(() => {
    if (!canSelectStore && currentUser?.locCode) setSelectedStore(currentUser.locCode);
    if (isClusterManager && clusterAllowedLocCodes.length > 0 && selectedStore === "all") setSelectedStore(clusterAllowedLocCodes[0]);
  }, []);

  const [activeStores, setActiveStores] = useState([]);

  useEffect(() => {
    fetchActiveStores().then(s => setActiveStores(s || []));
  }, []);

  const storeOptions = [
    { value: "all", label: "All Stores" },
    ...activeStores.map(s => ({ value: s.locCode, label: s.locName || s.name }))
  ];

  const categoryOptions = [
    { value: "Shoes", label: "Shoes" },
    { value: "Shirts", label: "Shirts" },
    { value: "Accessories", label: "Accessories" },
    { value: "Others", label: "Others" }
  ];

  const sizeOptions = ["XS","S","M","L","XL","XXL","6","7","8","9","10","11","12","28","30","32","34","36","38","40","42"].map(v => ({ value: v, label: v }));

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom: fromDate,
        dateTo: toDate,
        locCode: canSelectStore ? selectedStore : currentUser?.locCode,
        userId: currentUser?.email || currentUser?.userId,
        isAdmin: isAdmin ? "true" : "false",
        isClusterManager: isClusterManager ? "true" : "false",
        ...(isClusterManager && clusterAllowedLocCodes.length > 0 ? { allowedLocCodes: clusterAllowedLocCodes.join(",") } : {}),
        ...(categoryFilter && { category: categoryFilter }),
        ...(skuSearch && { sku: skuSearch }),
        ...(sizeFilter && { size: sizeFilter }),
        ...(customerSearch && { customer: customerSearch })
      });
      const response = await fetch(`${baseUrl.baseUrl}api/reports/sales/by-invoice?${params}`);
      if (!response.ok) { alert(`API Error: ${response.status}`); return; }
      const result = await response.json();
      if (result.success) {
        const allInvoices = result.data.invoices || [];

        // Fix: Exclude returned invoices (itemCount === 0) from summary totals
        const nonReturned = allInvoices.filter(inv => inv.itemCount > 0);
        const returnedCount = allInvoices.length - nonReturned.length;
        const totalSales = nonReturned.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
        const totalItems = nonReturned.reduce((s, inv) => s + (inv.itemCount || 0), 0);
        const avgInvoiceValue = nonReturned.length > 0 ? totalSales / nonReturned.length : 0;

        setReportData({
          ...result.data,
          summary: {
            ...(result.data.summary || {}),
            totalInvoices: nonReturned.length,
            totalSales,
            totalItems,
            avgInvoiceValue,
            returnedCount
          }
        });

        const csv = allInvoices.map(inv => ({
          Date: inv.date, "Invoice No": inv.invoiceNumber, Customer: inv.customer,
          SKU: inv.skus || "N/A", Category: inv.category, "Item Count": inv.itemCount,
          "Total Amount": inv.totalAmount, Discount: inv.discount,
          ...(canSeeCost ? { "Net Amount": inv.netAmount, Profit: inv.profit || 0 } : {}),
          "Payment Method": inv.paymentMethod, Branch: inv.branch,
          "Status": inv.itemCount === 0 ? "RETURNED" : "Active"
        }));
        setCsvData(csv);
      } else { alert("Failed to fetch report: " + (result.message || "Unknown error")); }
    } catch (error) { alert("Error: " + error.message); }
    finally { setLoading(false); }

  };

  const clearFilters = () => { setCategoryFilter(null); setSkuSearch(""); setSizeFilter(null); setCustomerSearch(""); };
  const hasActiveFilters = categoryFilter || skuSearch || sizeFilter || customerSearch;

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
  const fmtRs = (n) => `₹${fmt(n)}`;

  const paymentBadgeStyle = (method) => {
    const m = (method || "").toLowerCase();
    if (m.includes("cash")) return "bg-[#DCFCE7] text-[#16A34A]";
    if (m.includes("upi") || m.includes("card") || m.includes("bank")) return "bg-[#FDE3D9] text-[#F2572B]";
    return "bg-[#F4F4F5] text-[#525252]";
  };

  return (
    <>
      <Helmet><title>Sales by Invoice Report | RootFin</title></Helmet>
      <Headers title="Sales By Invoice Report" />
      <div className={`invoice-page-wrapper transition-all duration-300 min-h-screen bg-[#FAFAFA] text-[#1B1B1B] ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>

        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#1B1B1B]">Sales By Invoice Report</h1>
        </div>

        {/* ── Row 1: Primary Filters ── */}
        <div className={`flex flex-wrap items-end justify-between gap-4 px-6 md:px-8 pt-5 pb-4 ${!showAdvancedFilters ? 'border-b border-[#EAEAEA]' : ''}`}>
          <div className="flex flex-wrap items-end gap-3.5">
            {/* From Date */}
            <div className="rf-form-field !mb-0">
              <label className="rf-field-label">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="rf-input !w-[168px] !h-[40px] !rounded-[10px]"
              />
            </div>

            {/* To Date */}
            <div className="rf-form-field !mb-0">
              <label className="rf-field-label">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="rf-input !w-[168px] !h-[40px] !rounded-[10px]"
              />
            </div>

            {/* Store */}
            <div className="rf-form-field !mb-0 w-[190px]">
              <label className="rf-field-label">Store</label>
              {canSelectStore ? (
                <NativeSelect
                  value={selectedStore}
                  onChange={setSelectedStore}
                  placeholder="Select Store"
                  options={isClusterManager
                    ? [{ value: "all", label: "All My Stores" }, ...storeOptions.filter(s => clusterAllowedLocCodes.includes(s.value))]
                    : storeOptions}
                />
              ) : (
                <div className="h-[40px] flex items-center px-3.5 border border-[#E5E5E5] rounded-[10px] text-[13px] text-[#525252] bg-[#F4F4F5] w-full">
                  {storeOptions.find(s => s.value === selectedStore)?.label || selectedStore}
                </div>
              )}
            </div>

            {/* Fetch */}
            <button
              type="button"
              data-no-confirm="true"
              onClick={fetchReport}
              disabled={loading}
              className="rf-btn-primary !h-[40px] !px-6 !rounded-[10px] !bg-[#F2572B] hover:!bg-[#D9431A] !text-[13px] !font-medium inline-flex items-center gap-2 disabled:opacity-60 cursor-pointer shadow-[0_2px_8px_rgba(242, 87, 43,0.24)]"
            >
              {loading ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>Loading...</>
              ) : 'Fetch Data'}
            </button>
          </div>

          {/* Filters toggle */}
          <button
            type="button"
            data-no-confirm="true"
            onClick={() => setShowAdvancedFilters(v => !v)}
            className={`h-[40px] px-4 rounded-[10px] text-[13px] font-medium inline-flex items-center gap-2 transition-colors cursor-pointer ${
              showAdvancedFilters
                ? 'bg-white border border-[#F2572B] text-[#1B1B1B] shadow-[0_0_0_2px_rgba(242, 87, 43,0.12)]'
                : 'bg-[#EFEFF1] hover:bg-[#E4E4E7] text-[#1B1B1B] border border-transparent'
            }`}
          >
            <span>Filters</span>
            <SlidersHorizontal size={14} strokeWidth={2} />
          </button>
        </div>

        {/* ── Row 2: Advanced Filters (collapsible) ── */}
        {showAdvancedFilters && (
          <div className="flex flex-wrap items-end gap-3.5 px-6 md:px-8 pb-5 pt-1 border-b border-[#EAEAEA]">
            {/* Category */}
            <div className="rf-form-field !mb-0 flex-1 min-w-[180px] max-w-[230px]">
              <label className="rf-field-label">Category</label>
              <NativeSelect value={categoryFilter} onChange={setCategoryFilter} placeholder="All Categories" options={categoryOptions} />
            </div>

            {/* Size */}
            <div className="rf-form-field !mb-0 flex-1 min-w-[160px] max-w-[210px]">
              <label className="rf-field-label">Size</label>
              <NativeSelect value={sizeFilter} onChange={setSizeFilter} placeholder="All Size" options={sizeOptions} />
            </div>

            {/* Item SKU */}
            <div className="rf-form-field !mb-0 flex-1 min-w-[190px] max-w-[240px]">
              <label className="rf-field-label">Item SKU</label>
              <input
                type="text"
                value={skuSearch}
                onChange={e => setSkuSearch(e.target.value)}
                placeholder="Search by SKU"
                className="rf-input !w-full !h-[40px] !rounded-[10px]"
              />
            </div>

            {/* Customer */}
            <div className="rf-form-field !mb-0 flex-1 min-w-[190px] max-w-[240px]">
              <label className="rf-field-label">Customer</label>
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search Customer"
                className="rf-input !w-full !h-[40px] !rounded-[10px]"
              />
            </div>

            {/* Clear all Filters */}
            <button
              type="button"
              data-no-confirm="true"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="h-[40px] px-5 rounded-[10px] border border-[#F2572B] text-[#F2572B] text-[13px] font-medium bg-white hover:bg-[#FEF3EE] transition-colors inline-flex items-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear all Filters
            </button>
          </div>
        )}

        {/* ── Body ── */}
        <div className="px-6 md:px-8 py-5">
          {reportData ? (
            <>
              {/* Summary Stats + Export CSV Row */}
              <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                <div className="flex flex-wrap items-center divide-x divide-[#EAEAEA]">
                  <div className="pr-8 md:pr-12">
                    <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                      TOTAL INVOICES
                    </div>
                    <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                      {fmt(reportData.summary?.totalInvoices)}
                    </div>
                  </div>
                  <div className="px-8 md:px-12">
                    <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                      TOTAL SALES
                    </div>
                    <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                      {fmtRs(reportData.summary?.totalSales)}
                    </div>
                  </div>
                  <div className="px-8 md:px-12">
                    <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                      TOTAL ITEMS
                    </div>
                    <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                      {fmt(reportData.summary?.totalItems)}
                    </div>
                  </div>
                  <div className="pl-8 md:pl-12 pr-4">
                    <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                      AVG INVOICE VALUE
                    </div>
                    <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                      {fmtRs(Math.round(reportData.summary?.avgInvoiceValue || 0))}
                    </div>
                  </div>
                  {reportData.summary?.returnedCount > 0 && (
                    <div className="pl-8 md:pl-12">
                      <div className="text-[11px] font-semibold tracking-[0.06em] text-[#EF4444] uppercase mb-1">
                        RETURNS (EXCLUDED)
                      </div>
                      <div className="text-[22px] font-bold text-[#EF4444] tabular-nums">
                        {fmt(reportData.summary?.returnedCount)}
                      </div>
                    </div>
                  )}
                </div>

                {csvData.length > 0 && (
                  <CSVLink
                    data={csvData}
                    filename={`sales-by-invoice-${fromDate}-to-${toDate}.csv`}
                    className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors no-underline cursor-pointer"
                  >
                    <span>Export CSV</span>
                    <Download size={15} />
                  </CSVLink>
                )}
              </div>

              {/* Table */}
              <div className="bg-white rounded-[10px] border border-[#EAEAEA] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-max border-collapse">
                    <thead>
                      <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                        <th className="px-4 py-3.5 text-left whitespace-nowrap">DATE</th>
                        <th className="px-4 py-3.5 text-left whitespace-nowrap">INVOICE NO.</th>
                        <th className="px-4 py-3.5 text-left whitespace-nowrap">CUSTOMER NAME</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">SKU</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">CATEGORY</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">ITEMS</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">AMOUNT</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">DISCOUNT</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">NET AMOUNT</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">PAYMENT</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">BRANCH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0F0]">
                      {reportData.invoices?.length > 0 ? reportData.invoices.map((inv, idx) => {
                        const isReturned = inv.itemCount === 0;
                        return (
                          <tr
                            key={idx}
                            className={`transition-colors ${
                              isReturned
                                ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]/60'
                                : 'bg-white hover:bg-[#FEF3EE]/60'
                            }`}
                          >
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-[#212121] whitespace-nowrap">
                              {inv.date}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] whitespace-nowrap">
                              <span className={`font-medium ${isReturned ? 'text-[#EF4444]' : 'text-[#212121]'}`}>
                                {inv.invoiceNumber}
                              </span>
                              {isReturned && (
                                <span className="ml-2 px-1.5 py-0.5 bg-[#EF4444] text-white text-[9px] font-bold rounded">
                                  RETURNED
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-[#3F3F46] whitespace-nowrap">
                              {inv.customer}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center whitespace-nowrap">
                              <span className="text-[#F2572B] font-medium text-[12.5px]">
                                {inv.skus || "N/A"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center whitespace-nowrap">
                              <span className="inline-block min-w-[82px] px-3.5 py-1 bg-[#FDE3D9] text-[#F2572B] text-[12px] font-medium rounded-[8px] text-center">
                                {inv.category}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center text-[#3F3F46] whitespace-nowrap font-medium tabular-nums">
                              {inv.itemCount}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center text-[#212121] whitespace-nowrap tabular-nums">
                              ₹{fmt(inv.totalAmount)}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center text-[#3F3F46] whitespace-nowrap tabular-nums">
                              ₹{fmt(inv.discount)}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center font-semibold text-[#16A34A] whitespace-nowrap tabular-nums">
                              ₹{fmt(inv.netAmount)}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center whitespace-nowrap">
                              <span className={`inline-block min-w-[78px] px-3.5 py-1 text-[12px] font-medium rounded-[8px] text-center ${paymentBadgeStyle(inv.paymentMethod)}`}>
                                {inv.paymentMethod}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center text-[#3F3F46] whitespace-nowrap">
                              {inv.branch}
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan="11" className="px-4 py-14 text-center text-[#8A8A8A] text-[13px]">
                            No invoices found for the selected criteria
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-[12px] border border-[#EAEAEA] flex flex-col items-center justify-center py-24 text-[#8A8A8A]">
              {loading ? (
                <><svg className="animate-spin h-7 w-7 text-[#F2572B] mb-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg><span className="text-[13px] font-medium">Loading report...</span></>
              ) : (
                <span className="text-[13px] font-medium">Select a date range and click Fetch Data</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SalesByInvoiceReport;
