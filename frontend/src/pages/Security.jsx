/*  ────────────────────────────────────────────────
 *  Security.jsx  – hybrid opening-balance logic
 *  ────────────────────────────────────────────────*/
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import Headers from "../components/Header.jsx";
import useFetch from "../hooks/useFetch.jsx";
import openingBalanceMap from "../data/openingBalance.json";
import { useSidebar } from "../hooks/useSidebar.js";
import { FALLBACK_STORES, fetchActiveStores, getActiveStores } from "../utils/storeService.js";
import { Download, Printer, Loader2 } from "lucide-react";

import AppSelect from "../components/AppSelect.jsx";
/* ---------- Store master list ---------- */
const getStoreName = (c) =>
  getActiveStores().find(
    (location) => String(location.locCode) === String(c)
  )?.locName || "Unknown";

/* ---------- helpers ---------- */
const getMonthStart = (iso) => iso.slice(0, 7) + "-01"; // YYYY-MM-01
const getManualOpening = (locCode, date) =>
  openingBalanceMap[locCode]?.[getMonthStart(date)] ?? null;
const dayBefore = (iso) => {
  const d = new Date(iso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return { dateFormatted: "-", timeFormatted: "" };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { dateFormatted: dateStr, timeFormatted: "" };
    const dateFormatted = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const hasTime = typeof dateStr === "string" && (dateStr.includes("T") || dateStr.includes(":"));
    const timeFormatted = hasTime
      ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase()
      : "";
    return { dateFormatted, timeFormatted };
  } catch {
    return { dateFormatted: dateStr, timeFormatted: "" };
  }
};

const formatNum = (num) => {
  if (num === undefined || num === null || isNaN(num) || num === "") return "0";
  return Number(num).toLocaleString("en-IN");
};

const Security = () => {
  const isSidebarOpen = useSidebar();
  const [allLocations, setAllLocations] = useState(() => getActiveStores());

  useEffect(() => {
    fetchActiveStores().then(s => {
      if (s && s.length > 0) setAllLocations(s);
    });
    const handleUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail)) setAllLocations(e.detail);
    };
    window.addEventListener("rootfin-stores-updated", handleUpdate);
    return () => window.removeEventListener("rootfin-stores-updated", handleUpdate);
  }, []);

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
  const firstOfMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-01`;
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [selectedStore, setSelectedStore] = useState("current"); // "current" | "all" | "cluster"
  const [rentAll, setRentAll] = useState([]); // all-store mode
  const [returnAll, setReturnAll] = useState([]);
  const [openingCash, setOpeningCash] = useState(0);
  const [allStoreOpenings, setAllStoreOpenings] = useState({}); // locCode -> opening balance

  const user = JSON.parse(localStorage.getItem("rootfinuser") || "{}");
  const userRole = (user?.role || "").toLowerCase();
  const isClusterManager = userRole === "cluster_manager" || userRole === "cluster_admin";
  const clusterStores = isClusterManager
    ? allLocations.filter((s) => (user.allowedLocCodes || []).includes(s.locCode))
    : [];
  const baseAPI = "https://rentalapi.rootments.live/api/GetBooking";

  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);

  /* ---------- hybrid opening-balance calc ---------- */
  const calcOpeningCash = async () => {
    if (selectedStore !== "current") return;

    const loc = user.locCode;
    const manualOpen = getManualOpening(loc, fromDate);

    /* ——— NEW LOGIC path ——— */
    if (manualOpen !== null) {
      const monthStart = getMonthStart(fromDate);
      if (fromDate === monthStart) {
        setOpeningCash(manualOpen);
        return;
      }

      const urlIn = `${baseAPI}/GetRentoutList?LocCode=${loc}&DateFrom=${monthStart}&DateTo=${dayBefore(fromDate)}`;
      const urlOut = `${baseAPI}/GetReturnList?LocCode=${loc}&DateFrom=${monthStart}&DateTo=${dayBefore(fromDate)}`;

      try {
        const [r1, r2] = await Promise.all([fetch(urlIn), fetch(urlOut)]);
        const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
        const secIn = (j1?.dataSet?.data || []).reduce((s, t) => s + +(t.securityAmount || 0), 0);
        const secOut = (j2?.dataSet?.data || []).reduce((s, t) => s + +(t.securityAmount || 0), 0);
        setOpeningCash(manualOpen + (secIn - secOut));
        return;
      } catch {
        setOpeningCash(manualOpen); // graceful fallback
        return;
      }
    }

    /* ——— OLD LOGIC path ——— */
    try {
      const urlIn = `${baseAPI}/GetRentoutList?LocCode=${loc}&DateFrom=2025-01-01&DateTo=${dayBefore(fromDate)}`;
      const urlOut = `${baseAPI}/GetReturnList?LocCode=${loc}&DateFrom=2025-01-01&DateTo=${dayBefore(fromDate)}`;
      const [r1, r2] = await Promise.all([fetch(urlIn), fetch(urlOut)]);
      const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
      const secIn = (j1?.dataSet?.data || []).reduce((s, t) => s + +(t.securityAmount || 0), 0);
      const secOut = (j2?.dataSet?.data || []).reduce((s, t) => s + +(t.securityAmount || 0), 0);
      setOpeningCash(secIn - secOut);
    } catch {
      setOpeningCash(0);
    }
  };

  /* run calc when store/date changes (current-store mode) */
  useEffect(() => {
    if (selectedStore === "current") calcOpeningCash();
  }, [selectedStore, fromDate, user.locCode]);

  /* ---------- data fetch for current store ---------- */
  const apiRentCur = `${baseAPI}/GetRentoutList?LocCode=${user.locCode}&DateFrom=${fromDate}&DateTo=${toDate}`;
  const apiRetCur = `${baseAPI}/GetReturnList?LocCode=${user.locCode}&DateFrom=${fromDate}&DateTo=${toDate}`;
  const fetchOpts = useMemo(() => ({}), []);
  const { data: rentData } = useFetch(selectedStore === "current" ? apiRentCur : null, fetchOpts);
  const { data: retData } = useFetch(selectedStore === "current" ? apiRetCur : null, fetchOpts);

  /* ---------- handleFetch (all-store / cluster mode) ---------- */
  const handleFetch = async () => {
    if (selectedStore !== "all" && selectedStore !== "cluster") {
      await calcOpeningCash();
      return;
    }

    setLoading(true);
    const storesToFetch = selectedStore === "cluster" ? clusterStores : allLocations;
    const tmpRent = [],
      tmpRet = [];
    const openingMap = {};

    for (const store of storesToFetch) {
      const u1 = `${baseAPI}/GetRentoutList?LocCode=${store.locCode}&DateFrom=${fromDate}&DateTo=${toDate}`;
      const u2 = `${baseAPI}/GetReturnList?LocCode=${store.locCode}&DateFrom=${fromDate}&DateTo=${toDate}`;

      const manualOpen = getManualOpening(store.locCode, fromDate);
      try {
        if (manualOpen !== null) {
          const monthStart = getMonthStart(fromDate);
          if (fromDate === monthStart) {
            openingMap[store.locCode] = manualOpen;
          } else {
            const [oR1, oR2] = await Promise.all([
              fetch(`${baseAPI}/GetRentoutList?LocCode=${store.locCode}&DateFrom=${monthStart}&DateTo=${dayBefore(fromDate)}`),
              fetch(`${baseAPI}/GetReturnList?LocCode=${store.locCode}&DateFrom=${monthStart}&DateTo=${dayBefore(fromDate)}`),
            ]);
            const [oj1, oj2] = await Promise.all([oR1.json(), oR2.json()]);
            const oSecIn = (oj1?.dataSet?.data || []).reduce((acc, t) => acc + +(t.securityAmount || 0), 0);
            const oSecOut = (oj2?.dataSet?.data || []).reduce((acc, t) => acc + +(t.securityAmount || 0), 0);
            openingMap[store.locCode] = manualOpen + (oSecIn - oSecOut);
          }
        } else {
          const [oR1, oR2] = await Promise.all([
            fetch(`${baseAPI}/GetRentoutList?LocCode=${store.locCode}&DateFrom=2025-01-01&DateTo=${dayBefore(fromDate)}`),
            fetch(`${baseAPI}/GetReturnList?LocCode=${store.locCode}&DateFrom=2025-01-01&DateTo=${dayBefore(fromDate)}`),
          ]);
          const [oj1, oj2] = await Promise.all([oR1.json(), oR2.json()]);
          const oSecIn = (oj1?.dataSet?.data || []).reduce((acc, t) => acc + +(t.securityAmount || 0), 0);
          const oSecOut = (oj2?.dataSet?.data || []).reduce((acc, t) => acc + +(t.securityAmount || 0), 0);
          openingMap[store.locCode] = oSecIn - oSecOut;
        }
      } catch {
        openingMap[store.locCode] = 0;
      }

      try {
        const [r1, r2] = await Promise.all([fetch(u1), fetch(u2)]);
        const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
        if (j1?.dataSet?.data)
          tmpRent.push(...j1.dataSet.data.map((d) => ({ ...d, locCode: store.locCode, Category: "RentOut" })));
        if (j2?.dataSet?.data)
          tmpRet.push(...j2.dataSet.data.map((d) => ({ ...d, locCode: store.locCode, Category: "Return" })));
      } catch (e) {
        console.error("Fetch err", e);
      }
    }

    setRentAll(tmpRent.map((d) => ({ ...d, _openingForStore: openingMap[d.locCode] || 0 })));
    setReturnAll(tmpRet.map((d) => ({ ...d, _openingForStore: openingMap[d.locCode] || 0 })));
    setAllStoreOpenings(openingMap);
    setLoading(false);
  };

  /* ---------- build rows ---------- */
  let tableRows = [];
  if (selectedStore === "current") {
    const rentList = rentData?.dataSet?.data || [];
    const retList = retData?.dataSet?.data || [];

    const rentMap = {};
    rentList.forEach((t) => {
      rentMap[t.invoiceNo] = t;
    });
    const retMap = {};
    retList.forEach((t) => {
      retMap[t.invoiceNo] = t;
    });

    const allInvoices = [...new Set([...rentList.map((t) => t.invoiceNo), ...retList.map((t) => t.invoiceNo)])];

    tableRows = allInvoices.map((inv) => {
      const r = rentMap[inv];
      const x = retMap[inv];
      const hasBoth = r && x;
      return {
        date: r ? r.rentOutDate : x.returnedDate,
        returnDate: x ? x.returnedDate : null,
        invoice: inv,
        customer: r ? r.customerName : x.customerName,
        category: hasBoth ? "RentOut + Return" : r ? "RentOut" : "Return",
        sub: hasBoth ? "Security" : r ? "Security" : "Security Refund",
        secIn: r ? +(r.securityAmount || 0) : 0,
        secOutCash: x ? +(x.returnCashAmount || 0) : 0,
        secOutRbl: x ? +(x.rblRazorPay || 0) : 0,
        merged: hasBoth,
      };
    });
  } else {
    const combined = [...rentAll, ...returnAll];
    const acc = {};

    for (const [lc, opening] of Object.entries(allStoreOpenings)) {
      if (opening === 0) continue;
      const name = getStoreName(lc);
      if (!acc[name]) acc[name] = { store: name, locCode: lc, secIn: opening, secOutCash: 0, secOutRbl: 0 };
    }

    combined.forEach((t) => {
      const name = getStoreName(t.locCode);
      if (!acc[name])
        acc[name] = {
          store: name,
          locCode: t.locCode,
          secIn: allStoreOpenings[t.locCode] || 0,
          secOutCash: 0,
          secOutRbl: 0,
        };
      if (t.Category === "Return") {
        acc[name].secOutCash += +(t.returnCashAmount || 0);
        acc[name].secOutRbl += +(t.rblRazorPay || 0);
      } else {
        acc[name].secIn += +(t.securityAmount || 0);
      }
    });

    tableRows = Object.values(acc).map((r) => ({ ...r, diff: r.secIn - (r.secOutCash + r.secOutRbl) }));
  }

  const totIn = tableRows.reduce((s, r) => s + (r.secIn || 0), 0);
  const totOutCash = tableRows.reduce((s, r) => s + (r.secOutCash || 0), 0);
  const totOutRbl = tableRows.reduce((s, r) => s + (r.secOutRbl || 0), 0);
  const totOut = totOutCash + totOutRbl;
  const adjIn = selectedStore === "current" ? totIn + openingCash : totIn;

  /* ---------- CSV export helper ---------- */
  const handleExportCSV = () => {
    if (tableRows.length === 0 && openingCash === 0) return alert("No data to export");
    const isAllStore = selectedStore === "all" || selectedStore === "cluster";
    const headers = isAllStore
      ? ["Store", "LocCode", "Security In", "Security Out (Cash)", "Security Out (RBL)", "Difference"]
      : [
          "Date",
          "Invoice No",
          "Customer Name",
          "Category",
          "Sub Category",
          "Security In",
          "Security Out (Cash)",
          "Security Out (RBL)",
          "Difference",
        ];

    let rows = [];
    if (isAllStore) {
      rows = tableRows.map((r) => [
        r.store,
        r.locCode,
        r.secIn || 0,
        r.secOutCash || 0,
        r.secOutRbl || 0,
        r.diff || 0,
      ]);
    } else {
      if (openingCash !== 0) {
        rows.push(["OPENING CASH", "", "", "", "", openingCash, 0, 0, 0]);
      }
      rows.push(
        ...tableRows.map((r) => [
          r.date,
          r.invoice,
          r.customer || "",
          r.category || "",
          r.sub || "",
          r.secIn || 0,
          r.secOutCash || 0,
          r.secOutRbl || 0,
          r.secIn - (r.secOutCash + r.secOutRbl),
        ])
      );
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Security_Report_${fromDate}_to_${toDate}.csv`;
    link.click();
  };

  /* ---------- print helper ---------- */
  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Security Report - ${fromDate} to ${toDate}</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; margin: 0; padding: 10px; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { background-color: #1e1e1e !important; color: #ffffff !important; padding: 8px 10px; font-size: 10px; text-transform: uppercase; font-weight: bold; border-right: 1px solid #333; }
            td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; border-right: 1px solid #f1f5f9; }
            tfoot tr { background-color: #e5e7eb !important; font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
          </style>
        </head>
        <body>
          <h2>Security Report</h2>
          <p>Period: ${fromDate || "N/A"} to ${toDate || "N/A"} | Store: ${selectedStore === "current" ? getStoreName(user?.locCode) : selectedStore}</p>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <>
      <Helmet>
        <title>Security Report | RootFin</title>
      </Helmet>
      <div className="invoice-page-wrapper min-h-screen bg-[#FAFAFA] text-[#1B1B1B]">
        <Headers title="Security Report" />
        <div className={`transition-all duration-300 ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
          {/* Clean Page Title Header */}
          <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <h1 className="text-[18px] font-semibold text-[#1B1B1B]">Security Report</h1>
          </div>

          <div className="px-6 md:px-8 pt-6 pb-8">
            {/* Controls Bar */}
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
              {/* Left Controls: From Date, To Date, Store, Fetch Button */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="rf-form-field !mb-0">
                  <label className="rf-field-label">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rf-input !w-[168px] !h-[40px] !rounded-[10px]"
                  />
                </div>

                <div className="rf-form-field !mb-0">
                  <label className="rf-field-label">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rf-input !w-[168px] !h-[40px] !rounded-[10px]"
                  />
                </div>

                <div className="rf-form-field !mb-0 w-[195px]">
                  <label className="rf-field-label">Store</label>
                  <AppSelect
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="rf-input !w-full !h-[40px] !rounded-[10px] bg-white cursor-pointer"
                  >
                    <option value="current">
                      {getStoreName(user.locCode)}
                    </option>
                    {isClusterManager && clusterStores.length > 0 && (
                      <option value="cluster">My Stores (All Assigned)</option>
                    )}
                    {(user.power || "").toLowerCase() === "admin" && (
                      <option value="all">All Stores (Totals)</option>
                    )}
                  </AppSelect>
                </div>

                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={handleFetch}
                  disabled={loading}
                  className="rf-btn-primary !h-[40px] !px-6 !rounded-[10px] !bg-[#9D43D6] hover:!bg-[#8732BE] !text-[13px] !font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-[0_2px_8px_rgba(157,67,214,0.24)]"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{loading ? "Fetching..." : "Fetch Data"}</span>
                </button>
              </div>

              {/* Right Controls: Export CSV, Print PDF */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={handleExportCSV}
                  className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Export CSV</span>
                  <Download className="w-4 h-4 text-[#1B1B1B]" />
                </button>
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={handlePrint}
                  className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Print PDF</span>
                  <Printer className="w-4 h-4 text-[#1B1B1B]" />
                </button>
              </div>
            </div>

            {/* Table Card */}
            <div className="rounded-[10px] border border-[#EAEAEA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden" ref={printRef}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-full text-left text-[13px]">
                  <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                    <tr className="bg-[#1B1B1B] text-white text-[11px] uppercase tracking-[0.04em] font-semibold">
                      {selectedStore === "all" || selectedStore === "cluster" ? (
                        <>
                          <th scope="col" className="px-4 py-3.5 text-left">STORE</th>
                          <th scope="col" className="px-4 py-3.5 text-left">LOCCODE</th>
                          <th scope="col" className="px-4 py-3.5 text-center">SECURITY IN</th>
                          <th scope="col" className="px-4 py-3.5 text-center">SECURITY OUT (CASH)</th>
                          <th scope="col" className="px-4 py-3.5 text-center">SECURITY OUT (RBL)</th>
                          <th scope="col" className="px-4 py-3.5 text-center">DIFFERENCE</th>
                        </>
                      ) : (
                        <>
                          <th scope="col" className="px-4 py-3.5 text-left">DATE</th>
                          <th scope="col" className="px-4 py-3.5 text-left">INVOICE NO.</th>
                          <th scope="col" className="px-4 py-3.5 text-left">CUSTOMER NAME</th>
                          <th scope="col" className="px-4 py-3.5 text-left">CATEGORY</th>
                          <th scope="col" className="px-4 py-3.5 text-left">SUB CATEGORY</th>
                          <th scope="col" className="px-4 py-3.5 text-center">SECURITY IN</th>
                          <th scope="col" className="px-4 py-3.5 text-center">SECURITY OUT (CASH)</th>
                          <th scope="col" className="px-4 py-3.5 text-center">SECURITY OUT (RBL)</th>
                          <th scope="col" className="px-4 py-3.5 text-center">DIFFERENCE</th>
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#F0F0F0] text-[13px] text-[#3F3F46]">
                    {/* Opening Cash Row */}
                    {selectedStore === "current" && openingCash !== 0 && (
                      <tr className="bg-[#FAFAFA] font-semibold border-b border-[#EAEAEA]">
                        <td className="px-4 py-3 border-r border-[#F5F5F5] text-[#1B1B1B] uppercase tracking-wider text-[11px]">Opening Cash</td>
                        <td colSpan={4} className="px-4 py-3 border-r border-[#F5F5F5]"></td>
                        <td className="px-4 py-3 border-r border-[#F5F5F5] text-center text-[#1B1B1B] tabular-nums">{formatNum(openingCash)}</td>
                        <td className="px-4 py-3 border-r border-[#F5F5F5] text-center text-[#6A6A6A] tabular-nums">0</td>
                        <td className="px-4 py-3 border-r border-[#F5F5F5] text-center text-[#6A6A6A] tabular-nums">0</td>
                        <td className="px-4 py-3 text-center text-[#6A6A6A] tabular-nums">0</td>
                      </tr>
                    )}

                    {tableRows.length ? (
                      tableRows.map((r, i) => {
                        if (selectedStore === "all" || selectedStore === "cluster") {
                          return (
                            <tr key={i} className="hover:bg-[#FAF5FF]/60 transition-colors">
                              <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-[#212121] font-medium whitespace-nowrap">{r.store}</td>
                              <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-[#6A6A6A] tabular-nums">{r.locCode}</td>
                              <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center tabular-nums">{formatNum(r.secIn)}</td>
                              <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center tabular-nums">{formatNum(r.secOutCash)}</td>
                              <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center tabular-nums">{formatNum(r.secOutRbl)}</td>
                              <td className="px-4 py-3.5 text-center text-[#1B1B1B] font-semibold tabular-nums">{formatNum(r.diff)}</td>
                            </tr>
                          );
                        }

                        const { dateFormatted, timeFormatted } = formatDateTime(r.date);
                        const returnDt = r.returnDate ? formatDateTime(r.returnDate) : null;

                        return (
                          <tr key={i} className="hover:bg-[#FAF5FF]/60 transition-colors">
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] whitespace-nowrap">
                              <div className="font-medium text-[#212121]">{dateFormatted}</div>
                              {timeFormatted && <div className="text-[11px] text-[#9A9A9A] mt-0.5">{timeFormatted}</div>}
                              {r.merged && returnDt && (
                                <div className="text-[11px] text-[#9D43D6] mt-0.5">↩ Return: {returnDt.dateFormatted}</div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] tabular-nums whitespace-nowrap">{r.invoice || "-"}</td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-[#212121] whitespace-nowrap">{r.customer || "-"}</td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] whitespace-nowrap">{r.category || "-"}</td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] whitespace-nowrap">{r.sub || "-"}</td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center tabular-nums">
                              {r.secIn ? formatNum(r.secIn) : ""}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center tabular-nums">
                              {r.secOutCash ? formatNum(r.secOutCash) : ""}
                            </td>
                            <td className="px-4 py-3.5 border-r border-[#F5F5F5] text-center tabular-nums">
                              {r.secOutRbl ? formatNum(r.secOutRbl) : ""}
                            </td>
                            <td className="px-4 py-3.5 text-center text-[#1B1B1B] font-semibold tabular-nums">
                              {formatNum(r.secIn - (r.secOutCash + r.secOutRbl))}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={selectedStore === "all" || selectedStore === "cluster" ? 6 : 9} className="px-4 py-14 text-center text-[#8A8A8A] font-medium">
                          No transactions found for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* Footer Totals */}
                  <tfoot style={{ position: "sticky", bottom: 0, zIndex: 1 }}>
                    <tr className="bg-[#EAECEF] font-semibold text-[13px] text-[#1B1B1B] border-t border-[#E2E4E8]">
                      <td colSpan={selectedStore === "all" || selectedStore === "cluster" ? 2 : 5} className="px-4 py-3.5 text-left border-r border-[#D8DADF]">
                        Total
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold border-r border-[#D8DADF] tabular-nums">{formatNum(adjIn)}</td>
                      <td className="px-4 py-3.5 text-center font-bold border-r border-[#D8DADF] tabular-nums">{formatNum(totOutCash)}</td>
                      <td className="px-4 py-3.5 text-center font-bold border-r border-[#D8DADF] tabular-nums">{formatNum(totOutRbl)}</td>
                      <td className="px-4 py-3.5 text-center font-bold tabular-nums">{formatNum(adjIn - totOut)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Security;
