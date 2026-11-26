import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { CSVLink } from "react-csv";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import Headers from "../components/Header.jsx";
import baseUrl from "../api/api.js";
import useSidebar from "../hooks/useSidebar";
import { fetchActiveStores } from "../utils/storeService.js";

import AppSelect from "../components/AppSelect.jsx";
const STORES = [
  { value: "all", label: "All Stores" },
];

const SalesByGroupReport = () => {
  const isSidebarOpen = useSidebar();
  const today = new Date().toISOString().split("T")[0];
  const user = JSON.parse(localStorage.getItem("rootfinuser")) || {};
  const isAdmin = (user.power || "").toLowerCase() === "admin";
  const isClusterManager = (user.role || "").toLowerCase() === "cluster_manager";
  const clusterAllowedLocCodes = user.allowedLocCodes || [];
  const canSelectStore = isAdmin || isClusterManager;

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [selectedStore, setSelectedStore] = useState(
    isAdmin ? "all" : isClusterManager ? (clusterAllowedLocCodes[0] || "all") : user.locCode || "all"
  );
  const [loading, setLoading] = useState(false);
  const [sizes, setSizes] = useState([]);
  const [rows, setRows] = useState([]);
  const [fetched, setFetched] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom: fromDate,
        dateTo: toDate,
        locCode: selectedStore,
        userId: user.email || "",
        isAdmin: isAdmin ? "true" : "false",
        isClusterManager: isClusterManager ? "true" : "false",
        ...(isClusterManager && clusterAllowedLocCodes.length > 0
          ? { allowedLocCodes: clusterAllowedLocCodes.join(",") }
          : {}),
      });
      // Only add userId filter for non-admin users
      if (!isAdmin && user.email) {
        params.append('userId', user.email);
      }
      const res = await fetch(`${baseUrl.baseUrl}api/reports/sales/by-group?${params}`);
      const json = await res.json();
      if (json.success) {
        setSizes(json.data.sizes);
        setRows(json.data.rows);
        setFetched(true);
      } else {
        alert("Error: " + json.message);
      }
    } catch (e) {
      alert("Fetch error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const csvHeaders = [
    { label: "Group Name", key: "groupName" },
    ...sizes.map(s => ({ label: String(s), key: `size_${s}` })),
    { label: "Total", key: "total" },
  ];
  const csvData = rows.map(r => {
    const row = { groupName: r.groupName, total: r.total };
    sizes.forEach(s => { row[`size_${s}`] = r.sizes[s] || 0; });
    return row;
  });

  const grandTotals = {};
  sizes.forEach(s => { grandTotals[s] = rows.reduce((sum, r) => sum + (r.sizes[s] || 0), 0); });
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <>
      <Helmet><title>Sales by Group Report | RootFin</title></Helmet>
      <Headers title="Sales by Group Report" />

      <div
        className={`invoice-page-wrapper transition-all duration-300 bg-[#FAFAFA] min-h-screen text-[#1B1B1B] ${
          isSidebarOpen ? "ml-[240px]" : "ml-0"
        }`}
      >
        {/* Clean Page Title Header */}
        <div className="no-print bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#1B1B1B]">Sales by Group Report</h1>
        </div>

        <div className="px-6 md:px-8 pt-5 pb-10 space-y-5">
          {/* Top Filter Bar */}
          <div className="no-print flex flex-wrap items-end gap-3">
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
            {canSelectStore && (
              <div className="rf-form-field !mb-0 w-[195px]">
                <label className="rf-field-label">Store</label>
                <AppSelect
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="rf-input !w-full !h-[40px] !rounded-[10px] bg-white cursor-pointer"
                >
                  {isClusterManager
                    ? [
                        { value: "all", label: "All My Stores" },
                        ...STORES.filter((s) => clusterAllowedLocCodes.includes(s.value)),
                      ].map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))
                    : STORES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                </AppSelect>
              </div>
            )}

            {/* Refresh Icon Button */}
            <button
              type="button"
              data-no-confirm="true"
              onClick={fetchReport}
              disabled={loading}
              title="Refresh"
              className="h-[40px] w-[40px] rounded-[10px] bg-[#EFEFF1] hover:bg-[#E4E4E7] text-[#1B1B1B] inline-flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-[#9D43D6]" : ""} />
            </button>

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

          {/* Summary Strip + Export CSV Row */}
          {fetched && rows.length > 0 && (
            <div className="flex flex-wrap items-end justify-between gap-4 pt-1 pb-2 border-b border-[#EAEAEA]">
              <div className="flex flex-wrap items-center divide-x divide-[#EAEAEA]">
                <div className="pr-8 md:pr-14">
                  <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                    GROUPS
                  </div>
                  <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                    {rows.length.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="px-8 md:px-14">
                  <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                    SIZES
                  </div>
                  <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                    {sizes.length.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="pl-8 md:pl-14">
                  <div className="text-[11px] font-semibold tracking-[0.06em] text-[#7A7A7A] uppercase mb-1">
                    TOTAL UNIT SOLD
                  </div>
                  <div className="text-[22px] font-bold text-[#1B1B1B] tabular-nums">
                    {grandTotal.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {csvData.length > 0 && (
                <CSVLink
                  data={csvData}
                  headers={csvHeaders}
                  filename={`sales-by-group-${fromDate}-to-${toDate}.csv`}
                  className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors no-underline cursor-pointer"
                >
                  <span>Export CSV</span>
                  <Download size={15} />
                </CSVLink>
              )}
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="bg-white rounded-[10px] border border-[#EAEAEA] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="h-9 bg-[#F4F4F5] rounded-[6px] animate-pulse mb-3 w-full" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-2.5 mb-2.5">
                  <div className="h-7 bg-[#F4F4F5] rounded-[6px] animate-pulse" style={{ width: "22%" }} />
                  {[...Array(6)].map((_, j) => (
                    <div key={j} className="h-7 bg-[#F4F4F5] rounded-[6px] animate-pulse flex-1" />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          {fetched && !loading && (
            <div className="bg-white rounded-[10px] border border-[#EAEAEA] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              {rows.length === 0 ? (
                <div className="py-16 text-center text-[#8A8A8A] text-[13px] font-medium">
                  No sales data found for the selected period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    className="border-collapse w-full text-left text-[13px]"
                    style={{ minWidth: `${180 + sizes.length * 56 + 70}px` }}
                  >
                    <thead>
                      <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                        <th className="py-3.5 px-4 text-left whitespace-nowrap" style={{ minWidth: 200 }}>
                          GROUP NAME
                        </th>
                        {sizes.map((s) => (
                          <th
                            key={s}
                            className="py-3.5 px-3 text-center whitespace-nowrap"
                            style={{ minWidth: 56 }}
                          >
                            {s}
                          </th>
                        ))}
                        <th
                          className="py-3.5 px-4 text-center whitespace-nowrap"
                          style={{ minWidth: 72 }}
                        >
                          TOTAL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0F0] text-[#3F3F46]">
                      {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-[#FAF5FF]/60 transition-colors">
                          <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-left font-medium text-[#212121] whitespace-nowrap">
                            {row.groupName}
                          </td>
                          {sizes.map((s) => (
                            <td
                              key={s}
                              className="px-3 py-3.5 border-r border-[#F5F5F5] text-center tabular-nums"
                            >
                              {row.sizes[s] ? (
                                <span className="font-medium text-[#212121]">{row.sizes[s]}</span>
                              ) : (
                                <span className="text-[#D4D4D8]">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3.5 text-center font-semibold text-[#1B1B1B] tabular-nums">
                            {row.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#EAECEF] border-t border-[#E2E4E8] font-semibold text-[#1B1B1B] text-[13px]">
                        <td className="px-4 py-3.5 border-r border-[#D8DADF] text-left">
                          Total
                        </td>
                        {sizes.map((s) => (
                          <td
                            key={s}
                            className="px-3 py-3.5 border-r border-[#D8DADF] text-center tabular-nums"
                          >
                            {grandTotals[s] || <span className="text-[#9A9A9A]">—</span>}
                          </td>
                        ))}
                        <td className="px-4 py-3.5 text-center font-bold tabular-nums">
                          {grandTotal}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {!fetched && !loading && (
            <div className="bg-white rounded-[12px] border border-[#EAEAEA] py-20 text-center">
              <p className="text-[#525252] text-[13px] font-medium">
                Select a date range and click Fetch Data
              </p>
              <p className="text-[#8A8A8A] text-[12px] mt-1">
                Sales quantities grouped by item group and size
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SalesByGroupReport;
