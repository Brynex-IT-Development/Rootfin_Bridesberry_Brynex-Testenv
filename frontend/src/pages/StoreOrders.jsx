import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Trash2, AlertTriangle } from "lucide-react";
import Head from "../components/Head";
import Header from "../components/Header";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse } from "../utils/warehouseMapping";
import useSidebar from "../hooks/useSidebar";

import AppSelect from "../components/AppSelect.jsx";
import RootfinConfirmModal from "../components/RootfinModal";
import { getUserStoreName } from "../utils/storeService";
import { isAdminOrSuperAdmin } from "../utils/roleUtils";
const StoreOrders = () => {
  const isSidebarOpen = useSidebar();
  const navigate = useNavigate();
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  
  // Get user info
  const userStr = localStorage.getItem("rootfinuser");
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.email || user?._id || user?.id || "";
  const userLocCode = user?.locCode || "";
  const userEmail = user?.email || user?.username || "";
  const isAdminEmail = isAdminOrSuperAdmin(user);
  const isAdmin = isAdminEmail || user?.power === "admin";
  const isWarehouseUser = user?.power === "warehouse";
  const isStoreUser = !isAdmin && !isWarehouseUser;
  
  // Fallback locations mapping
  const fallbackLocations = [];
  
  // Get location name
  let userLocName = "";
  if (user?.locCode) {
    const location = fallbackLocations.find(loc => loc.locCode === user.locCode || loc.locCode === String(user.locCode));
    if (location) {
      userLocName = location.locName;
    }
  }
  if (!userLocName) {
    userLocName = getUserStoreName(user);
  }
  
  const userWarehouse = mapLocNameToWarehouse(userLocName);
  
  const [storeOrders, setStoreOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [ordersToDelete, setOrdersToDelete] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(new Set());
  
  // Format date
  const formatDate = (date) => {
    if (!date) return "-";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "-";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "-";
    }
  };
  
  // Format datetime
  const formatDateTime = (date) => {
    if (!date) return "-";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "-";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = d.getHours() >= 12 ? "PM" : "AM";
      const displayHours = d.getHours() % 12 || 12;
      return `${day}/${month}/${year} ${displayHours}:${minutes} ${ampm}`;
    } catch {
      return "-";
    }
  };
  
  // Fetch store orders
  useEffect(() => {
    const fetchStoreOrders = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (userId) params.append("userId", userId);
        if (statusFilter !== "all") params.append("status", statusFilter);
        
        // Filter by store warehouse for store users
        if (isStoreUser && userWarehouse) {
          params.append("storeWarehouse", userWarehouse);
        }
        if (user?.power) params.append("userPower", user.power);
        if (user?.locCode) params.append("locCode", user.locCode);
        
        const response = await fetch(`${API_URL}/api/inventory/store-orders?${params}`);
        if (!response.ok) throw new Error("Failed to fetch store orders");
        const data = await response.json();
        let orders = Array.isArray(data) ? data : [];
        
        setStoreOrders(orders);
      } catch (error) {
        console.error("Error fetching store orders:", error);
        setStoreOrders([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStoreOrders();
  }, [API_URL, userId, statusFilter, isStoreUser, userWarehouse, user?.power, user?.locCode]);
  
  // Listen for status changes from other pages (like StoreOrderView)
  useEffect(() => {
    const handleStatusChange = (event) => {
      console.log("📦 Store order status changed event received in StoreOrders list", event.detail);
      
      const { orderId, status } = event.detail;
      
      // Update the order in the list
      setStoreOrders(prevOrders => {
        return prevOrders.map(order => {
          const orderIdStr = (order._id || order.id)?.toString();
          if (orderIdStr === orderId?.toString()) {
            console.log(`🔄 Updating order ${order.orderNumber} status to ${status}`);
            return { ...order, status };
          }
          return order;
        });
      });
    };

    window.addEventListener("storeOrderStatusChanged", handleStatusChange);
    return () => {
      window.removeEventListener("storeOrderStatusChanged", handleStatusChange);
    };
  }, []);
  
  // Filter store orders by search term
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredOrders = storeOrders.filter(order => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (order.orderNumber || "").toLowerCase().includes(searchLower) ||
      (order.reason || "").toLowerCase().includes(searchLower) ||
      (order.storeWarehouse || "").toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (safePage > 3) pages.push("...");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
      pages.push(i);
    }
    if (safePage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };
  
  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { label: "Draft", className: "bg-[#f3f4f6] text-[#4b5563]" },
      pending: { label: "Pending", className: "bg-[#fef3c7] text-[#92400e]" },
      approved: { label: "Approved", className: "bg-[#ecfdf5] text-[#047857]" },
      rejected: { label: "Rejected", className: "bg-[#fee2e2] text-[#991b1b]" },
      transferred: { label: "Transferred", className: "bg-[#dbeafe] text-[#1e40af]" },
    };
    const statusInfo = statusMap[status] || { label: status || "Draft", className: "bg-[#f3f4f6] text-[#6b7280]" };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.className}`}>
        <span className="h-2 w-2 rounded-full bg-current" />
        {statusInfo.label}
      </span>
    );
  };
  
  const draftCount = storeOrders.filter(o => o.status === "draft").length;
  const pendingCount = storeOrders.filter(o => o.status === "pending").length;
  const approvedCount = storeOrders.filter(o => o.status === "approved").length;
  const rejectedCount = storeOrders.filter(o => o.status === "rejected").length;
  const transferredCount = storeOrders.filter(o => o.status === "transferred").length;
  
  // Handle checkbox change
  const handleCheckboxChange = (orderId, isChecked) => {
    const newSelected = new Set(selectedOrders);
    if (isChecked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };
  
  // Handle select all checkbox
  const handleSelectAll = (isChecked) => {
    if (isChecked) {
      const allIds = filteredOrders.map(order => order._id || order.id).filter(Boolean);
      setSelectedOrders(new Set(allIds));
    } else {
      setSelectedOrders(new Set());
    }
  };
  
  // Handle delete button click
  const handleDeleteClick = () => {
    const selectedIds = Array.from(selectedOrders);
    if (selectedIds.length === 0) return;
    
    const orders = filteredOrders.filter(order => {
      const id = order._id || order.id;
      return id && selectedIds.includes(id);
    });
    
    setOrdersToDelete(orders);
    setDeleteStep(1);
    setShowDeleteModal(true);
  };
  
  // Handle single delete
  const handleSingleDelete = (order) => {
    const orderId = order._id || order.id;
    if (!orderId) return;
    
    setOrdersToDelete([order]);
    setDeleteStep(1);
    setShowDeleteModal(true);
  };
  
  // Confirm delete (step 1)
  const handleConfirmDeleteStep1 = () => {
    setDeleteStep(2);
  };
  
  // Final delete confirmation (step 2)
  const handleConfirmDeleteStep2 = async () => {
    setDeleting(true);
    try {
      const deletePromises = ordersToDelete.map(async (order) => {
        const orderId = order._id || order.id;
        if (!orderId) return;
        
        const response = await fetch(`${API_URL}/api/inventory/store-orders/${orderId}`, {
          method: "DELETE",
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to delete store order");
        }
        
        return orderId;
      });

      await Promise.all(deletePromises);
      
      // Remove deleted orders from selected set
      const deletedIds = ordersToDelete.map(order => order._id || order.id).filter(Boolean);
      const newSelected = new Set(selectedOrders);
      deletedIds.forEach(id => newSelected.delete(id));
      setSelectedOrders(newSelected);
      
      // Refresh the list
      const params = new URLSearchParams();
      if (userId) params.append("userId", userId);
      if (statusFilter !== "all") params.append("status", statusFilter);
      
      if (isStoreUser && userWarehouse) {
        params.append("storeWarehouse", userWarehouse);
      }
      
      const response = await fetch(`${API_URL}/api/inventory/store-orders?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStoreOrders(Array.isArray(data) ? data : []);
      }
      
      setShowDeleteModal(false);
      setDeleteStep(1);
      setOrdersToDelete([]);
      alert(`Successfully deleted ${ordersToDelete.length} store order(s)`);
    } catch (error) {
      console.error("Error deleting store orders:", error);
      alert(`Error deleting store orders: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };
  
  // Cancel delete
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteStep(1);
    setOrdersToDelete([]);
  };
  
  // Handle status change (approve/reject)
  const handleStatusChange = async (orderId, newStatus, rejectionReason = "") => {
    setUpdatingStatus(prev => new Set(prev).add(orderId));
    try {
      const updateData = { status: newStatus };
      if (newStatus === "rejected" && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }
      
      const response = await fetch(`${API_URL}/api/inventory/store-orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // If there are stock issues, format them nicely
        if (errorData.stockIssues && Array.isArray(errorData.stockIssues)) {
          let errorMessage = errorData.message || "Cannot approve store order: Insufficient stock in Warehouse.\n\n";
          errorMessage += "Details:\n\n";
          errorData.stockIssues.forEach((issue, index) => {
            errorMessage += `${index + 1}. ${issue.itemName}${issue.itemSku && issue.itemSku !== "N/A" ? ` (SKU: ${issue.itemSku})` : ''}\n`;
            errorMessage += `   • Requested: ${issue.requested.toFixed(2)} units\n`;
            errorMessage += `   • Available in Warehouse: ${issue.available.toFixed(2)} units\n`;
            errorMessage += `   • Shortfall: ${issue.shortfall.toFixed(2)} units`;
            if (issue.error) {
              errorMessage += `\n   • Error: ${issue.error}`;
            }
            errorMessage += `\n\n`;
          });
          errorMessage += "Please ensure sufficient stock is available in Warehouse before approving this order.";
          alert(errorMessage);
          throw new Error("Insufficient stock - see details above");
        } else {
          throw new Error(errorData.message || "Failed to update status");
        }
      }

      // Refresh the list
      const params = new URLSearchParams();
      if (userId) params.append("userId", userId);
      if (statusFilter !== "all") params.append("status", statusFilter);
      
      if (isStoreUser && userWarehouse) {
        params.append("storeWarehouse", userWarehouse);
      }
      
      const refreshResponse = await fetch(`${API_URL}/api/inventory/store-orders?${params}`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setStoreOrders(Array.isArray(data) ? data : []);
      }
      
      // Dispatch event to notify other pages (like StoreOrderView) that status changed
      console.log("📦 Dispatching storeOrderStatusChanged event", {
        orderId,
        newStatus
      });
      
      window.dispatchEvent(new CustomEvent("storeOrderStatusChanged", {
        detail: {
          orderId,
          status: newStatus,
          source: "store-orders-list"
        }
      }));
      
      // Show success message
      if (newStatus === "approved") {
        alert("Store order approved successfully! Transfer order created and set to 'In Transit'.");
      } else if (newStatus === "rejected") {
        alert("Store order rejected successfully.");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      // Only show error alert if it's not already shown above
      if (!error.message.includes("Insufficient stock - see details above")) {
        alert(`Error updating status: ${error.message}`);
      }
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };
  
  // Calculate total quantity requested
  const getTotalQuantity = (order) => {
    if (!order.items || !Array.isArray(order.items)) return 0;
    return order.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  };
  
  const getStatusPillStyles = (status) => {
    const colorMap = {
      draft: { bg: "#F4F4F5", text: "#525252", border: "#E4E4E7", dot: "#71717A" },
      pending: { bg: "#FFF1EC", text: "#EA580C", border: "#FED7AA", dot: "#EA580C" },
      approved: { bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0", dot: "#16A34A" },
      rejected: { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA", dot: "#DC2626" },
      transferred: { bg: "#FDE3D9", text: "#F2572B", border: "#FCCAB9", dot: "#F2572B" },
    };
    const c = colorMap[status] || colorMap.pending;
    return {
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
      valueContainer: (base) => ({ ...base, padding: "0 4px 0 10px" }),
      singleValue: (base) => ({
        ...base,
        color: c.text,
        fontSize: "12px",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        "&::before": {
          content: '""',
          display: "inline-block",
          width: "6px",
          height: "6px",
          borderRadius: "9999px",
          backgroundColor: c.dot,
          flexShrink: 0,
        },
      }),
      indicatorSeparator: () => ({ display: "none" }),
      dropdownIndicator: (base) => ({ ...base, color: c.text, padding: "0 6px 0 2px", "&:hover": { color: c.text } }),
      menu: (base) => ({ ...base, borderRadius: "10px", border: "1px solid #E5E5E5", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", overflow: "hidden", minWidth: "130px" }),
    };
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Store Orders" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#212121]">Store Orders</h1>
          <div className="flex items-center gap-2.5">
            {isAdmin && selectedOrders.size > 0 && (
              <button
                onClick={handleDeleteClick}
                className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-[#DC2626] px-4 text-[13px] font-semibold text-white transition hover:bg-[#B91C1C] shadow-xs cursor-pointer"
              >
                <Trash2 size={15} />
                <span>Delete ({selectedOrders.size})</span>
              </button>
            )}
            <Link
              to="/inventory/store-orders/new"
              className="rf-btn-primary inline-flex items-center gap-1.5 !h-[38px] !px-5 !text-[13px]"
            >
              <span className="text-[16px] leading-none">+</span>
              <span>New Store Order</span>
            </Link>
          </div>
        </div>
        <div className="p-5 md:p-6">
          {/* Row 2: Search Input (left) & Segmented Status Tabs (right) */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="relative w-full sm:w-[300px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#525252] pointer-events-none" size={15} />
              <input
                type="text"
                placeholder="Search by order number, reason or store..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="rf-input !pl-10 !h-[42px] bg-white"
              />
            </div>

            <div className="inline-flex flex-wrap items-center bg-[#F4F4F5] rounded-[12px] p-1 gap-1">
              {[
                { key: "all", label: "All", count: storeOrders.length },
                { key: "pending", label: "Pending", count: pendingCount },
                { key: "approved", label: "Approved", count: approvedCount },
                { key: "rejected", label: "Rejected", count: rejectedCount },
                { key: "transferred", label: "Transferred", count: transferredCount },
                { key: "draft", label: "Draft", count: draftCount },
              ].map(({ key, label, count }) => {
                const isActive = statusFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-[12px] transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-white shadow-xs text-[#1B1B1B] font-semibold"
                        : "text-[#7A7A7A] hover:text-[#212121] font-medium"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[20px] h-[18px] text-[10px] font-semibold tabular-nums ${
                        isActive ? "bg-[#F2572B] text-white" : "bg-[#FDE3D9] text-[#F2572B]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Card */}
          <div className="border border-[#E5E5E5] rounded-[12px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-white">
                      {["", "DATE", "ORDER #", "STORE / WAREHOUSE", "REASON", "STATUS", "ITEMS", "TOTAL QTY", "CREATED BY", "CREATED TIME", "LAST MODIFIED"].map((col, i) => (
                        <th key={i} className="px-4 py-3.5 text-left text-[11px] font-semibold tracking-wider text-white uppercase whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 11 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-4 bg-[#ECECEF] rounded w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : filteredOrders.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto w-12 h-12 rounded-[12px] bg-[#FDE3D9] flex items-center justify-center mb-3">
                    <Search className="text-[#F2572B]" size={22} />
                  </div>
                  <p className="text-[14px] font-semibold text-[#1B1B1B] mb-1">
                    {searchTerm ? "No store orders found" : "No store orders yet"}
                  </p>
                  <p className="text-[12px] text-[#7A7A7A] mb-4">
                    {searchTerm ? "Try adjusting your search" : "Create your first store order to get started"}
                  </p>
                  {!searchTerm && (
                    <Link
                      to="/inventory/store-orders/new"
                      className="rf-btn-primary inline-flex items-center gap-2 !h-[38px] !px-4 !text-[13px]"
                    >
                      + Create Store Order
                    </Link>
                  )}
                </div>
              ) : (
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1B1B1B] text-white">
                      <th className="px-4 py-3.5 text-center w-12">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded-[4px] border-gray-500 accent-[#F2572B] cursor-pointer align-middle"
                          checked={pagedOrders.length > 0 && pagedOrders.every(order => {
                            const id = order._id || order.id;
                            return !id || selectedOrders.has(id);
                          })}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </th>
                      {[
                        "DATE", "ORDER #", "STORE / WAREHOUSE", "REASON",
                        "STATUS",
                        "ITEMS", "TOTAL QTY", "CREATED BY", "CREATED TIME", "LAST MODIFIED"
                      ].map((col, i) => (
                        <th key={col} className={`px-4 py-3.5 ${i === 4 || i === 5 || i === 6 ? 'text-center' : 'text-left'} text-[11px] font-semibold tracking-wider text-white uppercase whitespace-nowrap`}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] bg-white">
                    {pagedOrders.map((order) => (
                      <tr
                        key={order._id || order.id}
                        className="hover:bg-[#FAFAFA] transition-colors cursor-pointer group"
                        onClick={() => navigate(`/inventory/store-orders/${order._id || order.id}`)}
                      >
                        <td className="px-4 py-3.5 text-center border-r border-[#F5F5F5]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded-[4px] border-[#D4D4D8] cursor-pointer accent-[#F2572B] align-middle"
                              checked={selectedOrders.has(order._id || order.id)}
                              onChange={(e) => handleCheckboxChange(order._id || order.id, e.target.checked)}
                            />
                            {isAdmin && selectedOrders.has(order._id || order.id) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSingleDelete(order);
                                }}
                                className="p-1 text-[#DC2626] hover:bg-[#FEF2F2] rounded transition-colors cursor-pointer"
                                title="Delete this store order"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-[#525252] border-r border-[#F5F5F5]">
                          {formatDate(order.date)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[13px] border-r border-[#F5F5F5]">
                          <span
                            className="font-semibold text-[#F2572B] group-hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/inventory/store-orders/${order._id || order.id}`);
                            }}
                          >
                            {order.orderNumber || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-[#7A7A7A] border-r border-[#F5F5F5]">
                          {order.storeWarehouse || "-"}
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-[#7A7A7A] border-r border-[#F5F5F5] max-w-xs truncate">
                          {order.reason || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[13px] text-center border-r border-[#F5F5F5]" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center justify-center">
                            <AppSelect
                              value={order.status || "pending"}
                              disabled={updatingStatus.has(order._id || order.id)}
                              isSearchable={false}
                              styles={getStatusPillStyles(order.status || "pending")}
                              onChange={(e) => {
                                const newStatus = e.target.value;
                                handleStatusChange(order._id || order.id, newStatus);
                              }}
                            >
                              <option value="draft">Draft</option>
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                              <option value="transferred">Transferred</option>
                            </AppSelect>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-center font-semibold text-[#1B1B1B] tabular-nums border-r border-[#F5F5F5]">
                          {order.items && Array.isArray(order.items) ? order.items.length : 0}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-center font-semibold text-[#1B1B1B] tabular-nums border-r border-[#F5F5F5]">
                          {Math.round(getTotalQuantity(order))}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-[#7A7A7A] border-r border-[#F5F5F5]">
                          {order.createdBy || "-"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-[#7A7A7A] border-r border-[#F5F5F5]">
                          {formatDateTime(order.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[13px] text-[#7A7A7A]">
                          {formatDateTime(order.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Footer */}
            {!loading && filteredOrders.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-t border-[#F0F0F0] bg-white">
                <div className="text-[12px] text-[#7A7A7A]">
                  Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length} orders
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium text-[#525252] hover:text-[#1B1B1B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <span>←</span>
                    <span>Previous</span>
                  </button>

                  {getPageNumbers().map((page, idx) =>
                    page === "..." ? (
                      <span key={`dots-${idx}`} className="px-1.5 text-[13px] text-[#7A7A7A] select-none">
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-[8px] text-[13px] font-semibold transition cursor-pointer flex items-center justify-center ${
                          safePage === page
                            ? "bg-[#1B1B1B] text-white shadow-xs"
                            : "text-[#525252] hover:text-[#1B1B1B] hover:bg-[#F4F4F5]"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium text-[#1B1B1B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <span>Next</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2-Step Delete Confirmation Modal */}
          <RootfinConfirmModal
            open={showDeleteModal}
            onClose={handleCancelDelete}
            onConfirm={deleteStep === 1 ? handleConfirmDeleteStep1 : handleConfirmDeleteStep2}
            title={
              deleteStep === 1
                ? `Delete ${ordersToDelete.length === 1 ? "this store order" : `${ordersToDelete.length} store orders`}?`
                : "Final Confirmation"
            }
            description={
              deleteStep === 1
                ? `Are you sure you want to delete ${ordersToDelete.length === 1 ? "this store order" : `these ${ordersToDelete.length} store orders`}? This action cannot be undone.`
                : `This action cannot be undone. Are you absolutely sure you want to delete ${ordersToDelete.length === 1 ? "this store order" : `these ${ordersToDelete.length} store orders`}?`
            }
            cancelLabel="Cancel"
            confirmLabel={deleteStep === 1 ? "Continue" : deleting ? "Deleting..." : "Delete"}
            confirmIcon={!deleting ? <Trash2 size={15} /> : null}
            variant="danger"
            loading={deleting}
          >
            {deleteStep === 1 &&
              ordersToDelete.some((order) => order.status === "approved" || order.status === "transferred") && (
                <div className="p-3 rounded-[12px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[12px] font-medium text-center">
                  Some orders are already approved or transferred. This action cannot be undone.
                </div>
              )}
          </RootfinConfirmModal>
        </div>
      </div>
    </div>
  );
};

export default StoreOrders;
