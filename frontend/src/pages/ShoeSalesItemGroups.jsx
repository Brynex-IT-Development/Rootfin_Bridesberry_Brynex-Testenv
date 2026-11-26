import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Folder, Plus, ChevronLeft, ChevronRight, Trash2, AlertTriangle, Search } from "lucide-react";
import Head from "../components/Head";
import Header from "../components/Header";
import { mapLocNameToWarehouse as mapWarehouse } from "../utils/warehouseMapping";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";


const columns = [
  { key: "select", label: "" },
  { key: "name", label: "NAME" },
  { key: "sku", label: "SKU" },
  { key: "stock", label: "STOCK ON HAND" },
  { key: "reorder", label: "REORDER POINT" }
];

// Generate skeleton rows for loading state (no mock data)
const generateSkeletonRows = (count = 5) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `skeleton-${i}`,
    name: "",
    items: 0,
    sku: "",
    stock: "",
    reorder: "",
    isSkeleton: true
  }));
};
const ShoeSalesItemGroups = () => {
  const navigate = useNavigate();
  const isSidebarOpen = useSidebar();
  const [rows, setRows] = useState([]); // Start with empty array
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1 = first confirmation, 2 = second confirmation
  const [deleting, setDeleting] = useState(false);
  const [groupsToDelete, setGroupsToDelete] = useState([]);
  const [accessMessage, setAccessMessage] = useState(""); // Message for non-admin users
  const [searchTerm, setSearchTerm] = useState("");
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

  const userStr = localStorage.getItem("rootfinuser");
  const user = userStr ? JSON.parse(userStr) : null;
  const userRole = (user?.role || "").toLowerCase().trim();
  const userPower = (user?.power || "").toLowerCase().trim();
  const userEmail = (user?.email || user?.username || "").toLowerCase().trim();
  const adminEmails = [
    "officerootments@gmail.com",
    "operationsrootments@gmail.com",
    "headoffice01@gmail.com"
  ];
  const isAdminEmail = adminEmails.includes(userEmail);
  const isAdmin = isAdminEmail ||
                  userPower === "admin" ||
                  userPower === "super_admin" ||
                  userPower === "superadmin" ||
                  userRole === "admin" ||
                  userRole === "super_admin" ||
                  userRole === "superadmin" ||
                  (user?.locCode && (String(user.locCode) === '858' || String(user.locCode) === '103'));

  const fetchItemGroups = async () => {
    try {
      setLoading(true);
      const userId = user?.email || null;
      const userPower = user?.power || "";
      const userEmail = user?.email || user?.username || "";
      const adminEmails = ['officerootments@gmail.com'];
      const isAdminEmail = userEmail && adminEmails.some(email => userEmail.toLowerCase() === email.toLowerCase());
      const isAdmin = isAdminEmail ||
                      user?.power === "admin" ||
                      (user?.power || "").toLowerCase() === "super_admin" ||
                      (user?.role || "").toLowerCase() === "admin" ||
                      (user?.role || "").toLowerCase() === "super_admin" ||
                      (user?.role || "").toLowerCase() === "superadmin" ||
                      (user?.locCode && (String(user.locCode) === '858' || String(user.locCode) === '103'));
      
      const fallbackLocations = [];
      
      let userLocName = "";
      if (user?.locCode) {
        const location = fallbackLocations.find(loc => loc.locCode === user.locCode || loc.locCode === String(user.locCode));
        if (location) {
          userLocName = location.locName;
        }
      }
      if (!userLocName) {
        userLocName = user?.username || user?.locName || "";
      }
      
      const mapLocNameToWarehouse = (locName) => {
        if (!locName) return "";
        return mapWarehouse(locName);
      };
      
      const userWarehouse = mapLocNameToWarehouse(userLocName);
      
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });
      
      if (searchTerm && searchTerm.trim()) {
        queryParams.append('search', searchTerm.trim());
      }
      
      if (userId) queryParams.append('userId', userId);
      if (userPower) queryParams.append('userPower', userPower);
      if (user?.locCode) queryParams.append('locCode', user.locCode);
      if (userWarehouse && userWarehouse !== "Warehouse") {
        queryParams.append('warehouse', userWarehouse);
      }
      
      const response = await fetch(`${API_URL}/api/shoe-sales/item-groups?${queryParams.toString()}`);
      
      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          setAccessMessage(errorData.message || "You don't have permission to access item groups.");
          setRows([]);
          setTotalItems(0);
          setTotalPages(1);
          return;
        }
        throw new Error("Failed to fetch item groups");
      }

      const data = await response.json();
      setAccessMessage("");
      
      let groups = [];
      let total = 0;
      let pages = 1;
      
      if (Array.isArray(data)) {
        groups = data;
        total = data.length;
        pages = Math.ceil(total / itemsPerPage);
      } else if (data.groups && Array.isArray(data.groups)) {
        groups = data.groups;
        total = data.total || data.totalGroups || groups.length;
        pages = data.totalPages || data.pages || Math.ceil(total / itemsPerPage);
      }

      const formattedRows = groups.map((g) => ({
        id: g._id || g.id,
        name: g.groupName || g.name || "Untitled Group",
        items: typeof g.items === "number" ? g.items : (Array.isArray(g.items) ? g.items.length : (g.totalItems || g.itemCount || 0)),
        sku: g.sku || g.groupSku || "-",
        stock: g.totalStockOnHand !== undefined ? g.totalStockOnHand : (g.stockOnHand !== undefined ? g.stockOnHand : (g.stock !== undefined ? g.stock : 0)),
        reorder: g.reorderPoint || g.reorder || "-",
        image: g.image || g.groupImage || null,
      }));

      setRows(formattedRows);
      setTotalItems(total);
      setTotalPages(pages || 1);
    } catch (err) {
      console.error("Error fetching item groups:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemGroups();
  }, [currentPage, itemsPerPage, searchTerm]);

  const handleSelectAll = (checked) => {
    if (checked) {
      const validIds = rows.filter(row => row.id && !row.id.startsWith('skeleton-')).map(r => r.id);
      setSelectedGroups(new Set(validIds));
    } else {
      setSelectedGroups(new Set());
    }
  };

  const handleCheckboxChange = (id, checked) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleDeleteClick = () => {
    if (selectedGroups.size === 0) return;
    const selectedList = rows.filter(row => selectedGroups.has(row.id));
    setGroupsToDelete(selectedList);
    setDeleteStep(1);
    setShowDeleteModal(true);
  };

  const handleSingleDelete = (group) => {
    setGroupsToDelete([group]);
    setDeleteStep(1);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteStep1 = () => {
    setDeleteStep(2);
  };

  const handleConfirmDeleteStep2 = async () => {
    try {
      setDeleting(true);
      const deletePromises = groupsToDelete.map(group =>
        fetch(`${API_URL}/api/shoe-sales/item-groups/${group.id}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);
      setSelectedGroups(new Set());
      setShowDeleteModal(false);
      setDeleteStep(1);
      setGroupsToDelete([]);
      fetchItemGroups();
    } catch (error) {
      console.error("Error deleting item groups:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteStep(1);
    setGroupsToDelete([]);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Item Groups" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#212121]">Item Groups</h1>
        </div>
        <div className="p-5 md:p-6">
          {/* Top Bar: Search on Left, Action Buttons on Right */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="relative w-full sm:w-[290px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A7A7A] h-4 w-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name or sku"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="rf-input !pl-10 !h-[42px] bg-white"
              />
            </div>

            <div className="flex items-center gap-3">
              {isAdmin && selectedGroups.size > 0 && (
                <button
                  onClick={handleDeleteClick}
                  className="inline-flex h-[40px] items-center gap-2 rounded-[10px] bg-[#DC2626] px-4 text-[13px] font-semibold text-white transition hover:bg-[#B91C1C] shadow-xs cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>Delete ({selectedGroups.size})</span>
                </button>
              )}
              {isAdmin && (
                <Link
                  to="/shoe-sales/item-groups/new"
                  className="rf-btn-primary inline-flex items-center gap-2 !h-[40px] !px-5 !text-[13px]"
                >
                  <Plus size={15} />
                  <span>New Item Group</span>
                </Link>
              )}
            </div>
          </div>

          {/* Subtitle Count Row */}
          <div className="text-[13px] font-medium text-[#525252] mb-3">
            {totalItems} groups | Showing newest first
          </div>

          {/* Table Card */}
          <div className="w-full bg-white rounded-[12px] border border-[#E5E5E5] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#1B1B1B] text-white">
                  <tr>
                    <th scope="col" className="py-3.5 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded-[4px] border-gray-500 accent-[#9D43D6] cursor-pointer align-middle"
                        checked={rows.length > 0 && rows.filter(row => row.id && !row.id.startsWith('skeleton-')).every(row => selectedGroups.has(row.id))}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-[11px] font-semibold tracking-wider text-white uppercase">
                      NAME
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-center text-[11px] font-semibold tracking-wider text-white uppercase w-[18%]">
                      SKU
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-center text-[11px] font-semibold tracking-wider text-white uppercase w-[18%]">
                      STOCK IN HAND
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-center text-[11px] font-semibold tracking-wider text-white uppercase w-[18%]">
                      REORDER POINT
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F0F0F0] bg-white">
                  {loading && rows.length === 0 ? (
                    generateSkeletonRows(6).map((row) => (
                      <tr key={row.id} className="h-[64px]">
                        <td className="py-3 px-4 text-center border-r border-[#F5F5F5]">
                          <span className="inline-block h-4 w-4 rounded-[4px] bg-[#F4F4F5] animate-pulse" />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[8px] bg-[#ECECEF] animate-pulse shrink-0" />
                            <div className="space-y-1.5">
                              <div className="h-3.5 w-32 bg-[#ECECEF] rounded animate-pulse" />
                              <div className="h-3 w-16 bg-[#F4F4F5] rounded animate-pulse" />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="h-3.5 w-10 bg-[#F4F4F5] rounded animate-pulse mx-auto" />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="h-3.5 w-10 bg-[#F4F4F5] rounded animate-pulse mx-auto" />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="h-3.5 w-10 bg-[#F4F4F5] rounded animate-pulse mx-auto" />
                        </td>
                      </tr>
                    ))
                  ) : rows.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} className="py-14 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-[12px] bg-[#F4F4F5] flex items-center justify-center text-[#A1A1AA]">
                            <Folder size={24} />
                          </div>
                          {accessMessage ? (
                            <>
                              <p className="text-[14px] font-semibold text-[#1B1B1B]">Access Restricted</p>
                              <p className="text-[12px] text-[#7A7A7A] max-w-md">{accessMessage}</p>
                              <button
                                onClick={() => navigate("/shoe-sales/items")}
                                className="rf-btn-primary mt-1 !h-[36px] !px-4 !text-[13px]"
                              >
                                Go to Items Page
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-[14px] font-semibold text-[#1B1B1B]">
                                No item groups found
                              </p>
                              <p className="text-[12px] text-[#7A7A7A]">
                                {searchTerm ? "Try a different search term" : "Create your first item group to get started"}
                              </p>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id || row.name} className="h-[64px] hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3 px-4 text-center border-r border-[#F5F5F5]">
                          {row.id && !row.id.startsWith('skeleton-') ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#9D43D6] cursor-pointer align-middle"
                                checked={selectedGroups.has(row.id)}
                                onChange={(e) => handleCheckboxChange(row.id, e.target.checked)}
                              />
                              {isAdmin && selectedGroups.has(row.id) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSingleDelete(row);
                                  }}
                                  className="p-1 rounded-[6px] hover:bg-[#FEF2F2] text-[#DC2626] transition-colors cursor-pointer"
                                  title="Delete this group"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="inline-block h-4 w-4 rounded-[4px] border border-[#E5E5E5] bg-[#FAFAFA]" />
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {row.isSkeleton ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-[8px] bg-[#E5E5E5] animate-pulse shrink-0" />
                              <div className="space-y-1.5">
                                <div className="h-3.5 w-32 bg-[#E5E5E5] rounded animate-pulse" />
                                <div className="h-3 w-16 bg-[#F4F4F5] rounded animate-pulse" />
                              </div>
                            </div>
                          ) : (
                            <Link
                              to={`/shoe-sales/item-groups/${row.id}`}
                              className="flex items-center gap-3.5 group cursor-pointer"
                            >
                              {row.image ? (
                                <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E5E5E5] flex-shrink-0 flex items-center justify-center overflow-hidden p-0.5">
                                  <img src={row.image} alt={row.name} className="w-full h-full object-contain rounded-[6px]" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-[8px] bg-[#D4D4D8]/80 flex-shrink-0 flex items-center justify-center text-[#71717A] group-hover:bg-[#F3E8FF] group-hover:text-[#9D43D6] transition-colors">
                                  <Folder size={16} className="opacity-60" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[#1B1B1B] group-hover:text-[#9D43D6] transition-colors truncate">
                                  {row.name}
                                </p>
                                <p className="text-[11px] text-[#7A7A7A] mt-0.5">
                                  {row.items || 0} Items
                                </p>
                              </div>
                            </Link>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-[13px] text-[#525252]">
                          {row.isSkeleton ? (
                            <div className="h-3.5 w-12 bg-[#ECECEF] rounded animate-pulse mx-auto" />
                          ) : (
                            row.sku || "-"
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-[13px] font-medium text-[#1B1B1B] tabular-nums">
                          {row.isSkeleton ? (
                            <div className="h-3.5 w-10 bg-[#ECECEF] rounded animate-pulse mx-auto" />
                          ) : (
                            row.stock ?? "-"
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-[13px] text-[#525252]">
                          {row.isSkeleton ? (
                            <div className="h-3.5 w-12 bg-[#ECECEF] rounded animate-pulse mx-auto" />
                          ) : (
                            row.reorder || "-"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-t border-[#F0F0F0] bg-white">
              <div className="text-[12px] text-[#7A7A7A]">
                Showing {rows.length > 0 ? ((currentPage - 1) * itemsPerPage + 1) : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} groups
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium text-[#525252] hover:text-[#1B1B1B] hover:bg-[#F4F4F5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>←</span>
                  <span>Previous</span>
                </button>
                <div className="flex items-center gap-1">
                  {(() => {
                    const pages = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (currentPage > 3) pages.push("...");
                      const start = Math.max(2, currentPage - 1);
                      const end = Math.min(totalPages - 1, currentPage + 1);
                      for (let i = start; i <= end; i++) {
                        if (!pages.includes(i)) pages.push(i);
                      }
                      if (currentPage < totalPages - 2) pages.push("...");
                      pages.push(totalPages);
                    }
                    return pages.map((page, idx) => {
                      if (page === "...") {
                        return <span key={`dots-${idx}`} className="px-1.5 text-[13px] text-[#7A7A7A]">...</span>;
                      }
                      const isActive = currentPage === page;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          disabled={loading}
                          className={`w-8 h-8 rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center ${
                            isActive
                              ? "bg-[#1B1B1B] text-white shadow-xs"
                              : "text-[#525252] hover:text-[#1B1B1B] hover:bg-[#F4F4F5]"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    });
                  })()}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium text-[#1B1B1B] hover:bg-[#F4F4F5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Next</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>

          {showDeleteModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-[16px] border border-[#E5E5E5] shadow-2xl max-w-md w-full overflow-hidden">
                <div className="p-6">
                  {deleteStep === 1 ? (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-[10px] bg-[#FEE2E2] flex items-center justify-center">
                          <AlertTriangle className="text-[#DC2626]" size={20} />
                        </div>
                        <h3 className="text-[16px] font-semibold text-[#1B1B1B]">
                          Delete {groupsToDelete.length === 1 ? 'Item Group' : `${groupsToDelete.length} Item Groups`}?
                        </h3>
                      </div>
                      <p className="text-[13px] text-[#525252] mb-6 leading-relaxed">
                        Are you sure you want to delete {groupsToDelete.length === 1 ? 'this item group' : `these ${groupsToDelete.length} item groups`}? 
                        This action cannot be undone and will also delete all items within {groupsToDelete.length === 1 ? 'this group' : 'these groups'}.
                      </p>
                      <div className="flex gap-2.5 justify-end">
                        <button
                          onClick={handleCancelDelete}
                          className="rf-btn-cancel !h-[38px] !px-4 !text-[13px]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmDeleteStep1}
                          className="inline-flex items-center justify-center h-[38px] px-4 text-[13px] font-semibold text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition-colors cursor-pointer"
                        >
                          Continue
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-[10px] bg-[#FEE2E2] flex items-center justify-center">
                          <AlertTriangle className="text-[#DC2626]" size={20} />
                        </div>
                        <h3 className="text-[16px] font-semibold text-[#1B1B1B]">
                          Final Confirmation
                        </h3>
                      </div>
                      <p className="text-[13px] text-[#525252] mb-4 leading-relaxed">
                        This action cannot be undone. Are you absolutely sure you want to delete {groupsToDelete.length === 1 ? 'this item group' : `these ${groupsToDelete.length} item groups`}?
                      </p>
                      {groupsToDelete.length > 0 && (
                        <div className="mb-5 p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[10px] max-h-40 overflow-y-auto">
                          <p className="text-[11px] font-semibold text-[#7A7A7A] uppercase tracking-wider mb-2">Item groups to be deleted:</p>
                          <ul className="text-[12px] text-[#212121] space-y-1">
                            {groupsToDelete.map((group, idx) => (
                              <li key={group.id || idx}>
                                • {group.name} {group.sku ? `(${group.sku})` : ''} - {group.items} items
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex gap-2.5 justify-end">
                        <button
                          onClick={() => setDeleteStep(1)}
                          className="rf-btn-cancel !h-[38px] !px-4 !text-[13px]"
                          disabled={deleting}
                        >
                          Back
                        </button>
                        <button
                          onClick={handleConfirmDeleteStep2}
                          disabled={deleting}
                          className="inline-flex items-center justify-center gap-2 h-[38px] px-4 text-[13px] font-semibold text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {deleting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Deleting...
                            </>
                          ) : (
                            'Confirm Delete'
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

export default ShoeSalesItemGroups;

const PrimaryButton = ({ children, to, onClick }) => {
  const Component = to ? Link : "button";
  return (
    <Component
      to={to}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-[#4285f4] px-4 text-sm font-medium text-white transition hover:bg-[#3367d6] active:bg-[#2851a3]"
    >
      {children}
    </Component>
  );
};

const MutedButton = ({ children }) => (
  <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d2d8e4] bg-white text-[#2f3445] transition hover:bg-[#eef1f7] active:bg-[#e2e6f0]">
    {children}
  </button>
);
