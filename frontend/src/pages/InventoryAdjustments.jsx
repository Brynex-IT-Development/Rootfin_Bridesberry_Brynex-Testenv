import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X, Plus, Trash2, AlertTriangle } from "lucide-react";
import Header from "../components/Header";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse as mapWarehouse } from "../utils/warehouseMapping";
import useSidebar from "../hooks/useSidebar";
import Select from "react-select";

import { appSelectStyles } from "../components/AppSelect.jsx";
import RootfinConfirmModal from "../components/RootfinModal";
import { getUserStoreName } from "../utils/storeService";
const InventoryAdjustments = () => {
  const isSidebarOpen = useSidebar();
  const navigate = useNavigate();
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  
  // Get user info
  const userStr = localStorage.getItem("rootfinuser");
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.email || user?._id || user?.id || "";
  const isAdmin = user?.power === "admin";
  
  // Fallback locations mapping
  const fallbackLocations = [];
  
  // Get location name - prioritize locCode lookup over username
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
  
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    type: "All",
    status: "All",
    period: "All",
  });
  const [selectedAdjustments, setSelectedAdjustments] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = first confirmation, 2 = second confirmation
  const [deleting, setDeleting] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState([]);
  
  // Helper function to map locName to warehouse name
  // Use the shared warehouse mapping utility
  const mapLocNameToWarehouse = (locName) => {
    if (!locName) return "";
    return mapWarehouse(locName);
  };
  
  // Get user's warehouse name
  const userWarehouse = mapLocNameToWarehouse(userLocName);
  
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
  
  // Fetch adjustments
  useEffect(() => {
    const fetchAdjustments = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (userId) params.append("userId", userId);
        if (filters.type !== "All") params.append("adjustmentType", filters.type.toLowerCase());
        if (filters.status !== "All") params.append("status", filters.status.toLowerCase());
        
        // For non-admin users AND admins viewing specific store, filter by warehouse in the backend
        if (userWarehouse) {
          params.append("warehouse", userWarehouse);
          console.log(`🔍 Inventory Adjustments: Filtering by warehouse: "${userWarehouse}"`);
        }
        if (user?.power) params.append("userPower", user.power);
        if (user?.locCode) params.append("locCode", user.locCode);
        
        const fullUrl = `${API_URL}/api/inventory/adjustments?${params}`;
        console.log(`📡 Inventory Adjustments: Fetching from: ${fullUrl}`);
        
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error("Failed to fetch adjustments");
        const data = await response.json();
        let adjustmentsList = Array.isArray(data) ? data : [];
        
        // Additional client-side filtering as backup (in case backend doesn't filter)
        if (!isAdmin && userWarehouse) {
          const beforeFilter = adjustmentsList.length;
          const userWarehouseLower = userWarehouse.toLowerCase();
          adjustmentsList = adjustmentsList.filter(adj => {
            const adjWarehouse = (adj.warehouse || "").toLowerCase();
            const adjBase = adjWarehouse.replace(/\s*(branch|warehouse)\s*$/i, "").trim();
            const userBase = userWarehouseLower.replace(/\s*(branch|warehouse)\s*$/i, "").trim();
            
            return adjWarehouse === userWarehouseLower || 
                   adjBase === userBase ||
                   adjWarehouse.includes(userWarehouseLower) ||
                   userWarehouseLower.includes(adjWarehouse);
          });
          console.log(`✅ Inventory Adjustments: Filtered to ${adjustmentsList.length} adjustments (from ${beforeFilter}) for warehouse: "${userWarehouse}"`);
        }
        
        setAdjustments(adjustmentsList);
      } catch (error) {
        console.error("Error fetching adjustments:", error);
        setAdjustments([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAdjustments();
  }, [API_URL, userId, filters.type, filters.status, isAdmin, userWarehouse]);
  
  // Helper function to check if date is in period
  const isDateInPeriod = (date, period) => {
    if (!date || period === "All") return true;
    
    try {
      const adjustmentDate = new Date(date);
      if (isNaN(adjustmentDate.getTime())) return true; // If date is invalid, include it
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDay = now.getDate();
      
      const adjYear = adjustmentDate.getFullYear();
      const adjMonth = adjustmentDate.getMonth();
      
      switch (period) {
        case "This Month":
          return adjYear === currentYear && adjMonth === currentMonth;
        case "Last Month":
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return adjYear === lastMonthYear && adjMonth === lastMonth;
        case "This Year":
          return adjYear === currentYear;
        default:
          return true;
      }
    } catch {
      return true; // If error parsing date, include it
    }
  };

  // Filter adjustments by search term and period
  const filteredAdjustments = adjustments.filter(adjustment => {
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const adjustmentId = adjustment.id || adjustment._id || "";
      const matchesSearch = (
        (adjustment.referenceNumber || "").toLowerCase().includes(searchLower) ||
        (adjustment.reason || "").toLowerCase().includes(searchLower) ||
        (adjustment.description || "").toLowerCase().includes(searchLower) ||
        (adjustment.warehouse || "").toLowerCase().includes(searchLower) ||
        String(adjustmentId).toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }
    
    // Filter by period
    if (filters.period !== "All") {
      const adjustmentDate = adjustment.date || adjustment.createdAt;
      if (!isDateInPeriod(adjustmentDate, filters.period)) {
        return false;
      }
    }
    
    // Filter by type (client-side backup, though backend should handle this)
    if (filters.type !== "All") {
      const adjustmentType = (adjustment.adjustmentType || "").toLowerCase();
      const filterType = filters.type.toLowerCase();
      if (adjustmentType !== filterType) {
        return false;
      }
    }
    
    // Filter by status (client-side backup, though backend should handle this)
    if (filters.status !== "All") {
      const adjustmentStatus = (adjustment.status || "").toLowerCase();
      const filterStatus = filters.status.toLowerCase();
      if (adjustmentStatus !== filterStatus) {
        return false;
      }
    }
    
    return true;
  });

  // Handle adjustment click - navigate to detail page
  const handleAdjustmentClick = (adjustment) => {
    const adjustmentId = adjustment.id || adjustment._id;
    if (adjustmentId) {
      navigate(`/inventory/adjustments/${adjustmentId}`);
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = (adjustmentId, isChecked) => {
    const newSelected = new Set(selectedAdjustments);
    if (isChecked) {
      newSelected.add(adjustmentId);
    } else {
      newSelected.delete(adjustmentId);
    }
    setSelectedAdjustments(newSelected);
  };

  // Handle select all checkbox
  const handleSelectAll = (isChecked) => {
    if (isChecked) {
      const allIds = filteredAdjustments.map(adj => adj.id || adj._id).filter(Boolean);
      setSelectedAdjustments(new Set(allIds));
    } else {
      setSelectedAdjustments(new Set());
    }
  };

  // Handle delete button click
  const handleDeleteClick = () => {
    const selectedIds = Array.from(selectedAdjustments);
    if (selectedIds.length === 0) return;
    
    const items = filteredAdjustments.filter(adj => {
      const id = adj.id || adj._id;
      return selectedIds.includes(id);
    });
    
    setItemsToDelete(items);
    setDeleteStep(1);
    setShowDeleteModal(true);
  };

  // Handle single delete from checkbox
  const handleSingleDelete = (adjustment) => {
    const adjustmentId = adjustment.id || adjustment._id;
    if (!adjustmentId) return;
    
    setItemsToDelete([adjustment]);
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
      const deletePromises = itemsToDelete.map(async (adjustment) => {
        const adjustmentId = adjustment.id || adjustment._id;
        if (!adjustmentId) return;
        
        const response = await fetch(`${API_URL}/api/inventory/adjustments/${adjustmentId}`, {
          method: "DELETE",
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to delete adjustment");
        }
        
        return adjustmentId;
      });

      await Promise.all(deletePromises);
      
      // Remove deleted items from selected set
      const deletedIds = itemsToDelete.map(adj => adj.id || adj._id).filter(Boolean);
      const newSelected = new Set(selectedAdjustments);
      deletedIds.forEach(id => newSelected.delete(id));
      setSelectedAdjustments(newSelected);
      
      // Refresh the list
      const params = new URLSearchParams();
      if (userId) params.append("userId", userId);
      if (filters.type !== "All") params.append("adjustmentType", filters.type.toLowerCase());
      if (filters.status !== "All") params.append("status", filters.status.toLowerCase());
      
      if (!isAdmin && userWarehouse) {
        params.append("warehouse", userWarehouse);
      }
      
      const response = await fetch(`${API_URL}/api/inventory/adjustments?${params}`);
      if (response.ok) {
        const data = await response.json();
        let adjustmentsList = Array.isArray(data) ? data : [];
        
        if (!isAdmin && userWarehouse) {
          const userWarehouseLower = userWarehouse.toLowerCase();
          adjustmentsList = adjustmentsList.filter(adj => {
            const adjWarehouse = (adj.warehouse || "").toLowerCase();
            const adjBase = adjWarehouse.replace(/\s*(branch|warehouse)\s*$/i, "").trim();
            const userBase = userWarehouseLower.replace(/\s*(branch|warehouse)\s*$/i, "").trim();
            
            return adjWarehouse === userWarehouseLower || 
                   adjBase === userBase ||
                   adjWarehouse.includes(userWarehouseLower) ||
                   userWarehouseLower.includes(adjWarehouse);
          });
        }
        
        setAdjustments(adjustmentsList);
      }
      
      setShowDeleteModal(false);
      setDeleteStep(1);
      setItemsToDelete([]);
      alert(`Successfully deleted ${itemsToDelete.length} adjustment(s)`);
    } catch (error) {
      console.error("Error deleting adjustments:", error);
      alert(`Error deleting adjustments: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Cancel delete
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteStep(1);
    setItemsToDelete([]);
  };

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '40px',
      height: '40px',
      border: state.isFocused ? '1px solid #F2572B' : '1px solid #E5E7EB',
      borderRadius: '0px',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(242, 87, 43,0.15)' : 'none',
      fontSize: '0.875rem',
      backgroundColor: 'white',
      transition: 'all 0.15s ease',
      cursor: 'pointer',
      '&:hover': { border: '1px solid #cbd5e1' }
    }),
    valueContainer: base => ({ ...base, height: '40px', padding: '0 12px' }),
    input: base => ({ ...base, margin: '0px', padding: '0px' }),
    indicatorSeparator: base => ({ ...base, display: 'none' }),
    dropdownIndicator: (base, state) => ({
      ...base,
      padding: '0 12px',
      transition: 'transform 0.2s ease',
      transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      color: '#6b7280'
    }),
    singleValue: base => ({
      ...base,
      color: '#1f2937'
    }),
    menu: base => ({
      ...base,
      zIndex: 9999,
      borderRadius: '0px',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
      marginTop: '2px',
      backgroundColor: 'white',
      overflow: 'hidden'
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '0.875rem',
      cursor: 'pointer',
      backgroundColor: state.isSelected ? '#F2572B' : state.isFocused ? '#f5f3ff' : 'white',
      color: state.isSelected ? 'white' : '#1f2937',
      padding: '10px 12px',
      '&:active': { backgroundColor: '#F2572B', color: 'white' }
    })
  };

  const renderFilterOptionLabel = (prefix) => (option, { context }) => {
    if (context === "value") {
      return (
        <span className="inline-flex items-center gap-1 text-[13px]">
          <span className="text-[#8A8A8A] font-normal">{prefix} :</span>
          <span className="text-[#1B1B1B] font-medium">{option.value}</span>
        </span>
      );
    }
    return <span>{option.value}</span>;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Inventory Adjustment" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#212121]">Inventory Adjustment</h1>
        </div>
        <div className="p-5 md:p-6">
          {/* ── Row 1: Filter By Dropdowns + New Adjustment Button ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-medium text-[#212121] whitespace-nowrap">
                Filter By :
              </span>

              <div className="min-w-[132px]">
                <Select
                  classNamePrefix="rf-select"
                  value={{ value: filters.type, label: filters.type }}
                  onChange={(opt) => setFilters({ ...filters, type: opt.value })}
                  options={[
                    { value: "All", label: "All" },
                    { value: "Quantity", label: "Quantity" },
                    { value: "Value", label: "Value" }
                  ]}
                  formatOptionLabel={renderFilterOptionLabel("Type")}
                  styles={appSelectStyles}
                  isSearchable={false}
                />
              </div>

              <div className="min-w-[138px]">
                <Select
                  classNamePrefix="rf-select"
                  value={{ value: filters.status, label: filters.status }}
                  onChange={(opt) => setFilters({ ...filters, status: opt.value })}
                  options={[
                    { value: "All", label: "All" },
                    { value: "Draft", label: "Draft" },
                    { value: "Adjusted", label: "Adjusted" }
                  ]}
                  formatOptionLabel={renderFilterOptionLabel("Status")}
                  styles={appSelectStyles}
                  isSearchable={false}
                />
              </div>

              <div className="min-w-[142px]">
                <Select
                  classNamePrefix="rf-select"
                  value={{ value: filters.period, label: filters.period }}
                  onChange={(opt) => setFilters({ ...filters, period: opt.value })}
                  options={[
                    { value: "All", label: "All" },
                    { value: "This Month", label: "This Month" },
                    { value: "Last Month", label: "Last Month" },
                    { value: "This Year", label: "This Year" }
                  ]}
                  formatOptionLabel={renderFilterOptionLabel("Period")}
                  styles={appSelectStyles}
                  isSearchable={false}
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {selectedAdjustments.size > 0 && (
                <button
                  onClick={handleDeleteClick}
                  className="inline-flex h-[40px] items-center gap-2 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] px-4 text-[13px] font-semibold text-[#DC2626] transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete ({selectedAdjustments.size})</span>
                </button>
              )}
              <Link
                to="/inventory/adjustments/new"
                className="rf-btn-primary inline-flex items-center gap-2 !h-[40px] !px-5 !text-[13px]"
              >
                <Plus size={15} className="text-white" />
                <span>New Adjustment</span>
              </Link>
            </div>
          </div>

          {/* ── Row 2: Search Input + Adjustments Count Pill ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-[360px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#525252] pointer-events-none" />
              <input
                type="text"
                placeholder="Search by reference number, reasons, or description"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rf-input !pl-10 !h-[42px] bg-white"
              />
            </div>

            <span className="inline-flex items-center rounded-full bg-[#FDE3D9]/70 px-3.5 py-1.5 text-[12px] font-semibold text-[#F2572B]">
              {filteredAdjustments.length} {filteredAdjustments.length === 1 ? "Adjustment" : "Adjustments"}
            </span>
          </div>

          {/* ── Main Content Card ── */}
          <section className="rounded-[12px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="px-8 py-20 text-center flex flex-col items-center justify-center">
                  <div className="inline-block animate-spin h-6 w-6 rounded-full border-2 border-[#F2572B] border-t-transparent mb-3" />
                  <p className="text-[13px] font-medium text-[#7A7A7A]">Loading adjustments...</p>
                </div>
              ) : filteredAdjustments.length === 0 ? (
                <div className="px-8 py-16 text-center flex flex-col items-center justify-center min-h-[290px]">
                  {/* Empty State Illustration */}
                  <div className="mb-4 select-none">
                    <svg width="160" height="116" viewBox="0 0 160 116" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="82" cy="104" rx="58" ry="6" fill="#FDE3D9" />
                      {/* Clipboard */}
                      <rect x="64" y="16" width="56" height="78" rx="8" fill="#FEF3EE" stroke="#F6825F" strokeWidth="2" />
                      <rect x="78" y="10" width="28" height="12" rx="4" fill="#F46A43" />
                      <circle cx="92" cy="16" r="2" fill="#FFFFFF" />
                      {/* Sad document icon inside clipboard */}
                      <rect x="76" y="38" width="32" height="36" rx="5" fill="#FFFFFF" stroke="#F9A88E" strokeWidth="1.5" />
                      <circle cx="87" cy="52" r="1.8" fill="#F2572B" />
                      <circle cx="97" cy="52" r="1.8" fill="#F2572B" />
                      <path d="M87 62C89 59.5 95 59.5 97 62" stroke="#F2572B" strokeWidth="1.8" strokeLinecap="round" />
                      {/* X badge */}
                      <circle cx="107" cy="70" r="8" fill="#F2572B" />
                      <path d="M104 67L110 73M110 67L104 73" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
                      {/* Decorative leaves */}
                      <path d="M128 94V66" stroke="#F6825F" strokeWidth="2" strokeLinecap="round" />
                      <ellipse cx="135" cy="74" rx="6" ry="3.5" transform="rotate(-30 135 74)" fill="#F9A88E" />
                      <ellipse cx="123" cy="80" rx="5.5" ry="3" transform="rotate(28 123 80)" fill="#FCCAB9" />
                      {/* Magnifying glass */}
                      <circle cx="52" cy="50" r="13" fill="#FFFFFF" stroke="#F2572B" strokeWidth="2.5" />
                      <circle cx="52" cy="50" r="8" fill="#FDE3D9" />
                      <path d="M43 60L33 72" stroke="#B23614" strokeWidth="3.5" strokeLinecap="round" />
                      {/* Sparkles */}
                      <circle cx="32" cy="34" r="3" fill="#FCCAB9" />
                      <circle cx="134" cy="40" r="2.5" fill="#DDD6FE" />
                      <circle cx="142" cy="52" r="4" fill="#FDE3D9" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#1B1B1B] mb-1">
                    {searchTerm ? "No adjustments found" : "No adjustments yet"}
                  </h3>
                  <p className="text-[13px] text-[#7A7A7A] max-w-sm">
                    {searchTerm ? "Try adjusting your search or filters" : "Create your first inventory adjustment to get started"}
                  </p>
                </div>
              ) : (
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#1B1B1B] text-white text-[11px] uppercase tracking-wider font-semibold">
                      <th className="w-11 px-3 py-3.5 text-center border-r border-[#2E2E2E] whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded-[4px] border-gray-500 accent-[#F2572B] cursor-pointer align-middle"
                          checked={filteredAdjustments.length > 0 && filteredAdjustments.every(adj => {
                            const id = adj.id || adj._id;
                            return id && selectedAdjustments.has(id);
                          })}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-3.5 py-3.5 text-left border-r border-[#2E2E2E] whitespace-nowrap">Date</th>
                      <th className="px-3.5 py-3.5 text-left border-r border-[#2E2E2E] whitespace-nowrap">Reference Number</th>
                      <th className="px-3.5 py-3.5 text-left border-r border-[#2E2E2E] whitespace-nowrap">Reason</th>
                      <th className="px-3.5 py-3.5 text-left border-r border-[#2E2E2E] whitespace-nowrap">Type</th>
                      <th className="px-3.5 py-3.5 text-left border-r border-[#2E2E2E] whitespace-nowrap">Status</th>
                      <th className="px-3.5 py-3.5 text-left border-r border-[#2E2E2E] whitespace-nowrap">Warehouse</th>
                      <th className="px-3.5 py-3.5 text-left border-r border-[#2E2E2E] whitespace-nowrap">Created By</th>
                      <th className="px-3.5 py-3.5 text-left border-r border-[#2E2E2E] whitespace-nowrap">Created Time</th>
                      <th className="px-3.5 py-3.5 text-left whitespace-nowrap">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] text-[13px] text-[#212121]">
                    {filteredAdjustments.map((adjustment, index) => {
                      const adjustmentId = adjustment.id || adjustment._id;
                      if (!adjustmentId) return null;
                      return (
                        <tr
                          key={adjustmentId}
                          className={`${index % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]/60"} hover:bg-[#FDE3D9]/25 transition-colors cursor-pointer group`}
                          onClick={() => handleAdjustmentClick(adjustment)}
                        >
                          <td className="px-3 py-3 text-center border-r border-[#F0F0F0]" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#F2572B] cursor-pointer align-middle"
                                checked={selectedAdjustments.has(adjustmentId)}
                                onChange={(e) => handleCheckboxChange(adjustmentId, e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap text-[#525252] border-r border-[#F0F0F0]">
                            {formatDate(adjustment.date)}
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap font-semibold border-r border-[#F0F0F0]">
                            <span
                              className="text-[#F2572B] hover:text-[#D9431A] hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdjustmentClick(adjustment);
                              }}
                            >
                              {adjustment.referenceNumber || (adjustmentId && String(adjustmentId).slice(-8)) || "-"}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-[#1B1B1B] font-medium border-r border-[#F0F0F0]">
                            {adjustment.reason || "-"}
                          </td>
                          <td className="px-3.5 py-3 text-[#525252] border-r border-[#F0F0F0]">
                            <span className="inline-flex items-center rounded-[6px] bg-[#F4F4F5] border border-[#E5E5E5] px-2 py-0.5 text-[11px] font-semibold text-[#525252]">
                              {adjustment.adjustmentType === "quantity" ? "QUANTITY" : "VALUE"}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 border-r border-[#F0F0F0]">
                            <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-[6px] ${
                              adjustment.status === "adjusted"
                                ? "bg-[#DCFCE7] text-[#16A34A]"
                                : "bg-[#F4F4F5] text-[#525252]"
                            }`}>
                              {adjustment.status === "adjusted" ? "ADJUSTED" : "DRAFT"}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-[#525252] border-r border-[#F0F0F0]">
                            {adjustment.warehouse || "-"}
                          </td>
                          <td className="px-3.5 py-3 text-[#525252] border-r border-[#F0F0F0]">
                            {adjustment.createdBy || "-"}
                          </td>
                          <td className="px-3.5 py-3 text-[#7A7A7A] border-r border-[#F0F0F0] whitespace-nowrap">
                            {formatDateTime(adjustment.createdAt)}
                          </td>
                          <td className="px-3.5 py-3 text-[#525252] max-w-xs truncate">
                            {adjustment.description || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        {/* 2-Step Delete Confirmation Modal */}
        <RootfinConfirmModal
          open={showDeleteModal}
          onClose={deleteStep === 1 ? handleCancelDelete : () => setDeleteStep(1)}
          onConfirm={deleteStep === 1 ? handleConfirmDeleteStep1 : handleConfirmDeleteStep2}
          title={
            deleteStep === 1
              ? `Delete ${itemsToDelete.length === 1 ? "this adjustment" : `${itemsToDelete.length} adjustments`}?`
              : "Final Confirmation"
          }
          description={
            deleteStep === 1
              ? `Are you sure you want to delete ${itemsToDelete.length === 1 ? "this adjustment" : `these ${itemsToDelete.length} adjustments`}? This action cannot be undone.`
              : `This action cannot be undone. Are you absolutely sure you want to delete ${itemsToDelete.length === 1 ? "this adjustment" : `these ${itemsToDelete.length} adjustments`}?`
          }
          cancelLabel={deleteStep === 1 ? "Cancel" : "Back"}
          confirmLabel={deleteStep === 1 ? "Continue" : deleting ? "Deleting..." : "Delete"}
          confirmIcon={!deleting ? <Trash2 size={15} /> : null}
          variant="danger"
          loading={deleting}
        >
          {deleteStep === 1 && itemsToDelete.some((item) => item.status === "adjusted") && (
            <div className="p-3 rounded-[12px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[12px] font-medium text-center">
              Some adjustments are already applied. Stock will be reversed before deletion.
            </div>
          )}
          {deleteStep === 2 && itemsToDelete.length > 0 && (
            <div className="p-3 bg-[#FAFAFA] rounded-[12px] max-h-40 overflow-y-auto border border-[#E5E5E5]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A] mb-1.5">
                Items to be deleted
              </p>
              <ul className="text-[12px] text-[#212121] space-y-1">
                {itemsToDelete.map((item, idx) => (
                  <li key={item.id || item._id || idx} className="font-medium">
                    • {item.referenceNumber || `Ref-${String(item.id || item._id).slice(-8)}`} - {item.reason || "No reason"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </RootfinConfirmModal>
      </div>
    </div>
  );
};

export default InventoryAdjustments;
