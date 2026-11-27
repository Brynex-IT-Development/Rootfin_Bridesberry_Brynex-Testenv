import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  RefreshCw,
  IndianRupee,
  RotateCcw,
  TrendingDown,
  Wallet,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Headers from "../components/Header.jsx";
import AppSelect from "../components/AppSelect.jsx";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";
import { useActiveStores } from "../utils/storeService.js";
import { canViewAdminOnlyTransactions } from "../utils/adminTransactionVisibility.js";
import { isAdminOrSuperAdmin } from "../utils/roleUtils";

const TWS_BASE = "https://rentalapi.rootments.live/api/GetBooking";

const formatINR = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatCompactAxis = (val) => {
  const num = Number(val) || 0;
  if (num === 0) return "0";
  if (num >= 10000000) return `${(num / 10000000).toFixed(num % 10000000 === 0 ? 0 : 1)}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(num % 100000 === 0 ? 0 : 1)}L`;
  if (num >= 1000) return `${Math.round(num / 1000)}K`;
  return String(Math.round(num));
};

const formatCountBadge = (n) => {
  const num = Number(n) || 0;
  if (num === 0) return "0";
  return num < 10 ? `0${num}` : String(num);
};

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getFirstOfMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const formatDateRangeLabel = (fromStr, toStr) => {
  if (!fromStr || !toStr) return "Select Date Range";
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return `${fromStr} - ${toStr}`;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fd = String(from.getDate()).padStart(2, "0");
  const td = String(to.getDate()).padStart(2, "0");
  const fm = months[from.getMonth()];
  const tm = months[to.getMonth()];
  const fy = from.getFullYear();
  const ty = to.getFullYear();

  if (fy === ty && fm === tm) {
    if (fd === td) return `${fd} ${tm} ${ty}`;
    return `${fd}-${td} ${tm} ${ty}`;
  }
  if (fy === ty) {
    return `${fd} ${fm} - ${td} ${tm} ${ty}`;
  }
  return `${fd} ${fm} ${fy} - ${td} ${tm} ${ty}`;
};

const safeFetchWithTimeout = async (url, timeoutMs = 6000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const isSidebarOpen = useSidebar();
  const { stores: activeStores = [] } = useActiveStores();

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rootfinuser") || "{}") || {};
    } catch {
      return {};
    }
  }, []);

  const userRole = (currentUser?.role || "").toLowerCase().trim();
  const userPower = (currentUser?.power || "").toLowerCase().trim();
  const userEmail = (currentUser?.email || "").toLowerCase().trim();
  const userLocCode = (currentUser?.locCode || "").toString().trim();


  const isPrivileged =
    userRole === "admin" ||
    userRole === "super_admin" ||
    userRole === "superadmin" ||
    userRole === "super admin" ||
    userRole === "financial_head" ||
    userRole === "financial_admin" ||
    userRole.includes("cluster") ||
    userPower === "admin" ||
    userPower === "super_admin" ||
    isAdminOrSuperAdmin(currentUser);

  const canSeeAdminOnly = canViewAdminOnlyTransactions(currentUser);

  const [selectedStore, setSelectedStore] = useState(isPrivileged ? "all" : (userLocCode || "all"));
  const [fromDate, setFromDate] = useState(getFirstOfMonthStr);
  const [toDate, setToDate] = useState(getTodayStr);
  const [draftFrom, setDraftFrom] = useState(getFirstOfMonthStr);
  const [draftTo, setDraftTo] = useState(getTodayStr);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const datePopoverRef = useRef(null);

  const [daybookTab, setDaybookTab] = useState("all"); // "all" | "closed" | "not_closed"
  const [hoveredStore, setHoveredStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dashboardData, setDashboardData] = useState({
    stores: [],
    kpis: {
      totalIncome: { total: 0, cash: 0, bank: 0, upi: 0, rbl: 0 },
      returnableIncome: { total: 0 },
      totalExpenses: { total: 0, cash: 0, bank: 0, upi: 0, rbl: 0 },
      netDifference: { total: 0, cash: 0, bank: 0, upi: 0, rbl: 0 },
    },
    storeRankings: [],
    daybookStatus: [],
    quickOverview: {
      reorderAlerts: 0,
      purchaseOrders: 0,
      lateClosures: 0,
    },
    meta: {
      statusDate: getTodayStr(),
    },
  });

  const chartContainerRef = useRef(null);

  // Close date popover on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (datePopoverRef.current && !datePopoverRef.current.contains(e.target)) {
        setIsDatePopoverOpen(false);
      }
    };
    if (isDatePopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDatePopoverOpen]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const API = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
      const params = new URLSearchParams({
        fromDate,
        toDate,
        locCode: selectedStore || "all",
        role: userRole,
        userPower,
        userLocCode,
        canSeeAdminOnly: String(canSeeAdminOnly),
      });

      let json = null;
      const res = await fetch(`${API}/api/dashboard/summary?${params.toString()}`);

      if (res.ok) {
        json = await res.json();
      } else if (res.status === 404) {
        // Fallback: aggregate from already-deployed endpoints when /api/dashboard/summary isn't deployed yet
        let rawStores = Array.isArray(activeStores) && activeStores.length > 0 ? activeStores : [];
        if (rawStores.length === 0) {
          const storesRes = await safeFetchWithTimeout(`${API}/api/stores`, 8000);
          rawStores = Array.isArray(storesRes)
            ? storesRes
            : Array.isArray(storesRes?.data)
            ? storesRes.data
            : Array.isArray(storesRes?.stores)
            ? storesRes.stores
            : [];
        }

        const normStores = rawStores
          .map((s) => ({
            name: (s.name || s.locName || s.storeName || "").trim(),
            locCode: String(s.locCode || "").trim(),
          }))
          .filter((s) => s.locCode && s.name && s.name.toLowerCase() !== "warehouse");

        const targetStores =
          selectedStore && selectedStore !== "all"
            ? normStores.filter((s) => s.locCode.toLowerCase() === String(selectedStore).toLowerCase())
            : normStores;

        const [txResults, closeRes, alertsRes, poRes, lateRes] = await Promise.all([
          Promise.all(
            targetStores.map((s) =>
              safeFetchWithTimeout(
                `${API}/user/Getpayment?LocCode=${encodeURIComponent(s.locCode)}&DateFrom=${fromDate}&DateTo=${toDate}`,
                10000
              )
            )
          ),
          safeFetchWithTimeout(
            `${API}/user/AdminColseView?date=${toDate}&role=${encodeURIComponent(userPower || "admin")}`,
            8000
          ),
          safeFetchWithTimeout(`${API}/api/reorder-alerts?status=active`, 8000),
          safeFetchWithTimeout(`${API}/api/purchase/orders`, 8000),
          safeFetchWithTimeout(`${API}/user/pendingClosures`, 8000),
        ]);

        const inc = { total: 0, cash: 0, bank: 0, upi: 0, rbl: 0 };
        const exp = { total: 0, cash: 0, bank: 0, upi: 0, rbl: 0 };
        let returnableTotal = 0;

        const rankings = targetStores.map((store, idx) => {
          const txPayload = txResults[idx];
          const txList = Array.isArray(txPayload)
            ? txPayload
            : Array.isArray(txPayload?.data)
            ? txPayload.data
            : [];

          let storeIncome = 0;
          let storeExpense = 0;

          txList.forEach((tx) => {
            if (!canSeeAdminOnly && tx.isAdminOnly) return;
            const type = String(tx.type || "").toLowerCase();
            const cat = String(tx.category || "").toLowerCase();
            const sub = String(tx.subCategory || "").toLowerCase();

            if (type === "money transfer" || cat === "money transfer") return;

            const cash = Number(tx.cash) || 0;
            const bank = Number(tx.bank) || 0;
            const upi = Number(tx.upi) || 0;
            const rbl = Number(tx.rbl) || 0;
            const amt = Number(tx.amount) || cash + bank + upi + rbl;

            const isSecurity = cat.includes("security") || sub.includes("security");
            const isExpense = type === "expense" || amt < 0 || cat === "refund" || cat === "return" || cat === "cancel";

            if (isExpense) {
              const absC = Math.abs(cash);
              const absB = Math.abs(bank);
              const absU = Math.abs(upi);
              const absR = Math.abs(rbl);
              const absT = Math.abs(amt);
              exp.cash += absC;
              exp.bank += absB + absR;
              exp.upi += absU;
              exp.rbl += absR;
              exp.total += absT;
              storeExpense += absT;
            } else {
              if (isSecurity) {
                returnableTotal += Math.abs(amt);
              }
              inc.cash += cash;
              inc.bank += bank + rbl;
              inc.upi += upi;
              inc.rbl += rbl;
              inc.total += amt;
              storeIncome += amt;
            }
          });

          return {
            locCode: store.locCode,
            storeName: store.name,
            income: storeIncome,
            expense: storeExpense,
            difference: storeIncome - storeExpense,
          };
        });

        const closedRows = Array.isArray(closeRes?.data)
          ? closeRes.data
          : Array.isArray(closeRes)
          ? closeRes
          : [];
        const closedSet = new Set(
          closedRows.map((r) => String(r.locCode || "").trim().toLowerCase()).filter(Boolean)
        );

        const daybookStatus = normStores.map((s) => ({
          locCode: s.locCode,
          storeName: s.name,
          status: closedSet.has(s.locCode.toLowerCase()) ? "closed" : "not_closed",
        }));

        const alertsList = Array.isArray(alertsRes?.data)
          ? alertsRes.data
          : Array.isArray(alertsRes?.alerts)
          ? alertsRes.alerts
          : Array.isArray(alertsRes)
          ? alertsRes
          : [];
        const poList = Array.isArray(poRes?.data)
          ? poRes.data
          : Array.isArray(poRes?.orders)
          ? poRes.orders
          : Array.isArray(poRes)
          ? poRes
          : [];
        const activePoCount = poList.filter((po) => {
          const st = String(po.status || "").toLowerCase();
          return st !== "cancelled" && st !== "closed" && st !== "received";
        }).length;
        const lateList = Array.isArray(lateRes?.data)
          ? lateRes.data
          : Array.isArray(lateRes?.closures)
          ? lateRes.closures
          : Array.isArray(lateRes)
          ? lateRes
          : [];

        json = {
          stores: normStores,
          kpis: {
            totalIncome: inc,
            returnableIncome: { total: returnableTotal },
            totalExpenses: exp,
            netDifference: {
              total: inc.total - exp.total,
              cash: inc.cash - exp.cash,
              bank: inc.bank - exp.bank,
              upi: inc.upi - exp.upi,
              rbl: inc.rbl - exp.rbl,
            },
          },
          storeRankings: rankings,
          daybookStatus,
          quickOverview: {
            reorderAlerts: alertsList.length,
            purchaseOrders: activePoCount,
            lateClosures: lateList.length,
          },
          meta: { statusDate: toDate },
        };
      } else {
        throw new Error(`Dashboard request failed (${res.status})`);
      }

      // Base MongoDB data
      const baseKpis = json.kpis || {
        totalIncome: { total: 0, cash: 0, bank: 0, upi: 0, rbl: 0 },
        returnableIncome: { total: 0 },
        totalExpenses: { total: 0, cash: 0, bank: 0, upi: 0, rbl: 0 },
        netDifference: { total: 0, cash: 0, bank: 0, upi: 0, rbl: 0 },
      };

      const rankingsMap = new Map();
      (json.storeRankings || []).forEach((s) => {
        rankingsMap.set(String(s.locCode).toLowerCase(), { ...s });
      });

      // Immediately render MongoDB data so the UI feels instant
      setDashboardData({
        stores: json.stores || [],
        kpis: baseKpis,
        storeRankings: Array.from(rankingsMap.values()),
        daybookStatus: json.daybookStatus || [],
        quickOverview: json.quickOverview || {
          reorderAlerts: 0,
          purchaseOrders: 0,
          lateClosures: 0,
        },
        meta: json.meta || { statusDate: toDate },
      });
      setLoading(false);

      // Merge TWS rental data in background (Booking + RentOut + Delete/Cancel)
      const storesToFetchTws =
        selectedStore && selectedStore !== "all"
          ? [selectedStore]
          : (json.stores || []).map((s) => s.locCode).filter(Boolean);

      if (storesToFetchTws.length > 0) {
        const twsResults = await Promise.all(
          storesToFetchTws.map((lc) =>
            Promise.all([
              safeFetchWithTimeout(`${TWS_BASE}/GetBookingList?LocCode=${lc}&DateFrom=${fromDate}&DateTo=${toDate}`),
              safeFetchWithTimeout(`${TWS_BASE}/GetRentoutList?LocCode=${lc}&DateFrom=${fromDate}&DateTo=${toDate}`),
              safeFetchWithTimeout(`${TWS_BASE}/GetDeleteList?LocCode=${lc}&DateFrom=${fromDate}&DateTo=${toDate}`),
            ])
          )
        );

        let twsIncCash = 0;
        let twsIncBank = 0;
        let twsIncUpi = 0;
        let twsIncRbl = 0;
        let twsReturnable = 0;
        let twsExpCash = 0;
        let twsExpBank = 0;
        let twsExpUpi = 0;
        let twsExpRbl = 0;
        let hasTwsData = false;

        twsResults.forEach(([bookingRes, rentoutRes, cancelRes], idx) => {
          const lc = String(storesToFetchTws[idx]);
          const lcKey = lc.toLowerCase();
          const storeEntry = rankingsMap.get(lcKey);

          const bookings = bookingRes?.dataSet?.data || [];
          bookings.forEach((item) => {
            hasTwsData = true;
            const c = Number(item.bookingCashAmount || 0);
            const b = Number(item.bookingBankAmount || 0);
            const u = Number(item.bookingUPIAmount || 0);
            const r = Number(item.rblRazorPay || 0);
            twsIncCash += c;
            twsIncBank += b;
            twsIncUpi += u;
            twsIncRbl += r;
            if (storeEntry) storeEntry.income += c + b + u + r;
          });

          const rentouts = rentoutRes?.dataSet?.data || [];
          rentouts.forEach((item) => {
            hasTwsData = true;
            const security = Number(item.securityAmount || 0);
            const advance = Number(item.advanceAmount || 0);
            const balancePayable = Number(item.invoiceAmount || 0) - advance;

            if (security > 0) {
              twsReturnable += security;
            }
            if (balancePayable > 0) {
              twsIncCash += balancePayable;
              if (storeEntry) storeEntry.income += balancePayable;
            }
          });

          const cancels = cancelRes?.dataSet?.data || [];
          cancels.forEach((item) => {
            hasTwsData = true;
            const r = Math.abs(Number(item.rblRazorPay || 0));
            const c = Math.abs(Number(item.deleteCashAmount || 0));
            const b = r !== 0 ? 0 : Math.abs(Number(item.deleteBankAmount || 0));
            const u = r !== 0 ? 0 : Math.abs(Number(item.deleteUPIAmount || 0));
            twsExpCash += c;
            twsExpBank += b;
            twsExpUpi += u;
            twsExpRbl += r;
            if (storeEntry) storeEntry.expense += c + b + u + r;
          });
        });

        if (hasTwsData) {
          const mergedIncome = {
            cash: baseKpis.totalIncome.cash + twsIncCash,
            bank: baseKpis.totalIncome.bank + twsIncBank + twsIncRbl,
            upi: baseKpis.totalIncome.upi + twsIncUpi,
            rbl: baseKpis.totalIncome.rbl + twsIncRbl,
            total: baseKpis.totalIncome.total + twsIncCash + twsIncBank + twsIncUpi + twsIncRbl,
          };
          const mergedExpenses = {
            cash: baseKpis.totalExpenses.cash + twsExpCash,
            bank: baseKpis.totalExpenses.bank + twsExpBank + twsExpRbl,
            upi: baseKpis.totalExpenses.upi + twsExpUpi,
            rbl: baseKpis.totalExpenses.rbl + twsExpRbl,
            total: baseKpis.totalExpenses.total + twsExpCash + twsExpBank + twsExpUpi + twsExpRbl,
          };
          const mergedReturnable = {
            total: baseKpis.returnableIncome.total + twsReturnable,
          };
          const mergedNet = {
            cash: mergedIncome.cash - mergedExpenses.cash,
            bank: mergedIncome.bank - mergedExpenses.bank,
            upi: mergedIncome.upi - mergedExpenses.upi,
            rbl: mergedIncome.rbl - mergedExpenses.rbl,
            total: mergedIncome.total - mergedExpenses.total,
          };

          const mergedRankings = Array.from(rankingsMap.values()).map((s) => ({
            ...s,
            difference: s.income - s.expense,
          }));

          setDashboardData((prev) => ({
            ...prev,
            kpis: {
              totalIncome: mergedIncome,
              returnableIncome: mergedReturnable,
              totalExpenses: mergedExpenses,
              netDifference: mergedNet,
            },
            storeRankings: mergedRankings,
          }));
        }
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError(err.message || "Failed to load dashboard data");
      setLoading(false);
    }
  }, [fromDate, toDate, selectedStore, userRole, userPower, userLocCode, canSeeAdminOnly]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Store dropdown options
  const storeOptions = useMemo(() => {
    const mergedMap = new Map();
    const backendStores = Array.isArray(dashboardData.stores) ? dashboardData.stores : [];
    const localStores = Array.isArray(activeStores) ? activeStores : [];
    [...backendStores, ...localStores].forEach((s) => {
      const code = String(s.locCode || "").trim();
      if (!code) return;
      if (!mergedMap.has(code)) {
        mergedMap.set(code, s.locName || s.name || code);
      }
    });

    const opts = Array.from(mergedMap.entries()).map(([code, name]) => ({
      value: code,
      label: name,
    }));

    if (isPrivileged) {
      return [{ value: "all", label: "All Stores" }, ...opts];
    }
    return opts.length > 0 ? opts : [{ value: userLocCode || "all", label: currentUser?.storeName || currentUser?.username || "My Store" }];
  }, [dashboardData.stores, activeStores, isPrivileged, userLocCode, currentUser]);

  // Filtered Daybook Status rows
  const filteredDaybookRows = useMemo(() => {
    const rows = dashboardData.daybookStatus || [];
    if (daybookTab === "closed") return rows.filter((r) => r.status === "closed");
    if (daybookTab === "not_closed") return rows.filter((r) => r.status !== "closed");
    return rows;
  }, [dashboardData.daybookStatus, daybookTab]);

  // Chart scaling
  const chartScale = useMemo(() => {
    const rankings = dashboardData.storeRankings || [];
    const maxVal = rankings.reduce((acc, s) => Math.max(acc, s.income || 0, s.expense || 0), 0);
    if (maxVal <= 0) {
      return { max: 40000, ticks: [40000, 30000, 20000, 10000, 0] };
    }
    // Round up to a clean nice ceiling divisible by 4
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const normalized = maxVal / magnitude;
    let niceMax;
    if (normalized <= 1.2) niceMax = 1.2 * magnitude;
    else if (normalized <= 2) niceMax = 2 * magnitude;
    else if (normalized <= 4) niceMax = 4 * magnitude;
    else if (normalized <= 5) niceMax = 5 * magnitude;
    else if (normalized <= 8) niceMax = 8 * magnitude;
    else niceMax = 10 * magnitude;

    const step = niceMax / 4;
    return {
      max: niceMax,
      ticks: [niceMax, step * 3, step * 2, step, 0],
    };
  }, [dashboardData.storeRankings]);

  const applyDatePreset = (preset) => {
    const now = new Date();
    const fmt = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    let f = getFirstOfMonthStr();
    let t = getTodayStr();

    if (preset === "today") {
      f = fmt(now);
      t = fmt(now);
    } else if (preset === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      f = fmt(start);
      t = fmt(now);
    } else if (preset === "month") {
      f = getFirstOfMonthStr();
      t = getTodayStr();
    } else if (preset === "last_month") {
      const firstLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastLast = new Date(now.getFullYear(), now.getMonth(), 0);
      f = fmt(firstLast);
      t = fmt(lastLast);
    }

    setDraftFrom(f);
    setDraftTo(t);
    setFromDate(f);
    setToDate(t);
    setIsDatePopoverOpen(false);
  };

  const applyCustomDateRange = () => {
    if (draftFrom && draftTo) {
      if (draftFrom <= draftTo) {
        setFromDate(draftFrom);
        setToDate(draftTo);
      } else {
        setFromDate(draftTo);
        setToDate(draftFrom);
      }
    }
    setIsDatePopoverOpen(false);
  };

  const { totalIncome, returnableIncome, totalExpenses, netDifference } = dashboardData.kpis;
  const { reorderAlerts, purchaseOrders, lateClosures } = dashboardData.quickOverview;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Helmet>
        <title>Dashboard | RootFin</title>
      </Helmet>

      <Headers title="Dashboard" hideStoreSelector />

      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? "ml-[240px]" : "ml-0"
        }`}
      >
        <div className="px-6 md:px-8 py-6 max-w-[1600px] mx-auto">
          {error && (
            <div className="mb-4 rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] text-[#DC2626] flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={fetchDashboard}
                className="font-semibold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Main 2-Column Dashboard Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* LEFT MAIN COLUMN (Chart + Bottom Cards) */}
            <div className="xl:col-span-9 flex flex-col gap-5 min-w-0">
              {/* Top Title + Controls Bar */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-[22px] font-bold text-[#1B1B1B] tracking-tight leading-tight">
                    Dashboard
                  </h1>
                  <p className="text-[13px] text-[#7A7A7A] mt-0.5">
                    Overview of your stores and financial metrics
                  </p>
                </div>

                {/* Controls: Store + Date Range + Refresh */}
                <div className="flex flex-wrap items-end gap-3">
                  {/* Store Select */}
                  <div className="min-w-[175px]">
                    <label className="rf-field-label">Store</label>
                    <AppSelect
                      value={selectedStore}
                      onChange={(e) => setSelectedStore(e.target.value)}
                      options={storeOptions}
                      isDisabled={!isPrivileged && storeOptions.length <= 1}
                    />
                  </div>

                  {/* Date Range Picker */}
                  <div className="relative" ref={datePopoverRef}>
                    <label className="rf-field-label">Date Range</label>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftFrom(fromDate);
                        setDraftTo(toDate);
                        setIsDatePopoverOpen((prev) => !prev);
                      }}
                      className="rf-input flex items-center justify-between gap-3 min-w-[185px] bg-white cursor-pointer text-left"
                    >
                      <span className="text-[13px] font-medium text-[#212121] whitespace-nowrap">
                        {formatDateRangeLabel(fromDate, toDate)}
                      </span>
                      <Calendar size={15} className="text-[#525252] shrink-0" />
                    </button>

                    {isDatePopoverOpen && (
                      <div className="absolute right-0 mt-2 w-[300px] bg-white rounded-[14px] border border-[#E5E5E5] shadow-xl p-4 z-40">
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {[
                            { id: "today", label: "Today" },
                            { id: "week", label: "Last 7 Days" },
                            { id: "month", label: "This Month" },
                            { id: "last_month", label: "Last Month" },
                          ].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => applyDatePreset(p.id)}
                              className="px-2.5 py-1 rounded-[8px] text-[11px] font-medium bg-[#F4F4F5] hover:bg-[#FDE3D9] hover:text-[#F2572B] text-[#525252] transition-colors cursor-pointer"
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 mb-3">
                          <div>
                            <label className="rf-field-label">From</label>
                            <input
                              type="date"
                              value={draftFrom}
                              onChange={(e) => setDraftFrom(e.target.value)}
                              className="rf-input !h-[36px] !text-[12px]"
                            />
                          </div>
                          <div>
                            <label className="rf-field-label">To</label>
                            <input
                              type="date"
                              value={draftTo}
                              onChange={(e) => setDraftTo(e.target.value)}
                              className="rf-input !h-[36px] !text-[12px]"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsDatePopoverOpen(false)}
                            className="rf-btn-cancel !h-[34px] !px-3 !text-[12px]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={applyCustomDateRange}
                            className="rf-btn-primary !h-[34px] !px-4 !text-[12px]"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={fetchDashboard}
                    disabled={loading}
                    title="Refresh Dashboard"
                    className="w-[40px] h-[40px] rounded-[10px] bg-[#F2572B] hover:bg-[#D9431A] text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {/* Store Financial Ranking Card */}
              <div className="bg-white rounded-[16px] border border-[#E5E5E5] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <h2 className="text-[15px] font-semibold text-[#1B1B1B]">
                    Store Financial Ranking
                  </h2>

                  {/* Legend Pill */}
                  <div className="inline-flex items-center gap-4 px-3.5 py-1.5 rounded-full bg-[#F7F7F8] border border-[#EBEBEB] text-[12px] font-medium text-[#525252]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F9A88E]" />
                      Income
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#B23614]" />
                      Expense
                    </span>
                  </div>
                </div>

                {/* Grouped Bar Chart Area */}
                <div ref={chartContainerRef} className="relative">
                  {/* Clamped Floating Tooltip (rendered outside overflow-x-auto so it never clips) */}
                  {hoveredStore && (
                    <div
                      style={{ left: `${hoveredStore.tooltipLeft ?? 56}px` }}
                      className="absolute top-2 min-w-[225px] bg-white rounded-[12px] border border-[#E5E5E5] shadow-[0_8px_24px_rgba(0,0,0,0.08)] px-3.5 py-2.5 z-30 pointer-events-none text-left whitespace-nowrap"
                    >
                      <div className="text-[12px] font-semibold text-[#1B1B1B] mb-1.5 truncate max-w-[210px]">
                        {hoveredStore.storeName}
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between gap-4 text-[#525252]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#F9A88E] shrink-0" />
                            <span>Income :</span>
                          </span>
                          <span className="font-semibold text-[#212121] tabular-nums">
                            {formatINR(hoveredStore.income)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-[#525252]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#B23614] shrink-0" />
                            <span>Expense :</span>
                          </span>
                          <span className="font-semibold text-[#212121] tabular-nums">
                            {formatINR(hoveredStore.expense)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#F0F0F0] text-[#E88D2A] font-semibold">
                          <span>Difference :</span>
                          <span className="tabular-nums">
                            {formatINR(hoveredStore.difference)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {loading && dashboardData.storeRankings.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-[13px] text-[#7A7A7A]">
                      Loading store financial ranking...
                    </div>
                  ) : dashboardData.storeRankings.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-[13px] text-[#7A7A7A]">
                      No store financial data found for the selected range.
                    </div>
                  ) : (
                    <div className="flex items-stretch">
                      {/* Y-Axis Labels */}
                      <div className="w-[46px] shrink-0 flex flex-col justify-between pr-2.5 pb-[34px] text-right select-none">
                        {chartScale.ticks.map((tick, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] font-medium text-[#8A8A8A] leading-none tabular-nums"
                          >
                            {formatCompactAxis(tick)}
                          </span>
                        ))}
                      </div>

                      {/* Scrollable Plot Track */}
                      <div className="flex-1 overflow-x-auto pb-2 rf-dashboard-scroll">
                        <div
                          className="relative"
                          style={{
                            minWidth:
                              dashboardData.storeRankings.length > 6
                                ? `${dashboardData.storeRankings.length * 64}px`
                                : "100%",
                          }}
                        >
                          {/* Plot Height Container */}
                          <div className="relative h-[220px] flex items-end justify-around px-3">
                            {/* Horizontal Dashed Gridlines */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                              {chartScale.ticks.map((_, idx) => (
                                <div
                                  key={idx}
                                  className="w-full border-t border-dashed border-[#EBEBEB]"
                                />
                              ))}
                            </div>

                            {/* Bars per store */}
                            {dashboardData.storeRankings.map((store, idx) => {
                              const incPct = Math.min(
                                100,
                                Math.max(
                                  store.income > 0 ? 3 : 0,
                                  (store.income / chartScale.max) * 100
                                )
                              );
                              const expPct = Math.min(
                                100,
                                Math.max(
                                  store.expense > 0 ? 3 : 0,
                                  (store.expense / chartScale.max) * 100
                                )
                              );
                              const isHovered = hoveredStore?.locCode === store.locCode;

                              return (
                                <div
                                  key={store.locCode || idx}
                                  onMouseEnter={(e) => {
                                    const containerRect = chartContainerRef.current?.getBoundingClientRect();
                                    const barRect = e.currentTarget.getBoundingClientRect();
                                    let tooltipLeft = 56;
                                    if (containerRect) {
                                      const tooltipWidth = 235;
                                      const preferRight = barRect.right - containerRect.left + 10;
                                      const preferLeft = barRect.left - containerRect.left - tooltipWidth - 10;
                                      if (preferRight + tooltipWidth <= containerRect.width - 8) {
                                        tooltipLeft = preferRight;
                                      } else if (preferLeft >= 8) {
                                        tooltipLeft = preferLeft;
                                      } else {
                                        tooltipLeft = Math.max(8, containerRect.width - tooltipWidth - 8);
                                      }
                                    }
                                    setHoveredStore({ ...store, index: idx, tooltipLeft });
                                  }}
                                  onMouseLeave={() => setHoveredStore(null)}
                                  className="relative z-10 flex flex-col items-center justify-end h-full px-2 group cursor-pointer"
                                >
                                  {/* Vertical Hover Guide */}
                                  {isHovered && (
                                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] border-l border-dashed border-[#D4D4D8] pointer-events-none" />
                                  )}

                                  {/* Bar Pair */}
                                  <div className="flex items-end gap-1.5 h-full">
                                    <div
                                      className="w-[14px] rounded-t-[4px] bg-[#F9A88E] group-hover:bg-[#F6825F] transition-all duration-300"
                                      style={{ height: `${incPct}%` }}
                                    />
                                    <div
                                      className="w-[14px] rounded-t-[4px] bg-[#B23614] group-hover:bg-[#8C2B12] transition-all duration-300"
                                      style={{ height: `${expPct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* X-Axis Store Codes */}
                          <div className="flex items-center justify-around px-3 pt-2.5">
                            {dashboardData.storeRankings.map((store, idx) => (
                              <span
                                key={store.locCode || idx}
                                title={store.storeName}
                                className="text-[11px] font-medium text-[#7A7A7A] text-center truncate max-w-[62px]"
                              >
                                {store.shortCode || store.locCode}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom 2-Column Row: Daybook Status + Quick Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Daybook Status Card */}
                <div className="lg:col-span-7 bg-white rounded-[16px] border border-[#E5E5E5] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="text-[15px] font-semibold text-[#1B1B1B]">
                      Daybook Status
                    </h2>

                    {/* Segmented Filter Pill */}
                    <div className="inline-flex items-center bg-[#F4F4F5] p-1 rounded-full text-[12px]">
                      {[
                        { id: "all", label: "All" },
                        { id: "closed", label: "Closed" },
                        { id: "not_closed", label: "Not Closed" },
                      ].map((tab) => {
                        const active = daybookTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDaybookTab(tab.id)}
                            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                              active
                                ? "bg-white text-[#1B1B1B] font-semibold shadow-xs"
                                : "text-[#7A7A7A] hover:text-[#212121] font-medium"
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scrollable Store Status Rows */}
                  <div className="max-h-[290px] overflow-y-auto pr-1.5 space-y-2.5 rf-dashboard-scroll">
                    {filteredDaybookRows.length === 0 ? (
                      <div className="py-10 text-center text-[13px] text-[#7A7A7A]">
                        No stores match this status filter.
                      </div>
                    ) : (
                      filteredDaybookRows.map((row) => {
                        const isClosed = row.status === "closed";
                        return (
                          <div
                            key={row.locCode}
                            onClick={() => navigate("/CloseReport")}
                            className={`flex items-center justify-between px-3.5 py-3 rounded-[12px] transition-colors cursor-pointer ${
                              isClosed
                                ? "bg-[#F0FDF4]/90 hover:bg-[#DCFCE7]/60"
                                : "bg-[#FEF2F2]/90 hover:bg-[#FEE2E2]/60"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${
                                  isClosed
                                    ? "bg-[#DCFCE7] text-[#16A34A]"
                                    : "bg-[#FEE2E2] text-[#DC2626]"
                                }`}
                              >
                                {isClosed ? (
                                  <CheckCircle2 size={15} />
                                ) : (
                                  <XCircle size={15} />
                                )}
                              </div>
                              <span className="text-[13px] font-medium text-[#1B1B1B] truncate">
                                {row.storeName}
                              </span>
                            </div>

                            <span
                              className={`text-[11px] font-semibold px-3 py-1 rounded-[6px] shrink-0 ${
                                isClosed
                                  ? "bg-[#DCFCE7] text-[#16A34A]"
                                  : "bg-[#FEE2E2] text-[#DC2626]"
                              }`}
                            >
                              {isClosed ? "Closed" : "Not Closed"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Quick Overview Card */}
                <div className="lg:col-span-5 bg-white rounded-[16px] border border-[#E5E5E5] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col">
                  <h2 className="text-[15px] font-semibold text-[#1B1B1B] mb-2">
                    Quick Overview
                  </h2>

                  <div className="divide-y divide-[#F0F0F0] flex-1 flex flex-col justify-between">
                    {/* Reorder Alert */}
                    <button
                      type="button"
                      onClick={() => navigate("/inventory/reorder-alerts")}
                      className="w-full py-4 text-left flex items-start justify-between gap-3 hover:bg-[#FAFAFA] -mx-2 px-2 rounded-[10px] transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-[#525252]">
                          Reorder Alert
                        </div>
                        <div
                          className={`text-[24px] font-bold mt-1.5 leading-none tabular-nums ${
                            reorderAlerts > 0 ? "text-[#DC2626]" : "text-[#1B1B1B]"
                          }`}
                        >
                          {formatCountBadge(reorderAlerts)}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-[6px] shrink-0 ${
                          reorderAlerts > 0
                            ? "bg-[#FEE2E2] text-[#DC2626]"
                            : "bg-[#DCFCE7] text-[#16A34A]"
                        }`}
                      >
                        {reorderAlerts > 0 ? "Action Needed" : "All Good"}
                      </span>
                    </button>

                    {/* Purchase Order */}
                    <button
                      type="button"
                      onClick={() => navigate("/purchase/orders")}
                      className="w-full py-4 text-left flex items-start justify-between gap-3 hover:bg-[#FAFAFA] -mx-2 px-2 rounded-[10px] transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-[#525252]">
                          Purchase Order
                        </div>
                        <div className="text-[24px] font-bold text-[#1B1B1B] mt-1.5 leading-none tabular-nums">
                          {formatCountBadge(purchaseOrders)}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-[6px] shrink-0 ${
                          purchaseOrders > 0
                            ? "bg-[#DCFCE7] text-[#16A34A]"
                            : "bg-[#F4F4F5] text-[#7A7A7A]"
                        }`}
                      >
                        {purchaseOrders > 0 ? "Active" : "None"}
                      </span>
                    </button>

                    {/* Late Closure */}
                    <button
                      type="button"
                      onClick={() => navigate("/pending-closures")}
                      className="w-full py-4 text-left flex items-start justify-between gap-3 hover:bg-[#FAFAFA] -mx-2 px-2 rounded-[10px] transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-[#525252]">
                          Late Closure
                        </div>
                        <div
                          className={`text-[24px] font-bold mt-1.5 leading-none tabular-nums ${
                            lateClosures > 0 ? "text-[#DC2626]" : "text-[#1B1B1B]"
                          }`}
                        >
                          {formatCountBadge(lateClosures)}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-[6px] shrink-0 ${
                          lateClosures > 0
                            ? "bg-[#FEE2E2] text-[#DC2626]"
                            : "bg-[#DCFCE7] text-[#16A34A]"
                        }`}
                      >
                        {lateClosures > 0 ? "Action Needed" : "All Good"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT KPI COLUMN (4 Stacked Cards) */}
            <div className="xl:col-span-3 flex flex-col gap-4">
              {/* 1. Total Income */}
              <div className="bg-white rounded-[16px] border border-[#E5E5E5] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#212121]">
                    Total Income
                  </span>
                  <div className="w-8 h-8 rounded-[8px] bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0">
                    <IndianRupee size={15} />
                  </div>
                </div>

                <div className="text-[22px] font-bold text-[#1B1B1B] tracking-tight mt-2 tabular-nums break-all">
                  {formatINR(totalIncome.total)}
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0F0F0] space-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#7A7A7A]">Cash :</span>
                    <span className="font-medium text-[#212121] tabular-nums">
                      {formatINR(totalIncome.cash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#7A7A7A]">Card/Bank :</span>
                    <span className="font-medium text-[#212121] tabular-nums">
                      {formatINR(totalIncome.bank)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#7A7A7A]">UPI :</span>
                    <span className="font-medium text-[#212121] tabular-nums">
                      {formatINR(totalIncome.upi)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Returnable Income */}
              <div className="bg-white rounded-[16px] border border-[#E5E5E5] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[155px]">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[#212121]">
                      Returnable Income
                    </span>
                    <div className="w-8 h-8 rounded-[8px] bg-[#FFEDD5] text-[#EA580C] flex items-center justify-center shrink-0">
                      <RotateCcw size={15} />
                    </div>
                  </div>

                  <div className="text-[22px] font-bold text-[#1B1B1B] tracking-tight mt-2 tabular-nums break-all">
                    {formatINR(returnableIncome.total)}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#F0F0F0] text-[12px] text-[#7A7A7A]">
                  Total returnable income held
                </div>
              </div>

              {/* 3. Total Expenses */}
              <div className="bg-white rounded-[16px] border border-[#E5E5E5] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#212121]">
                    Total Expenses
                  </span>
                  <div className="w-8 h-8 rounded-[8px] bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center shrink-0">
                    <TrendingDown size={15} />
                  </div>
                </div>

                <div className="text-[22px] font-bold text-[#1B1B1B] tracking-tight mt-2 tabular-nums break-all">
                  {formatINR(totalExpenses.total)}
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0F0F0] space-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#7A7A7A]">Cash :</span>
                    <span className="font-medium text-[#212121] tabular-nums">
                      {formatINR(totalExpenses.cash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#7A7A7A]">Card/Bank :</span>
                    <span className="font-medium text-[#212121] tabular-nums">
                      {formatINR(totalExpenses.bank)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#7A7A7A]">UPI :</span>
                    <span className="font-medium text-[#212121] tabular-nums">
                      {formatINR(totalExpenses.upi)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Net Difference */}
              <div className="bg-white rounded-[16px] border border-[#E5E5E5] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#212121]">
                    Net Difference
                  </span>
                  <div className="w-8 h-8 rounded-[8px] bg-[#E0E7FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                    <Wallet size={15} />
                  </div>
                </div>

                <div className="text-[22px] font-bold text-[#1B1B1B] tracking-tight mt-2 tabular-nums break-all">
                  {formatINR(netDifference.total)}
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0F0F0] space-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#7A7A7A]">Cash :</span>
                    <span className="font-medium text-[#212121] tabular-nums">
                      {formatINR(netDifference.cash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#7A7A7A]">Card/Bank :</span>
                    <span className="font-medium text-[#212121] tabular-nums">
                      {formatINR(netDifference.bank)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#7A7A7A]">UPI :</span>
                    <span className="font-medium text-[#212121] tabular-nums">
                      {formatINR(netDifference.upi)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle custom scrollbar matching the design */}
      <style>{`
        .rf-dashboard-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .rf-dashboard-scroll::-webkit-scrollbar-track {
          background: #F1F1F3;
          border-radius: 999px;
        }
        .rf-dashboard-scroll::-webkit-scrollbar-thumb {
          background: #C4C4C8;
          border-radius: 999px;
        }
        .rf-dashboard-scroll::-webkit-scrollbar-thumb:hover {
          background: #F2572B;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
