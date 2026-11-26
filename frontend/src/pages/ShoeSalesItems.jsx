import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal, Plus, ChevronLeft, ChevronRight, Trash2, AlertTriangle, Search, FolderPlus, Layers, Check, CheckCircle2, X, Barcode, Copy, Pencil, Save, Scissors } from "lucide-react";
import Head from "../components/Head";
import Header from "../components/Header";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse as mapWarehouse } from "../utils/warehouseMapping";
import { useSidebar } from "../hooks/useSidebar.js";

import AppSelect from "../components/AppSelect.jsx";
import RootfinConfirmModal from "../components/RootfinModal";
const columns = [
  { key: "select", label: "" },
  { key: "name", label: "NAME" },
  { key: "sku", label: "SKU" },
  { key: "reorder", label: "REORDER LEVEL" }
];

const API_ROOT = (baseUrl?.baseUrl || "").replace(/\/$/, "");

const ShoeSalesItems = () => {
  const isSidebarOpen = useSidebar();
  const skeletonRows = useMemo(() => Array.from({ length: 6 }), []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Add to Group Modal State
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
  const [groupOption, setGroupOption] = useState("existing"); // "existing" | "new"
  const [existingGroups, setExistingGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupUnit, setNewGroupUnit] = useState("PCS");
  const [addingToGroup, setAddingToGroup] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const userStr = localStorage.getItem("rootfinuser");
  const user = userStr ? JSON.parse(userStr) : null;
  const userEmail = user?.email || user?.username || "";
  const adminEmails = ['officerootments@gmail.com'];
  const userRole = (user?.role || "").toLowerCase();
  const isAdminEmail = userEmail && adminEmails.some(email => userEmail.toLowerCase() === email.toLowerCase());
  const isAdmin = isAdminEmail ||
                  userRole === "super_admin" ||
                  userRole === "admin" ||
                  user?.power === "admin" || 
                  (user?.locCode && (user.locCode === '858' || user.locCode === '103'));
  
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

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        inStockOnly: "true",
      });
      
      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }
      
      if (userWarehouse && userWarehouse !== "Warehouse") {
        params.append("warehouse", userWarehouse);
      }
      params.append("isAdmin", isAdmin.toString());
      if (user?.power) params.append("userPower", user.power);
      if (user?.locCode) params.append("locCode", user.locCode);
      
      const fullUrl = `${API_ROOT}/api/shoe-sales/items?${params}`;
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error("Unable to load items.");
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        const activeOnly = data.filter((i) => i?.isActive !== false && String(i?.isActive).toLowerCase() !== "false");
        setItems(activeOnly);
        setTotalItems(activeOnly.length);
        setTotalPages(Math.ceil(activeOnly.length / itemsPerPage));
      } else {
        const list = Array.isArray(data.items) ? data.items : [];
        const activeOnly = list.filter((i) => i?.isActive !== false && String(i?.isActive).toLowerCase() !== "false");
        setItems(activeOnly);
        if (data.pagination) {
          setTotalItems(data.pagination.totalItems || 0);
          setTotalPages(data.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to fetch items.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, isAdmin, userWarehouse, searchTerm, user?.power, user?.locCode]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleOpenAddToGroupModal = async () => {
    if (selectedItems.size === 0) return;
    setShowAddToGroupModal(true);
    setGroupOption("existing");
    setSelectedGroupId("");
    setNewGroupName("");
    setNewGroupUnit("PCS");
    setGroupSearchTerm("");
    
    // Fetch existing groups
    try {
      setLoadingGroups(true);
      const res = await fetch(`${API_ROOT}/api/shoe-sales/item-groups?limit=1000&all=true`);
      if (res.ok) {
        const data = await res.json();
        const groupList = Array.isArray(data) ? data : (Array.isArray(data?.groups) ? data.groups : []);
        const activeGroups = groupList.filter(g => g.isActive !== false);
        setExistingGroups(activeGroups);
        if (activeGroups.length > 0) {
          setSelectedGroupId(activeGroups[0]._id || activeGroups[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching item groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleConfirmAddToGroup = async () => {
    if (groupOption === "existing" && !selectedGroupId) {
      alert("Please select an existing item group from the list.");
      return;
    }
    if (groupOption === "new" && !newGroupName.trim()) {
      alert("Please enter a name for the new item group.");
      return;
    }

    const selectedList = items.filter(item => item._id && selectedItems.has(item._id));
    if (selectedList.length === 0) return;

    setAddingToGroup(true);
    try {
      const payload = {
        option: groupOption,
        groupId: selectedGroupId,
        newGroupName: newGroupName.trim(),
        newGroupUnit: newGroupUnit || "PCS",
        itemIds: Array.from(selectedItems),
        items: selectedList,
        userWarehouse: userWarehouse || "Warehouse",
      };

      const response = await fetch(`${API_ROOT}/api/shoe-sales/item-groups/add-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let resData = null;
      try {
        resData = await response.json();
      } catch (parseErr) {
        // Handle non-JSON HTML error responses
      }

      if (!response.ok) {
        throw new Error(resData?.message || `Server returned error (${response.status})`);
      }

      setToastMessage({
        type: "success",
        text: resData.message || `Successfully added ${selectedItems.size} items to group!`,
      });
      setTimeout(() => setToastMessage(null), 4000);

      setSelectedItems(new Set());
      setShowAddToGroupModal(false);
      fetchItems();
    } catch (err) {
      console.error("Error adding items to group:", err);
      alert(err.message || "Failed to add items to group.");
    } finally {
      setAddingToGroup(false);
    }
  };

  const handleCheckboxChange = (itemId, isChecked) => {
    const newSelected = new Set(selectedItems);
    if (isChecked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (isChecked) => {
    if (isChecked) {
      const allIds = items.filter(item => item._id).map(item => item._id);
      setSelectedItems(new Set(allIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleDeleteClick = () => {
    const selectedIds = Array.from(selectedItems);
    if (selectedIds.length === 0) return;
    
    const itemsToDeleteList = items.filter(item => {
      const id = item._id;
      return id && selectedIds.includes(id);
    });
    
    setItemsToDelete(itemsToDeleteList);
    setDeleteStep(1);
    setShowDeleteModal(true);
  };

  const handleSingleDelete = (item) => {
    const itemId = item._id;
    if (!itemId) return;
    
    setItemsToDelete([item]);
    setDeleteStep(1);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteStep1 = () => {
    setDeleteStep(2);
  };

  const handleConfirmDeleteStep2 = async () => {
    setDeleting(true);
    try {
      const deletePromises = itemsToDelete.map(async (item) => {
        const itemId = item._id;
        if (!itemId) return;
        
        const response = await fetch(`${API_ROOT}/api/shoe-sales/items/${itemId}`, {
          method: "DELETE",
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to delete item");
        }
        
        return itemId;
      });

      await Promise.all(deletePromises);
      
      const deletedIds = itemsToDelete.map(i => i._id).filter(Boolean);
      const newSelected = new Set(selectedItems);
      deletedIds.forEach(id => newSelected.delete(id));
      setSelectedItems(newSelected);
      
      setCurrentPage(1);
      setShowDeleteModal(false);
      setDeleteStep(1);
      setItemsToDelete([]);
      window.location.reload();
    } catch (error) {
      console.error("Error deleting items:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteStep(1);
    setItemsToDelete([]);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Items" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#212121]">Items</h1>
        </div>
        <div className="p-5 md:p-6">
          {/* Top Bar: Search on Left, Action Buttons on Right */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="relative w-full sm:w-[290px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#525252] h-4 w-4 pointer-events-none" />
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

            <div className="flex flex-wrap items-center gap-2.5">
              {selectedItems.size > 0 && (
                <button
                  onClick={handleOpenAddToGroupModal}
                  className="inline-flex h-[40px] items-center gap-2 rounded-[10px] bg-[#6D2898] hover:bg-[#5B1F82] px-4 text-[13px] font-semibold text-white shadow-xs transition-colors cursor-pointer"
                >
                  <FolderPlus size={15} />
                  <span>Add to Group ({selectedItems.size})</span>
                </button>
              )}
              {isAdmin && selectedItems.size > 0 && (
                <button
                  onClick={handleDeleteClick}
                  className="inline-flex h-[40px] items-center gap-2 rounded-[10px] bg-[#DC2626] px-4 text-[13px] font-semibold text-white transition hover:bg-[#B91C1C] shadow-xs cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>Delete ({selectedItems.size})</span>
                </button>
              )}
              {isAdmin && (
                <Link
                  to="/shoe-sales/items/new"
                  className="rf-btn-primary inline-flex items-center gap-2 !h-[40px] !px-5 !text-[13px]"
                >
                  <Plus size={15} />
                  <span>New Item</span>
                </Link>
              )}
            </div>
          </div>

          {/* Count Subtitle */}
          <div className="text-[13px] font-medium text-[#525252] mb-3">
            {totalItems} items | Showing newest first
          </div>

          {error && (
            <div className="mb-4 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-[13px] text-[#DC2626] flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

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
                        checked={items.length > 0 && items.every(item => !item._id || selectedItems.has(item._id))}
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
                      STOCK ON HAND
                    </th>
                    <th scope="col" className="py-3.5 px-4 text-center text-[11px] font-semibold tracking-wider text-white uppercase w-[18%]">
                      REORDER LEVEL
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F0F0F0] bg-white">
                  {loading
                    ? skeletonRows.map((_, idx) => (
                        <tr key={idx} className="h-[64px]">
                          <td className="py-3 px-4 text-center border-r border-[#F5F5F5]">
                            <span className="inline-block h-4 w-4 rounded-[4px] bg-[#F4F4F5] animate-pulse" />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-[8px] bg-[#ECECEF] animate-pulse shrink-0" />
                              <div className="space-y-1.5">
                                <div className="h-3.5 w-40 bg-[#ECECEF] rounded animate-pulse" />
                                <div className="h-3 w-20 bg-[#F4F4F5] rounded animate-pulse" />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="h-3.5 w-14 bg-[#F4F4F5] rounded animate-pulse mx-auto" />
                          </td>
                          <td className="py-3 px-4">
                            <div className="h-3.5 w-10 bg-[#F4F4F5] rounded animate-pulse mx-auto" />
                          </td>
                          <td className="py-3 px-4">
                            <div className="h-3.5 w-12 bg-[#F4F4F5] rounded animate-pulse mx-auto" />
                          </td>
                        </tr>
                      ))
                    : items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-14 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-12 h-12 rounded-[12px] bg-[#F3E8FF] flex items-center justify-center text-[#9D43D6]">
                                <Layers size={22} />
                              </div>
                              <p className="text-[14px] font-semibold text-[#1B1B1B]">
                                {searchTerm ? "No items found" : "No items yet"}
                              </p>
                              <p className="text-[12px] text-[#7A7A7A]">
                                {searchTerm ? "Try a different search term" : "Create a new item to get started"}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => {
                          const itemPath = item.isFromGroup && item.itemGroupId
                            ? `/shoe-sales/item-groups/${item.itemGroupId}/items/${item._id}`
                            : `/shoe-sales/items/${item._id}`;

                          let stockVal = 0;
                          if (typeof item.stockOnHand === "number") {
                            stockVal = item.stockOnHand;
                          } else if (Array.isArray(item.warehouseStocks) && item.warehouseStocks.length > 0) {
                            if (userWarehouse && userWarehouse !== "Warehouse") {
                              const ws = item.warehouseStocks.find(w => (w.warehouse || "").toLowerCase().includes(userWarehouse.toLowerCase()));
                              stockVal = ws ? (Number(ws.stockOnHand) || 0) : 0;
                            } else {
                              stockVal = item.warehouseStocks.reduce((sum, ws) => sum + (Number(ws.stockOnHand) || 0), 0);
                            }
                          } else if (typeof item.stock === "number") {
                            stockVal = item.stock;
                          }

                          return (
                            <tr key={item._id} className="h-[64px] hover:bg-[#FAFAFA] transition-colors">
                              <td className="py-3 px-4 text-center border-r border-[#F5F5F5]">
                                <div className="flex items-center justify-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#9D43D6] cursor-pointer align-middle"
                                    checked={selectedItems.has(item._id)}
                                    onChange={(e) => handleCheckboxChange(item._id, e.target.checked)}
                                  />
                                  {isAdmin && selectedItems.has(item._id) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSingleDelete(item);
                                      }}
                                      className="p-1 rounded-[6px] hover:bg-[#FEF2F2] text-[#DC2626] transition-colors cursor-pointer"
                                      title="Delete this item"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <Link
                                  to={itemPath}
                                  className="flex items-center gap-3.5 group cursor-pointer"
                                >
                                  {(() => {
                                    const itemImg = item.image || (item.images && item.images[0]?.data) || (item.images && typeof item.images[0] === 'string' && item.images[0]) || "";
                                    if (itemImg) {
                                      return (
                                        <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E5E5E5] flex-shrink-0 flex items-center justify-center overflow-hidden p-0.5">
                                          <img
                                            src={itemImg}
                                            alt={item.itemName || item.name}
                                            className="w-full h-full object-contain rounded-[6px]"
                                          />
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="w-10 h-10 rounded-[8px] bg-[#D4D4D8]/80 flex-shrink-0 flex items-center justify-center text-[#525252] font-semibold text-[13px] group-hover:bg-[#F3E8FF] group-hover:text-[#9D43D6] transition-colors uppercase">
                                        {(item.itemName || item.name || "?")[0]}
                                      </div>
                                    );
                                  })()}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-[13px] font-semibold text-[#1B1B1B] group-hover:text-[#9D43D6] transition-colors truncate">
                                        {item.itemName || item.name}
                                      </p>
                                      {item.isFromGroup && (
                                        <span className="inline-flex items-center rounded-[6px] bg-[#F3E8FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#9D43D6]">
                                          GROUP
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[#7A7A7A] mt-0.5 truncate">
                                      {item.brand || item.itemGroupName || "Unbranded"}
                                    </p>
                                  </div>
                                </Link>
                              </td>

                              <td className="py-3 px-4 text-center text-[13px] font-mono text-[#525252]">
                                {item.sku || "-"}
                              </td>

                              <td className="py-3 px-4 text-center text-[13px] font-medium text-[#1B1B1B] tabular-nums">
                                {stockVal}
                              </td>

                              <td className="py-3 px-4 text-center text-[13px] text-[#525252] tabular-nums">
                                {item.reorderPoint || "-"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-t border-[#F0F0F0] bg-white">
              <div className="text-[12px] text-[#7A7A7A]">
                Showing {items.length > 0 ? ((currentPage - 1) * itemsPerPage + 1) : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
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
        </div>
      </div>

      <RootfinConfirmModal
        open={showDeleteModal}
        onClose={deleteStep === 1 ? handleCancelDelete : () => setDeleteStep(1)}
        onConfirm={deleteStep === 1 ? handleConfirmDeleteStep1 : handleConfirmDeleteStep2}
        title={
          deleteStep === 1
            ? `Delete ${itemsToDelete.length === 1 ? "this item" : `${itemsToDelete.length} items`}?`
            : "Final Confirmation"
        }
        description={
          deleteStep === 1
            ? `Are you sure you want to delete ${itemsToDelete.length === 1 ? "this item" : `these ${itemsToDelete.length} items`}? This action cannot be undone.`
            : `This action cannot be undone. Are you absolutely sure you want to delete ${itemsToDelete.length === 1 ? "this item" : `these ${itemsToDelete.length} items`}?`
        }
        cancelLabel={deleteStep === 1 ? "Cancel" : "Back"}
        confirmLabel={deleteStep === 1 ? "Continue" : deleting ? "Deleting..." : "Delete"}
        confirmIcon={!deleting ? <Trash2 size={15} /> : null}
        variant="danger"
        loading={deleting}
      >
        {deleteStep === 2 && itemsToDelete.length > 0 && (
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[12px] max-h-40 overflow-y-auto">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A] mb-1.5">
              Items to be deleted
            </p>
            <ul className="text-[12px] text-[#212121] space-y-1">
              {itemsToDelete.map((item, idx) => (
                <li key={item._id || idx}>
                  • {item.itemName || item.name} {item.sku ? `(${item.sku})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </RootfinConfirmModal>

      {/* Add to Group Modal */}
      {showAddToGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4">
          <div className="w-full max-w-lg bg-white rounded-[16px] border border-[#E5E5E5] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0] bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[#F3E8FF] flex items-center justify-center text-[#9D43D6]">
                  <FolderPlus size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1B1B1B] leading-tight">Add Items to Group</h3>
                  <p className="text-[12px] text-[#7A7A7A] mt-0.5">
                    {selectedItems.size} item{selectedItems.size > 1 ? "s" : ""} selected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddToGroupModal(false)}
                className="text-[#7A7A7A] hover:text-[#1B1B1B] p-1.5 hover:bg-[#F4F4F5] rounded-[8px] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Selected Items Mini Preview */}
              <div>
                <label className="rf-field-label">
                  Items to Add ({selectedItems.size})
                </label>
                <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1.5 p-2.5 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[10px]">
                  {items
                    .filter((it) => it._id && selectedItems.has(it._id))
                    .map((it) => (
                      <span
                        key={it._id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-[#1B1B1B] bg-white border border-[#E5E5E5] rounded-[8px]"
                      >
                        <span className="truncate max-w-[170px] font-semibold">{it.itemName || it.name}</span>
                        {it.sku && (
                          <span className="text-[10px] font-mono text-[#9D43D6] bg-[#F3E8FF] px-1.5 py-0.5 rounded-[4px]">
                            {it.sku}
                          </span>
                        )}
                      </span>
                    ))}
                </div>
              </div>

              {/* Option Tabs */}
              <div>
                <label className="rf-field-label">Group Destination</label>
                <div className={`grid ${isAdmin ? "grid-cols-2" : "grid-cols-1"} gap-1.5 p-1 bg-[#F4F4F5] rounded-[10px]`}>
                  <button
                    type="button"
                    onClick={() => setGroupOption("existing")}
                    className={`flex items-center justify-center gap-2 py-2 text-[12px] font-semibold rounded-[8px] transition-all cursor-pointer ${
                      groupOption === "existing"
                        ? "bg-white text-[#9D43D6] shadow-xs"
                        : "text-[#525252] hover:text-[#1B1B1B]"
                    }`}
                  >
                    <Layers size={14} />
                    <span>Existing Group</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setGroupOption("new")}
                      className={`flex items-center justify-center gap-2 py-2 text-[12px] font-semibold rounded-[8px] transition-all cursor-pointer ${
                        groupOption === "new"
                          ? "bg-white text-[#9D43D6] shadow-xs"
                          : "text-[#525252] hover:text-[#1B1B1B]"
                      }`}
                    >
                      <Plus size={14} />
                      <span>Create New Group</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Existing Group Picker */}
              {groupOption === "existing" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A7A7A] h-3.5 w-3.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search existing groups by name..."
                      value={groupSearchTerm}
                      onChange={(e) => setGroupSearchTerm(e.target.value)}
                      className="rf-input !pl-9 !h-[38px] !text-[13px]"
                    />
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 border border-[#E5E5E5] rounded-[10px] p-2 bg-[#FAFAFA]">
                    {loadingGroups ? (
                      <div className="py-8 text-center text-[12px] text-[#7A7A7A]">Loading groups...</div>
                    ) : existingGroups.length === 0 ? (
                      <div className="py-8 text-center text-[12px] text-[#7A7A7A]">No item groups found</div>
                    ) : (
                      existingGroups
                        .filter((g) => {
                          if (!groupSearchTerm.trim()) return true;
                          const term = groupSearchTerm.toLowerCase();
                          return (
                            (g.name || "").toLowerCase().includes(term) ||
                            (g.sku || "").toLowerCase().includes(term)
                          );
                        })
                        .map((grp) => {
                          const isSelected = selectedGroupId === (grp._id || grp.id);
                          const count = Array.isArray(grp.items)
                            ? grp.items.length
                            : typeof grp.items === "number"
                            ? grp.items
                            : Array.isArray(grp.itemsList)
                            ? grp.itemsList.length
                            : 0;
                          return (
                            <div
                              key={grp._id || grp.id}
                              onClick={() => setSelectedGroupId(grp._id || grp.id)}
                              className={`p-2.5 rounded-[8px] border flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-[#F3E8FF]/60 border-[#9D43D6]"
                                  : "bg-white border-[#E5E5E5] hover:border-[#D4D4D8]"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-semibold text-[#1B1B1B] truncate">{grp.name}</span>
                                  <span className="text-[10px] font-semibold text-[#525252] bg-[#F4F4F5] px-1.5 py-0.5 rounded-[4px]">
                                    {count} items
                                  </span>
                                </div>
                                {grp.sku && <p className="text-[11px] text-[#7A7A7A] font-mono mt-0.5">SKU: {grp.sku}</p>}
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-[6px] bg-[#9D43D6] text-white flex items-center justify-center shrink-0">
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}

              {/* Create New Group Inputs */}
              {groupOption === "new" && (
                <div className="space-y-3">
                  <div>
                    <label className="rf-field-label">
                      New Item Group Name <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ring Set Gold, Diamond Bangles"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="rf-input !h-[40px]"
                    />
                  </div>

                  <div>
                    <label className="rf-field-label">Unit</label>
                    <AppSelect
                      value={newGroupUnit}
                      onChange={(e) => setNewGroupUnit(e.target.value)}
                    >
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="GMS">GMS (Grams)</option>
                      <option value="KGS">KGS (Kilograms)</option>
                      <option value="SET">SET (Set)</option>
                      <option value="BOX">BOX (Box)</option>
                      <option value="PAIR">PAIR (Pair)</option>
                    </AppSelect>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#F0F0F0] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddToGroupModal(false)}
                disabled={addingToGroup}
                className="rf-btn-cancel !h-[38px] !px-4 !text-[13px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddToGroup}
                disabled={
                  addingToGroup ||
                  (groupOption === "existing" && !selectedGroupId) ||
                  (groupOption === "new" && !newGroupName.trim())
                }
                className="rf-btn-primary inline-flex items-center gap-2 !h-[38px] !px-5 !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingToGroup ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <FolderPlus size={14} />
                    <span>{groupOption === "new" ? "Create Group & Add Items" : "Add to Group"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B1B1B] text-white px-4 py-3 rounded-[10px] shadow-2xl flex items-center gap-3 border border-[#2E2E2E]">
          <CheckCircle2 size={18} className="text-[#22C55E] shrink-0" />
          <span className="text-[13px] font-medium">{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};

export default ShoeSalesItems;

const FloatingField = ({ label, placeholder, inputType = "input", hint, prefix }) => (
  <label className="flex w-full flex-col gap-1 text-sm text-[#475569]">
    <span className="font-medium">{label}</span>
    {inputType === "textarea" ? (
      <textarea
        placeholder={placeholder}
        rows={3}
        className="rounded-lg border border-[#d7dcf5] px-3 py-2 text-sm text-[#1f2937] placeholder:text-[#94a3b8] focus:border-[#3762f9] focus:outline-none"
      />
    ) : inputType === "select" ? (
      <AppSelect className="rounded-lg border border-[#d7dcf5] px-3 py-2 text-sm text-[#1f2937] focus:border-[#3762f9] focus:outline-none">
        <option>{placeholder}</option>
      </AppSelect>
    ) : (
      <div className="flex items-center rounded-lg border border-[#d7dcf5] focus-within:border-[#3762f9]">
        {prefix && <span className="pl-3 text-xs font-semibold uppercase text-[#64748b]">{prefix}</span>}
        <input
          type="text"
          placeholder={placeholder}
          className="w-full rounded-lg px-3 py-2 text-sm text-[#1f2937] placeholder:text-[#94a3b8] focus:outline-none"
        />
        {hint && <span className="pr-3 text-xs text-[#94a3b8]">{hint}</span>}
      </div>
    )}
  </label>
);

const FloatingCheckbox = ({ label, defaultChecked = false }) => (
  <label className="inline-flex items-center gap-3 rounded-lg border border-[#dbe4ff] bg-white px-4 py-2 text-sm font-medium text-[#1f2937] shadow-sm">
    <input
      type="checkbox"
      defaultChecked={defaultChecked}
      className="h-4 w-4 rounded border-[#cbd5f5] text-[#4285f4] focus:ring-[#4285f4]"
    />
    {label}
  </label>
);

const ImagePlaceholder = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M7 15.5L10 12l3 3 4-4 3 3.5"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />
    <circle cx="9" cy="8" r="1.3" fill="currentColor" opacity="0.5" />
  </svg>
);

const FloatingSelect = ({ label, options = [], placeholder }) => (
  <label className="flex w-full flex-col gap-1 text-sm text-[#475569]">
    <span className="font-medium">{label}</span>
    <AppSelect className="rounded-lg border border-[#d7dcf5] px-3 py-2 text-sm text-[#1f2937] focus:border-[#4285f4] focus:outline-none">
      {placeholder && <option>{placeholder}</option>}
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </AppSelect>
  </label>
);

const FloatingRadio = ({ name, label, defaultChecked = false }) => (
  <label className="inline-flex items-center gap-2 rounded-full border border-[#dbe4ff] bg-white px-4 py-2 text-sm font-medium text-[#1f2937] shadow-sm">
    <input
      type="radio"
      name={name}
      defaultChecked={defaultChecked}
      className="text-[#4285f4] focus:ring-[#4285f4]"
    />
    {label}
  </label>
);

const ActionButton = ({ children, to, onClick }) => {
  const Component = to ? Link : "button";
  return (
    <Component
      to={to}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2563eb] px-4 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:bg-[#1e40af]"
    >
      {children}
    </Component>
  );
};
