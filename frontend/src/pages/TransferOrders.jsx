import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Trash2, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Head from "../components/Head";
import Header from "../components/Header";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse } from "../utils/warehouseMapping";
import useSidebar from "../hooks/useSidebar";

import AppSelect from "../components/AppSelect.jsx";
const PERIOD_OPTIONS = [
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
  { label: "180 Days", value: 180 },
  { label: "1 Year", value: 365 },
];

const PAGE_SIZE = 10;

const TransferOrders = () => {
  const isSidebarOpen = useSidebar();
  const navigate = useNavigate();
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

  // Get user info
  const userStr = localStorage.getItem("rootfinuser");
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.email || user?._id || user?.id || "";
  const userLocCode = user?.locCode || "";
  const userEmail = user?.email || user?.username || "";
  const adminEmails = ["officerootments@gmail.com"];
  const isAdminEmail = userEmail && adminEmails.some((e) => userEmail.toLowerCase() === e.toLowerCase());
  const isAdmin = isAdminEmail || user?.power === "admin";
  const isWarehouseUser = user?.power === "warehouse";

  const fallbackLocations = [];

  let userLocName = "";
  if (user?.locCode) {
    const location = fallbackLocations.find(
      (loc) => loc.locCode === user.locCode || loc.locCode === String(user.locCode)
    );
    if (location) userLocName = location.locName;
  }
  if (!userLocName) userLocName = user?.username || user?.locName || "";

  const [transferOrders, setTransferOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [ordersToDelete, setOrdersToDelete] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [transferPeriod, setTransferPeriod] = useState(90);
  const [currentPage, setCurrentPage] = useState(1);

  const location = useLocation();

  const userWarehouse = mapLocNameToWarehouse(userLocName);
  const isWarehouseSelection =
    (userWarehouse || "").toString().toLowerCase().trim() === "warehouse" ||
    userLocCode === "858" ||
    userLocCode === "103";
  const shouldFilterByWarehouse = !isWarehouseUser && !(isAdmin && isWarehouseSelection);

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "-";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return "-";
    }
  };

  const formatDateTime = (date) => {
    if (!date) return "-";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "-";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const displayHours = d.getHours() % 12 || 12;
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = d.getHours() >= 12 ? "PM" : "AM";
      return `${day}/${month}/${year} ${displayHours}:${minutes} ${ampm}`;
    } catch {
      return "-";
    }
  };

  // Fetch transfer orders
  useEffect(() => {
    const fetchTransferOrders = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (userId) params.append("userId", userId);

        if (
          shouldFilterByWarehouse &&
          userWarehouse &&
          userWarehouse !== "undefined" &&
          userWarehouse !== "null"
        ) {
          params.append("destinationWarehouse", userWarehouse);
          params.append("sourceWarehouse", userWarehouse);
        }
        if (user?.power) params.append("userPower", user.power);
        if (user?.locCode) params.append("locCode", user.locCode);

        const response = await fetch(`${API_URL}/api/inventory/transfer-orders?${params}`);
        if (!response.ok) throw new Error("Failed to fetch transfer orders");
        const data = await response.json();
        let orders = Array.isArray(data) ? data : [];

        if (
          shouldFilterByWarehouse &&
          userWarehouse &&
          userWarehouse !== "undefined" &&
          userWarehouse !== "null"
        ) {
          const userWarehouseLower = userWarehouse.toLowerCase().trim();
          const userBase = userWarehouseLower.replace(/\s*(branch|warehouse)\s*$/i, "").trim();

          const matchesWarehouse = (orderWarehouse) => {
            if (!orderWarehouse) return false;
            const owLower = orderWarehouse.toString().toLowerCase().trim();
            const owBase = owLower.replace(/\s*(branch|warehouse)\s*$/i, "").trim();
            if (owLower === userWarehouseLower) return true;
            if (owBase && userBase && owBase === userBase) return true;
            if (owLower.replace(/[\s\-_.]+/g, '') === userWarehouseLower.replace(/[\s\-_.]+/g, '')) return true;
            if (owLower.includes(userWarehouseLower) || userWarehouseLower.includes(owLower)) return true;
            const owNorm = owLower.replace(/^[a-z]{1,2}[.\-]\s*/i, "").trim();
            const uNorm = userWarehouseLower.replace(/^[a-z]{1,2}[.\-]\s*/i, "").trim();
            if (owNorm && uNorm && owNorm === uNorm) return true;
            return false;
          };

          orders = orders.filter((order) => {
            const matchesDest = matchesWarehouse(order.destinationWarehouse);
            const matchesSource = matchesWarehouse(order.sourceWarehouse);
            if (order.status === "draft" && matchesDest && !matchesSource) return false;
            return matchesDest || matchesSource;
          });
        }

        // Filter by transfer period
        const periodMs = transferPeriod * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - periodMs;
        orders = orders.filter((o) => {
          const d = new Date(o.date || o.createdAt);
          return !isNaN(d.getTime()) ? d.getTime() >= cutoff : true;
        });

        setTransferOrders(orders);
        setCurrentPage(1);
      } catch (error) {
        console.error("Error fetching transfer orders:", error);
        setTransferOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTransferOrders();
  }, [API_URL, userId, isWarehouseUser, isAdmin, isWarehouseSelection, userWarehouse, refreshTrigger, transferPeriod]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) setRefreshTrigger((p) => p + 1);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (location.state?.refresh) {
      setRefreshTrigger((p) => p + 1);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Filtered + paginated
  const filteredOrders = transferOrders.filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (order.transferOrderNumber || "").toLowerCase().includes(s) ||
      (order.reason || "").toLowerCase().includes(s) ||
      (order.sourceWarehouse || "").toLowerCase().includes(s) ||
      (order.destinationWarehouse || "").toLowerCase().includes(s)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pagedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Status counts (from ALL transferOrders)
  const transferredCount = transferOrders.filter((o) => o.status === "transferred").length;
  const inTransitCount = transferOrders.filter((o) => o.status === "in_transit").length;
  const draftCount = transferOrders.filter((o) => o.status === "draft").length;

  // Checkbox handlers
  const handleCheckboxChange = (orderId, isChecked) => {
    const n = new Set(selectedOrders);
    isChecked ? n.add(orderId) : n.delete(orderId);
    setSelectedOrders(n);
  };
  const handleSelectAll = (isChecked) => {
    if (isChecked) {
      setSelectedOrders(new Set(filteredOrders.map((o) => o._id || o.id).filter(Boolean)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  // Delete handlers
  const handleDeleteClick = () => {
    const ids = Array.from(selectedOrders);
    if (!ids.length) return;
    setOrdersToDelete(filteredOrders.filter((o) => ids.includes(o._id || o.id)));
    setDeleteStep(1);
    setShowDeleteModal(true);
  };
  const handleSingleDelete = (order) => {
    setOrdersToDelete([order]);
    setDeleteStep(1);
    setShowDeleteModal(true);
  };
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteStep(1);
    setOrdersToDelete([]);
  };

  const refreshList = async () => {
    const params = new URLSearchParams();
    if (userId) params.append("userId", userId);
    if (shouldFilterByWarehouse && userWarehouse && userWarehouse !== "undefined" && userWarehouse !== "null") {
      params.append("destinationWarehouse", userWarehouse);
      params.append("sourceWarehouse", userWarehouse);
    }
    const res = await fetch(`${API_URL}/api/inventory/transfer-orders?${params}`);
    if (res.ok) {
      const data = await res.json();
      let orders = Array.isArray(data) ? data : [];
      if (shouldFilterByWarehouse && userWarehouse && userWarehouse !== "undefined" && userWarehouse !== "null") {
        const uwl = userWarehouse.toLowerCase().trim();
        const ub = uwl.replace(/\s*(branch|warehouse)\s*$/i, "").trim();
        const match = (w) => {
          if (!w) return false;
          const wl = w.toString().toLowerCase().trim();
          const wb = wl.replace(/\s*(branch|warehouse)\s*$/i, "").trim();
          return wl === uwl || (wb && ub && wb === ub) || wl.includes(uwl) || uwl.includes(wl);
        };
        orders = orders.filter((o) => {
          const md = match(o.destinationWarehouse);
          const ms = match(o.sourceWarehouse);
          if (o.status === "draft" && md && !ms) return false;
          return md || ms;
        });
      }
      setTransferOrders(orders);
    }
  };

  const handleConfirmDeleteStep2 = async () => {
    setDeleting(true);
    try {
      await Promise.all(
        ordersToDelete.map(async (order) => {
          const id = order._id || order.id;
          if (!id) return;
          const res = await fetch(`${API_URL}/api/inventory/transfer-orders/${id}`, { method: "DELETE" });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || "Failed to delete");
          }
        })
      );
      const deletedIds = ordersToDelete.map((o) => o._id || o.id).filter(Boolean);
      const newSel = new Set(selectedOrders);
      deletedIds.forEach((id) => newSel.delete(id));
      setSelectedOrders(newSel);
      await refreshList();
      setShowDeleteModal(false);
      setDeleteStep(1);
      setOrdersToDelete([]);
    } catch (err) {
      alert(`Error deleting: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatus((p) => new Set(p).add(orderId));
    try {
      const res = await fetch(`${API_URL}/api/inventory/transfer-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update status");
      }
      await refreshList();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setUpdatingStatus((p) => {
        const n = new Set(p);
        n.delete(orderId);
        return n;
      });
    }
  };

  // Pagination helpers
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  // Status badge (non-admin)
  const getStatusBadge = (status) => {
    const map = {
      transferred: { label: "Transferred", bg: "bg-[#DCFCE7]", text: "text-[#16A34A]" },
      in_transit: { label: "In Transit", bg: "bg-[#F3E8FF]", text: "text-[#9D43D6]" },
      draft: { label: "Draft", bg: "bg-[#F4F4F5]", text: "text-[#525252]" },
    };
    const s = map[status] || { label: status, bg: "bg-[#F4F4F5]", text: "text-[#525252]" };
    return (
      <span className={`inline-flex items-center px-3 py-1 text-[12px] font-semibold rounded-[6px] ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  // Admin status dropdown (tinted pill matching screenshot)
  const getStatusSelect = (order) => {
    const colorMap = {
      transferred: { bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0" },
      in_transit: { bg: "#F3E8FF", text: "#9D43D6", border: "#E9D5FF" },
      draft: { bg: "#F4F4F5", text: "#525252", border: "#E4E4E7" },
    };
    const c = colorMap[order.status] || colorMap.draft;
    const id = order._id || order.id;

    const pillStyles = {
      control: (base) => ({
        ...base,
        minHeight: "30px",
        height: "30px",
        backgroundColor: c.bg,
        borderColor: "transparent",
        borderRadius: "6px",
        boxShadow: "none",
        padding: "0 2px",
        minWidth: "112px",
        cursor: "pointer",
        "&:hover": { borderColor: c.border },
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "0 4px 0 10px",
      }),
      singleValue: (base) => ({
        ...base,
        color: c.text,
        fontSize: "12px",
        fontWeight: 600,
      }),
      indicatorSeparator: () => ({ display: "none" }),
      dropdownIndicator: (base) => ({
        ...base,
        color: c.text,
        padding: "0 6px 0 2px",
        "&:hover": { color: c.text },
      }),
      menu: (base) => ({
        ...base,
        borderRadius: "10px",
        border: "1px solid #E5E5E5",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
        overflow: "hidden",
        minWidth: "130px",
      }),
    };

    return (
      <div className="inline-flex items-center justify-center">
        <AppSelect
          value={order.status}
          onChange={(e) => handleStatusChange(id, e.target.value)}
          disabled={updatingStatus.has(id)}
          isSearchable={false}
          styles={pillStyles}
        >
          <option value="draft">Draft</option>
          <option value="in_transit">In Transit</option>
          <option value="transferred">Transferred</option>
        </AppSelect>
      </div>
    );
  };

  const TABLE_COLS = [
    { label: "DATE", align: "text-left" },
    { label: "TRANSFER ORDER #", align: "text-left" },
    { label: "REASON", align: "text-left" },
    { label: "STATUS", align: "text-center" },
    { label: "QUANTITY", align: "text-center" },
    { label: "SOURCE WAREHOUSE", align: "text-center" },
    { label: "DESTINATION WAREHOUSE", align: "text-center" },
    { label: "CREATED BY", align: "text-center" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Transfer Orders" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#212121]">Transfer Orders</h1>
        </div>
        <div className="p-5 md:p-6">
          {/* ── Row 1: Search + Order Count Pill (left) & New Transfer Order (right) ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-full sm:w-[340px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#525252] pointer-events-none" size={15} />
                <input
                  type="text"
                  placeholder="Search by reference number, reasons, or description"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="rf-input !pl-10 !h-[42px] bg-white"
                />
              </div>
              {/* Order count pill */}
              {!loading && (
                <span className="inline-flex items-center px-3.5 py-1.5 text-[12px] font-semibold bg-[#F3E8FF]/80 text-[#9D43D6] rounded-full">
                  {filteredOrders.length} {filteredOrders.length === 1 ? "Order" : "Orders"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {isAdmin && selectedOrders.size > 0 && (
                <button
                  onClick={handleDeleteClick}
                  className="inline-flex h-[40px] items-center gap-1.5 rounded-[10px] bg-[#DC2626] px-4 text-[13px] font-semibold text-white hover:bg-[#B91C1C] transition cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete ({selectedOrders.size})</span>
                </button>
              )}
              <Link
                to="/inventory/transfer-orders/new"
                className="rf-btn-primary inline-flex items-center gap-1.5 !h-[40px] !px-5 !text-[13px]"
              >
                <span className="text-[16px] leading-none">+</span>
                <span>New Transfer Order</span>
              </Link>
            </div>
          </div>

          {/* ── Row 2: Transfer Period (left) + Status Segmented Tabs (right) ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            {/* Transfer Period dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-[#212121] whitespace-nowrap">
                Transfer Period
              </span>
              <div className="min-w-[132px]">
                <AppSelect
                  value={transferPeriod}
                  onChange={(e) => setTransferPeriod(Number(e.target.value))}
                  isSearchable={false}
                >
                  {PERIOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </AppSelect>
              </div>
            </div>

            {/* Status tab pills */}
            <div className="inline-flex items-center bg-[#F4F4F5] rounded-[12px] p-1 gap-1">
              {[
                { key: "all",         label: "All",         count: transferOrders.length },
                { key: "transferred", label: "Transferred", count: transferredCount },
                { key: "in_transit",  label: "In Transit",  count: inTransitCount },
                { key: "draft",       label: "Draft",       count: draftCount },
              ].map(({ key, label, count }) => {
                const isActive = statusFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] text-[12px] transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-white shadow-xs text-[#1B1B1B] font-semibold"
                        : "text-[#7A7A7A] hover:text-[#212121] font-medium"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[20px] h-[18px] text-[10px] font-semibold tabular-nums ${
                        isActive
                          ? "bg-[#9D43D6] text-white"
                          : "bg-[#F3E8FF] text-[#9D43D6]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Table Card ── */}
          <div className="bg-white border border-[#E5E5E5] rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-white">
                      <th className="w-11 px-4 py-3.5" />
                      {TABLE_COLS.map((c) => (
                        <th key={c.label} className={`px-4 py-3.5 ${c.align} text-[11px] font-semibold tracking-wider text-white uppercase whitespace-nowrap`}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: TABLE_COLS.length + 1 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-4 bg-[#ECECEF] rounded w-3/4 mx-auto" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : filteredOrders.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto w-12 h-12 rounded-[12px] bg-[#F3E8FF] flex items-center justify-center mb-3">
                    <Search className="text-[#9D43D6]" size={22} />
                  </div>
                  <p className="text-[14px] font-semibold text-[#1B1B1B] mb-1">
                    {searchTerm ? "No transfer orders found" : "No transfer orders yet"}
                  </p>
                  <p className="text-[12px] text-[#7A7A7A] mb-4">
                    {searchTerm ? "Try adjusting your search" : "Create your first transfer order to get started"}
                  </p>
                  {!searchTerm && (
                    <Link
                      to="/inventory/transfer-orders/new"
                      className="rf-btn-primary inline-flex items-center gap-2 !h-[38px] !px-4 !text-[13px]"
                    >
                      + Create Transfer Order
                    </Link>
                  )}
                </div>
              ) : (
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-white">
                      <th className="w-11 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded-[4px] border-gray-500 accent-[#9D43D6] cursor-pointer align-middle"
                          checked={
                            pagedOrders.length > 0 &&
                            pagedOrders.every((o) => {
                              const id = o._id || o.id;
                              return !id || selectedOrders.has(id);
                            })
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </th>
                      {TABLE_COLS.map((col) => (
                        <th
                          key={col.label}
                          className={`px-4 py-3.5 ${col.align} text-[11px] font-semibold tracking-wider text-white uppercase whitespace-nowrap`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] bg-white">
                    {pagedOrders.map((order) => {
                      const id = order._id || order.id;
                      return (
                        <tr
                          key={id}
                          className="hover:bg-[#FAFAFA] transition-colors cursor-pointer group"
                          onClick={() => navigate(`/inventory/transfer-orders/${id}`)}
                        >
                          {/* Checkbox */}
                          <td
                            className="px-4 py-3.5 text-center border-r border-[#F5F5F5]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#9D43D6] cursor-pointer align-middle"
                                checked={selectedOrders.has(id)}
                                onChange={(e) => handleCheckboxChange(id, e.target.checked)}
                              />
                              {isAdmin && selectedOrders.has(id) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSingleDelete(order); }}
                                  className="p-0.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded transition cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-[#525252] border-r border-[#F5F5F5]">
                            {formatDate(order.date)}
                          </td>

                          {/* Transfer Order # */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-[13px] border-r border-[#F5F5F5]">
                            <span
                              className="font-semibold text-[#9D43D6] group-hover:underline cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); navigate(`/inventory/transfer-orders/${id}`); }}
                            >
                              {order.transferOrderNumber || "—"}
                            </span>
                          </td>

                          {/* Reason */}
                          <td className="px-4 py-3.5 text-[13px] text-[#7A7A7A] border-r border-[#F5F5F5] max-w-[200px] truncate">
                            {order.reason || "—"}
                          </td>

                          {/* Status */}
                          <td
                            className="px-4 py-3.5 whitespace-nowrap text-[13px] text-center border-r border-[#F5F5F5]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isAdmin ? getStatusSelect(order) : getStatusBadge(order.status)}
                          </td>

                          {/* Quantity */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-center font-semibold text-[#1B1B1B] tabular-nums border-r border-[#F5F5F5]">
                            {parseFloat(order.totalQuantityTransferred || 0).toFixed(0)}
                          </td>

                          {/* Source Warehouse */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-center text-[#525252] border-r border-[#F5F5F5]">
                            {order.sourceWarehouse || "—"}
                          </td>

                          {/* Destination Warehouse */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-center text-[#525252] border-r border-[#F5F5F5]">
                            {order.destinationWarehouse || "—"}
                          </td>

                          {/* Created By */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-center text-[#7A7A7A]">
                            {order.createdBy || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Pagination ── */}
            {!loading && filteredOrders.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-t border-[#F0F0F0] bg-white">
                <div className="text-[12px] text-[#7A7A7A]">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length} orders
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Previous */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium text-[#525252] hover:text-[#1B1B1B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <span>←</span>
                    <span>Previous</span>
                  </button>

                  {getPageNumbers().map((page, idx) =>
                    page === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-[#7A7A7A] text-[13px] select-none">
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 text-[13px] font-semibold rounded-[8px] transition cursor-pointer flex items-center justify-center ${
                          currentPage === page
                            ? "bg-[#1B1B1B] text-white shadow-xs"
                            : "text-[#525252] hover:text-[#1B1B1B] hover:bg-[#F4F4F5]"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}

                  {/* Next */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium text-[#1B1B1B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <span>Next</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── 2-Step Delete Modal ── */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
              <div className="bg-white shadow-2xl max-w-md w-full rounded-[16px] border border-[#E5E5E5] overflow-hidden">
                <div className="p-6">
                  {deleteStep === 1 ? (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-[10px] bg-[#FEE2E2] flex items-center justify-center shrink-0">
                          <AlertTriangle className="text-[#DC2626]" size={20} />
                        </div>
                        <h3 className="text-[16px] font-semibold text-[#1B1B1B]">
                          Delete {ordersToDelete.length === 1 ? "Transfer Order" : `${ordersToDelete.length} Transfer Orders`}?
                        </h3>
                      </div>
                      <p className="text-[13px] text-[#525252] mb-6 leading-relaxed">
                        Are you sure you want to delete{" "}
                        {ordersToDelete.length === 1 ? "this transfer order" : `these ${ordersToDelete.length} transfer orders`}?
                        {ordersToDelete.some((o) => o.status === "transferred") && (
                          <span className="block mt-2 text-[#DC2626] font-semibold">
                            Some orders are already transferred. Stock will be reversed before deletion.
                          </span>
                        )}
                      </p>
                      <div className="flex gap-2.5 justify-end">
                        <button onClick={handleCancelDelete} className="rf-btn-cancel !h-[38px] !px-4 !text-[13px]">
                          Cancel
                        </button>
                        <button onClick={() => setDeleteStep(2)} className="inline-flex items-center justify-center h-[38px] px-4 text-[13px] font-semibold text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition cursor-pointer">
                          Continue
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-[10px] bg-[#FEE2E2] flex items-center justify-center shrink-0">
                          <AlertTriangle className="text-[#DC2626]" size={20} />
                        </div>
                        <h3 className="text-[16px] font-semibold text-[#1B1B1B]">Final Confirmation</h3>
                      </div>
                      <p className="text-[13px] text-[#525252] mb-4 leading-relaxed">
                        This action cannot be undone. Are you absolutely sure?
                      </p>
                      {ordersToDelete.length > 0 && (
                        <div className="mb-5 p-3 bg-[#FAFAFA] max-h-40 overflow-y-auto border border-[#E5E5E5] rounded-[10px]">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A] mb-2">Orders to be deleted:</p>
                          <ul className="text-[12px] text-[#212121] space-y-1">
                            {ordersToDelete.map((order, idx) => (
                              <li key={order._id || order.id || idx}>
                                • {order.transferOrderNumber || `Order-${String(order._id || order.id).slice(-8)}`} — {order.reason || "No reason"} ({order.status})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex gap-2.5 justify-end">
                        <button onClick={() => setDeleteStep(1)} disabled={deleting} className="rf-btn-cancel !h-[38px] !px-4 !text-[13px]">
                          Back
                        </button>
                        <button
                          onClick={handleConfirmDeleteStep2}
                          disabled={deleting}
                          className="inline-flex items-center justify-center gap-2 h-[38px] px-4 text-[13px] font-semibold text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {deleting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            "Confirm Delete"
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferOrders;
