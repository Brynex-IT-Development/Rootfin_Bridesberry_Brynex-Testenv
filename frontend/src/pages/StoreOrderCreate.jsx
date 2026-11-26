import { useState, useEffect, useRef, useMemo } from "react";
import { useEnterToSave } from "../hooks/useEnterToSave";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Search, X, Plus, Trash2, ChevronDown } from "lucide-react";
import Head from "../components/Head";
import Header from "../components/Header";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse as mapWarehouse } from "../utils/warehouseMapping";
import useSidebar from "../hooks/useSidebar";

const Label = ({ children, required = false }) => (
  <label className="block text-xs font-medium text-gray-700 mb-1.5">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

const Input = ({ placeholder = "", className = "", ...props }) => {
  const baseClasses = "w-full rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 transition-colors";
  const tableInputClasses = "h-[36px] px-[10px] py-[6px]";
  const defaultClasses = "px-3.5 py-2.5";
  
  const isTableInput = className.includes("table-input");
  const finalClasses = `${baseClasses} ${isTableInput ? tableInputClasses : defaultClasses} ${className}`;
  
  return (
    <input
      {...props}
      className={finalClasses}
      placeholder={placeholder}
    />
  );
};

// Warehouse Dropdown Component for Store Warehouse selection
const WarehouseDropdown = ({ value, onChange, options, placeholder = "Select warehouse...", required = false, disabled = false }) => {
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePos = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  const toggleDropdown = (e) => {
    if (disabled) return;
    e.stopPropagation();
    if (!isOpen) updatePos();
    setIsOpen((p) => !p);
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePos();
      setTimeout(updatePos, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const follow = () => updatePos();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLabel = value || placeholder;

  const dropdownPortal = isOpen && !disabled ? (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 999999,
      }}
    >
      <div className="rounded-lg border border-gray-200 bg-white shadow-xl max-h-60 overflow-y-auto">
        <div className="flex items-center gap-2 p-2 border-b border-gray-100">
          <Search size={14} className="text-gray-400 ml-1" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search warehouses..."
            className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
        <div className="py-1">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No warehouses found</div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                className={`px-3.5 py-2 text-sm cursor-pointer transition-colors ${
                  value === option ? "bg-purple-50 text-purple-700 font-semibold" : "text-gray-800 hover:bg-gray-50"
                }`}
              >
                {option}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative w-full">
        <div
          ref={buttonRef}
          onClick={toggleDropdown}
          className={`w-full h-[42px] rounded-[10px] border bg-white text-[13px] transition-colors pl-3.5 pr-2.5 flex items-center justify-between ${
            disabled
              ? "cursor-not-allowed bg-[#FAFAFA] border-[#E5E5E5] opacity-70"
              : isOpen
              ? "cursor-pointer border-[#9D43D6] ring-2 ring-[#9D43D6]/15"
              : "cursor-pointer border-[#E5E5E5] hover:border-[#D4D4D8]"
          }`}
        >
          <span className={`truncate pr-2 ${!value ? "text-[#A1A1AA]" : "text-[#212121] font-medium"}`}>
            {selectedLabel}
          </span>
          <div className="flex items-center pl-2.5 border-l border-[#E5E5E5] h-[22px] shrink-0">
            <ChevronDown size={15} className={`text-[#525252] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </div>
      {typeof document !== "undefined" && document.body && createPortal(dropdownPortal, document.body)}
    </>
  );
};

// ItemDropdown Component for Store Orders - shows items available in store warehouse
const ItemDropdown = ({ rowId, value, onChange, storeWarehouse, onStockFetched, isStoreUser = false, userWarehouse = "" }) => {
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [displayedCount, setDisplayedCount] = useState(20);
  const ITEMS_PER_PAGE = 20;

  // Filter items by warehouse - show ONLY items that have stock in the selected store warehouse
  const filterItemsByWarehouse = (itemsList, targetWarehouse) => {
    if (!targetWarehouse) return [];
    
    // Normalize target warehouse using mapping utility
    const normalizedTarget = mapWarehouse(targetWarehouse);
    const targetWarehouseLower = (normalizedTarget || targetWarehouse).toLowerCase().trim();
    const targetBase = targetWarehouseLower.replace(/\s*(branch|warehouse|sg|g|z)\s*$/i, "").trim();
    
    return itemsList.filter(item => {
      if (!item.warehouseStocks || !Array.isArray(item.warehouseStocks)) return false;
      
      // Find matching warehouse stock
      const matchingStock = item.warehouseStocks.find(ws => {
        if (!ws.warehouse) return false;
        const stockWarehouseRaw = ws.warehouse.toString().trim();
        const normalizedStock = mapWarehouse(stockWarehouseRaw);
        const stockWarehouse = (normalizedStock || stockWarehouseRaw).toLowerCase().trim();
        
        // For store users - NEVER show warehouse stock (confidential)
        if (isStoreUser && (stockWarehouse === "warehouse" || stockWarehouse.includes("warehouse"))) {
          return false;
        }
        
        // Check exact match after normalization
        if (stockWarehouse === targetWarehouseLower) return true;
        
        // Check base name match (e.g., "edappally" matches "edapally branch")
        const stockBase = stockWarehouse.replace(/\s*(branch|warehouse|sg|g|z)\s*$/i, "").trim();
        if (stockBase && targetBase && stockBase === targetBase) return true;
        
        // Partial match - check if warehouse name contains target or vice versa
        if (stockWarehouse.includes(targetWarehouseLower) || targetWarehouseLower.includes(stockWarehouse)) {
          return true;
        }
        
        return false;
      });
      
      // Only return items that have stock in the selected warehouse (stock > 0)
      if (matchingStock) {
        const stockOnHand = parseFloat(matchingStock.stockOnHand) || 0;
        return stockOnHand > 0; // Only show items with available stock
      }
      
      return false;
    });
  };

  // Fetch items and item groups
  useEffect(() => {
    const fetchItems = async () => {
      if (!storeWarehouse) {
        setItems([]);
        return;
      }
      
      setLoading(true);
      try {
        // 1. Fetch item groups for the specific store warehouse
        const groupsResponse = await fetch(
          `${API_URL}/api/shoe-sales/item-groups?page=1&limit=10000&warehouse=${encodeURIComponent(storeWarehouse)}&isAdmin=false`
        );
        let groupsList = [];
        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          groupsList = Array.isArray(groupsData) ? groupsData : (groupsData.groups || groupsData.data || []);
        }

        const formattedGroups = groupsList
          .filter(group => group?.isActive !== false && String(group?.isActive).toLowerCase() !== "false")
          .map(group => {
            // Use pre-computed warehouseStocks if available
            let combinedWarehouseStocks = Array.isArray(group.warehouseStocks) ? [...group.warehouseStocks] : [];
            
            // Otherwise compute from items array if available
            const grpItems = Array.isArray(group.itemsList) ? group.itemsList : (Array.isArray(group.items) ? group.items : []);
            if (combinedWarehouseStocks.length === 0 && grpItems.length > 0) {
              grpItems.forEach(grpItem => {
                (grpItem.warehouseStocks || []).forEach(ws => {
                  const existingWs = combinedWarehouseStocks.find(cws => cws.warehouse === ws.warehouse);
                  if (existingWs) {
                    existingWs.stockOnHand = (parseFloat(existingWs.stockOnHand) || 0) + (parseFloat(ws.stockOnHand) || 0);
                    existingWs.availableForSale = (parseFloat(existingWs.availableForSale) || 0) + (parseFloat(ws.availableForSale) || 0);
                  } else {
                    combinedWarehouseStocks.push({
                      warehouse: ws.warehouse,
                      stockOnHand: parseFloat(ws.stockOnHand) || 0,
                      availableForSale: parseFloat(ws.availableForSale) || 0,
                    });
                  }
                });
              });
            }

            return {
              _id: group._id || group.id,
              id: group._id || group.id,
              itemName: group.name,
              sku: group.sku || "",
              isFromGroup: true,
              isGroup: true,
              itemGroupId: group._id || group.id,
              groupName: group.name,
              itemCount: typeof group.items === 'number' ? group.items : (Array.isArray(group.items) ? group.items.length : (grpItems.length || 0)),
              warehouseStocks: combinedWarehouseStocks,
              stock: group.stock,
              isActive: true,
            };
          });

        console.log(`🏪 Store Order items: ${formattedGroups.length} Item Groups for warehouse "${storeWarehouse}"`);
        setItems(formattedGroups);
      } catch (error) {
        console.error("Error fetching items:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchItems();
  }, [storeWarehouse, API_URL, isStoreUser]);

  useEffect(() => {
    if (value) {
      if (typeof value === 'object' && value !== null) {
        setSelectedItem(value);
      } else if (items.length > 0) {
        const item = items.find((i) => i._id === value || i.itemName === value);
        setSelectedItem(item || null);
      }
    } else {
      setSelectedItem(null);
    }
  }, [value, items]);

  // Fetch stock when item is selected
  const onStockFetchedRef = useRef(onStockFetched);
  useEffect(() => {
    onStockFetchedRef.current = onStockFetched;
  }, [onStockFetched]);

  const prevItemRef = useRef(null);
  const prevWarehouseRef = useRef(null);

  useEffect(() => {
    const itemKey = selectedItem 
      ? (selectedItem.isFromGroup 
          ? `${selectedItem.itemGroupId}-${selectedItem.itemName}-${selectedItem.sku || ''}`
          : selectedItem._id)
      : null;
    
    if (!selectedItem || !storeWarehouse) {
      prevItemRef.current = itemKey;
      prevWarehouseRef.current = storeWarehouse;
      return;
    }
    
    if (itemKey === prevItemRef.current && storeWarehouse === prevWarehouseRef.current) {
      return;
    }
    
    prevItemRef.current = itemKey;
    prevWarehouseRef.current = storeWarehouse;
    
    const fetchStock = async () => {
      try {
        const params = new URLSearchParams({ warehouse: storeWarehouse });
        
        if (selectedItem.isFromGroup) {
          params.append('itemGroupId', selectedItem.itemGroupId);
          params.append('itemName', selectedItem.itemName);
          if (selectedItem.sku) params.append('itemSku', selectedItem.sku);
        } else {
          params.append('itemId', selectedItem._id);
        }
        
        console.log(`🔍 Fetching stock for: ${selectedItem.itemName} in warehouse: ${storeWarehouse}`);
        const response = await fetch(`${API_URL}/api/inventory/store-orders/stock/item?${params}`);
        if (response.ok) {
          const stockData = await response.json();
          const quantity = stockData.currentQuantity ?? stockData.stockOnHand ?? 0;
          console.log(`✅ Stock fetched: ${quantity} units for ${selectedItem.itemName}`);
          if (onStockFetchedRef.current) {
            onStockFetchedRef.current(quantity);
          }
        } else {
          console.warn(`⚠️ Failed to fetch stock for ${selectedItem.itemName}:`, response.status);
          if (onStockFetchedRef.current) {
            onStockFetchedRef.current(0);
          }
        }
      } catch (error) {
        console.error("❌ Error fetching stock:", error);
        if (onStockFetchedRef.current) {
          onStockFetchedRef.current(0);
        }
      }
    };
    
    fetchStock();
  }, [selectedItem, storeWarehouse, API_URL]);

  const updatePos = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 500),
    });
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (!isOpen) updatePos();
    setIsOpen((p) => !p);
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePos();
      setTimeout(updatePos, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const follow = () => updatePos();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    if (!searchTerm || searchTerm.trim() === "") return items;
    
    const searchLower = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      const itemName = (item?.itemName || "").toLowerCase();
      const sku = (item?.sku || "").toLowerCase();
      const groupName = (item?.groupName || "").toLowerCase();
      return itemName.includes(searchLower) || sku.includes(searchLower) || groupName.includes(searchLower);
    });
  }, [items, searchTerm]);

  const handleSelectItem = (item) => {
    onChange(item);
    setIsOpen(false);
    setSearchTerm("");
  };

  useEffect(() => {
    setDisplayedCount(ITEMS_PER_PAGE);
  }, [searchTerm]);

  const getStockOnHand = (item, warehouse) => {
    if (!item) return 0;
    
    // Normalize warehouse using mapping utility
    const normalizedWarehouse = mapWarehouse(warehouse);
    const warehouseLower = (normalizedWarehouse || warehouse || "").toLowerCase().trim();
    const warehouseBase = warehouseLower.replace(/\s*(branch|warehouse|sg|g|z|suitorguy)\s*$/i, "").trim();
    
    if (item.warehouseStocks && Array.isArray(item.warehouseStocks) && item.warehouseStocks.length > 0) {
      const warehouseStock = item.warehouseStocks.find(ws => {
        if (!ws.warehouse) return false;
        const wsWarehouseRaw = ws.warehouse.toString().trim();
        const normalizedWs = mapWarehouse(wsWarehouseRaw);
        const wsWarehouse = (normalizedWs || wsWarehouseRaw).toLowerCase().trim();
        const wsBase = wsWarehouse.replace(/\s*(branch|warehouse|sg|g|z|suitorguy)\s*$/i, "").trim();
        
        // Exact match after normalization
        if (wsWarehouse === warehouseLower) return true;
        
        // Base name match
        if (wsBase && warehouseBase && wsBase === warehouseBase) return true;
        
        // Partial match
        if (wsWarehouse.includes(warehouseLower) || warehouseLower.includes(wsWarehouse)) return true;
        if (wsWarehouse.includes(warehouseBase) || warehouseBase.includes(wsWarehouse)) return true;
        return false;
      });
      
      if (warehouseStock && warehouseStock.stockOnHand !== undefined) {
        return parseFloat(warehouseStock.stockOnHand) || 0;
      }
    }
    
    if (item.stock !== undefined && item.stock !== null) {
      return parseFloat(item.stock) || 0;
    }
    
    return 0;
  };

  const dropdownPortal = isOpen ? (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 999999,
      }}
    >
      <div className="rounded-xl shadow-xl bg-white border border-[#d7dcf5] flex flex-col" style={{ width: '500px', maxWidth: '90vw', maxHeight: '70vh' }}>
        <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-3 py-2.5 bg-[#fafbff]">
          <Search size={14} className="text-[#94a3b8]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search items..."
            className="h-8 w-full border-none bg-transparent text-sm text-[#1f2937] outline-none placeholder:text-[#94a3b8]"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
        <div className="py-2 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d3d3d3 #f5f5f5' }}>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748b]">Loading items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748b]">
              {searchTerm ? "No items found" : "No items available in this warehouse"}
            </div>
          ) : (
            <>
              {filteredItems.slice(0, displayedCount).map((item) => {
                const isSelected = selectedItem && (
                  (selectedItem._id && selectedItem._id === item._id) ||
                  (selectedItem.itemName && selectedItem.itemName === item.itemName)
                );
                const stockOnHand = getStockOnHand(item, storeWarehouse);
                
                return (
                  <div
                    key={item._id || item.itemName || Math.random()}
                    onClick={() => handleSelectItem(item)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? "bg-[#9D43D6] text-white" : "hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${isSelected ? "text-white" : "text-[#1f2937]"}`}>
                          {item.itemName || "Unnamed Item"}
                        </div>
                        <div className={`text-xs mt-1 ${isSelected ? "text-white/80" : "text-[#64748b]"}`}>
                          {item.isGroup ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isSelected ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"}`}>
                                ITEM GROUP
                              </span>
                              {item.sku ? `• SKU: ${item.sku}` : ''}
                            </span>
                          ) : (
                            `SKU: ${item.sku || "N/A"}`
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <div className={`text-xs ${isSelected ? "text-white/80" : "text-[#64748b]"}`}>
                          Current Stock
                        </div>
                        <div className={`text-sm font-medium mt-0.5 ${isSelected ? "text-white" : Number(stockOnHand) > 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                          {Number(stockOnHand) > 0 ? `${Number(stockOnHand).toFixed(2)} pcs` : "0.00 pcs"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {filteredItems.length > displayedCount && (
                <div className="px-4 py-3 border-t border-[#e2e8f0] text-center bg-[#f9faff]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDisplayedCount(prev => prev + ITEMS_PER_PAGE);
                    }}
                    className="w-full px-4 py-2.5 text-sm font-medium text-[#2563eb] hover:bg-[#eef2ff] rounded-lg transition-colors"
                  >
                    Load More ({displayedCount} of {filteredItems.length})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative w-full overflow-visible">
        <input
          ref={buttonRef}
          onClick={toggleDropdown}
          type="text"
          readOnly
          placeholder="Type or scan to select an item"
          value={selectedItem ? selectedItem.itemName : ""}
          className="rf-input !h-[40px] cursor-pointer bg-white"
        />
      </div>
      {typeof document !== "undefined" && document.body && createPortal(dropdownPortal, document.body)}
    </>
  );
};

const StoreOrderCreate = () => {
  const isSidebarOpen = useSidebar();
  const { id } = useParams();
  const navigate = useNavigate();
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  const isEditMode = !!id;
  
  // Get user info
  const userStr = localStorage.getItem("rootfinuser");
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.email || user?._id || user?.id || "";
  const isAdmin = user?.power === "admin";
  const isWarehouseUser = user?.power === "warehouse";
  const isStoreUser = !isAdmin && !isWarehouseUser;
  const userLocCode = user?.locCode || "";
  
  // Fallback locations mapping
  const fallbackLocations = [];
  
  // Get user's location name and warehouse
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
  const userWarehouse = mapWarehouse(userLocName);
  
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderNumberLoading, setOrderNumberLoading] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [storeWarehouse, setStoreWarehouse] = useState("SuitorGuy MG Road");
  const [tableRows, setTableRows] = useState([{ 
    id: 1, 
    item: null, 
    itemId: null, 
    itemGroupId: null, 
    itemName: "", 
    itemSku: "", 
    currentStock: 0, 
    quantity: "" 
  }]);
  
  // Warehouse options for admin (stores/branches only, exclude Warehouse)
  const storeWarehouseOptions = [
    "SuitorGuy MG Road",
  ];
  
  // For store users, only show their own warehouse as option
  const availableWarehouseOptions = isStoreUser && userWarehouse 
    ? [userWarehouse] 
    : storeWarehouseOptions;
  
  // Fetch next order number when creating a new order (not in edit mode)
  useEffect(() => {
    const fetchNextOrderNumber = async () => {
      // Only fetch if not in edit mode and order number is not set
      if (isEditMode || orderNumber) return;
      
      try {
        setOrderNumberLoading(true);
        const response = await fetch(`${API_URL}/api/inventory/store-orders/next-number`);
        if (!response.ok) {
          throw new Error("Failed to fetch next order number");
        }
        const data = await response.json();
        if (data.orderNumber) {
          setOrderNumber(data.orderNumber);
        }
      } catch (error) {
        console.error("Error fetching next order number:", error);
        // Fallback to default format if API fails
        setOrderNumber("SO-00001");
      } finally {
        setOrderNumberLoading(false);
      }
    };

    fetchNextOrderNumber();
  }, [isEditMode, API_URL, orderNumber]);

  // Set default store warehouse for store users (read-only for them)
  useEffect(() => {
    if (!isEditMode && !isAdmin && !isWarehouseUser && userWarehouse && !storeWarehouse) {
      setStoreWarehouse(userWarehouse);
      console.log(`📍 Auto-setting store warehouse to user's warehouse: "${userWarehouse}"`);
    }
  }, [isEditMode, isAdmin, isWarehouseUser, userWarehouse, storeWarehouse]);
  
  // Clear selected items when store warehouse changes (only in create mode)
  useEffect(() => {
    if (!isEditMode && storeWarehouse) {
      // Reset all table rows to clear selected items when warehouse changes
      setTableRows([{ 
        id: 1, 
        item: null, 
        itemId: null, 
        itemGroupId: null, 
        itemName: "", 
        itemSku: "", 
        currentStock: 0, 
        quantity: "" 
      }]);
    }
  }, [storeWarehouse, isEditMode]);
  
  // Load store order data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      const loadStoreOrder = async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_URL}/api/inventory/store-orders/${id}`);
          if (!response.ok) throw new Error("Failed to load store order");
          const data = await response.json();
          
          setOrderNumber(data.orderNumber || "");
          setDate(data.date ? new Date(data.date).toISOString().split('T')[0] : date);
          setReason(data.reason || "");
          setStoreWarehouse(data.storeWarehouse || "");
          
          if (data.items && Array.isArray(data.items)) {
            const rows = data.items.map((item, index) => ({
              id: index + 1,
              item: { _id: item.itemId, itemName: item.itemName },
              itemId: item.itemId,
              itemGroupId: item.itemGroupId,
              itemName: item.itemName,
              itemSku: item.itemSku || "",
              currentStock: item.currentStock || 0,
              quantity: item.quantity?.toString() || "",
            }));
            setTableRows(rows.length > 0 ? rows : [{ id: 1, item: null, itemId: null, itemGroupId: null, itemName: "", itemSku: "", currentStock: 0, quantity: "" }]);
          }
        } catch (error) {
          console.error("Error loading store order:", error);
          alert("Failed to load store order");
          navigate("/inventory/store-orders");
        } finally {
          setLoading(false);
        }
      };
      loadStoreOrder();
    }
  }, [isEditMode, id, API_URL, navigate, date]);
  
  // Handle item selection
  const handleItemSelect = (rowId, item) => {
    setTableRows(rows => {
      return rows.map(row => {
        if (row.id === rowId) {
          return {
            ...row,
            item: item,
            itemId: item.isFromGroup ? null : item._id,
            itemGroupId: item.itemGroupId || null,
            itemName: item.itemName || "",
            itemSku: item.sku || "",
          };
        }
        return row;
      });
    });
  };
  
  // Handle stock fetched (current stock in store warehouse)
  const handleStockFetched = (rowId) => (currentQuantity) => {
    console.log(`📦 Stock fetched for row ${rowId}: ${currentQuantity} units`);
    setTableRows(rows => {
      return rows.map(row => {
        if (row.id === rowId) {
          return {
            ...row,
            currentStock: currentQuantity,
          };
        }
        return row;
      });
    });
  };
  
  // Handle quantity change
  const handleQuantityChange = (rowId, value) => {
    setTableRows(rows =>
      rows.map(row => {
        if (row.id === rowId) {
          return { ...row, quantity: value };
        }
        return row;
      })
    );
  };
  
  // Handle add row
  const handleAddRow = () => {
    const newId = Math.max(...tableRows.map(r => r.id), 0) + 1;
    setTableRows([...tableRows, { 
      id: newId, 
      item: null, 
      itemId: null, 
      itemGroupId: null, 
      itemName: "", 
      itemSku: "", 
      currentStock: 0, 
      quantity: "" 
    }]);
  };
  
  // Handle remove row
  const handleRemoveRow = (rowId) => {
    if (tableRows.length > 1) {
      setTableRows(tableRows.filter(row => row.id !== rowId));
    }
  };
  
  // Handle save (supports status: "draft" or "pending")
  const handleSave = async (statusToSave = "pending") => {
    if (!date || !storeWarehouse) {
      alert("Please fill in all required fields");
      return;
    }
    
    if (tableRows.length === 0 || !tableRows.some(row => row.itemName && parseFloat(row.quantity) > 0)) {
      alert("Please add at least one item with quantity");
      return;
    }
    
    setSaving(true);
    try {
      const items = tableRows
        .filter(row => row.itemName && parseFloat(row.quantity) > 0)
        .map(row => ({
          itemId: row.itemId,
          itemGroupId: row.itemGroupId,
          itemName: row.itemName,
          itemSku: row.itemSku,
          quantity: parseFloat(row.quantity) || 0,
        }));
      
      const orderData = {
        orderNumber: orderNumber || undefined, // Backend will auto-generate if not provided
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        reason,
        storeWarehouse,
        items,
        status: statusToSave,
        userId,
        locCode: userLocCode || "",
      };
      
      const url = isEditMode 
        ? `${API_URL}/api/inventory/store-orders/${id}`
        : `${API_URL}/api/inventory/store-orders`;
      const method = isEditMode ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save store order");
      }
      
      const savedOrder = await response.json();
      const statusLabel = statusToSave === "draft" ? "Draft" : "Pending";
      alert(`Store order ${isEditMode ? "updated" : "created"} successfully as ${statusLabel}`);
      navigate("/inventory/store-orders");
    } catch (error) {
      console.error("Error saving store order:", error);
      alert(error.message || "Failed to save store order. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  
  // Enter key to save store order
  useEnterToSave(() => handleSave("pending"), saving);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Header title={isEditMode ? "Edit Store Order" : "Add New Store Order"} />
        <div className={`transition-all duration-300 p-8 min-h-screen flex items-center justify-center ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
          <div className="text-[#7A7A7A] font-medium text-[13px]">Loading store order...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title={isEditMode ? "Edit Store Order" : "Add New Store Order"} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#212121]">
            {isEditMode ? "Edit Store Order" : "Add New Store Order"}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/inventory/store-orders")}
              disabled={saving}
              className="rf-btn-cancel !h-[38px] !px-4 !text-[13px] disabled:opacity-50"
            >
              Cancel
            </button>
            {!isEditMode && (
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={saving || !date || !storeWarehouse}
                className="h-[38px] px-4 border border-[#E5E5E5] text-[#212121] hover:bg-[#FAFAFA] rounded-[10px] text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-white"
              >
                <span>Save as Draft</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave(isEditMode ? "pending" : "pending")}
              disabled={saving || !date || !storeWarehouse}
              className="rf-btn-primary !h-[38px] !px-5 !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{saving ? "Saving..." : isEditMode ? "Update Order" : "Submit Order"}</span>
            </button>
          </div>
        </div>
        <div className="p-5 md:p-6 space-y-5">

          {/* Section 1: Store Order Form Card */}
          <div className="bg-white rounded-[16px] p-6 border border-[#E5E5E5] shadow-[0_2px_10px_rgba(0,0,0,0.03)] space-y-5">
            {/* Row 1: Order Number + Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Order Number */}
              <div>
                <label className="rf-field-label">
                  Order Number <span className="text-[#EF4444]">*</span>
                </label>
                <div className="flex items-center h-[42px] border border-[#E5E5E5] rounded-[10px] pl-3.5 pr-1.5 bg-white focus-within:ring-2 focus-within:ring-[#9D43D6]/15 focus-within:border-[#9D43D6] transition-colors">
                  <input
                    type="text"
                    value={orderNumberLoading ? "Generating..." : orderNumber}
                    onChange={(e) => {
                      if (!isEditMode) return;
                      setOrderNumber(e.target.value);
                    }}
                    placeholder={orderNumberLoading ? "Generating..." : "SO-00001"}
                    readOnly={!isEditMode}
                    disabled={orderNumberLoading}
                    className={`flex-1 h-full text-[13px] font-medium text-[#212121] placeholder:text-[#A1A1AA] border-0 outline-none bg-transparent min-w-0 ${
                      orderNumberLoading ? "opacity-50" : ""
                    }`}
                  />
                  <span className="h-[28px] px-3 rounded-[7px] text-[12px] font-semibold text-[#9D43D6] bg-[#F3E8FF] inline-flex items-center justify-center shrink-0">
                    Auto
                  </span>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="rf-field-label">
                  Date <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rf-input !h-[42px] cursor-pointer"
                />
              </div>
            </div>

            {/* Row 2: Store / Warehouse + Destination Warehouse */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Store / Warehouse */}
              <div>
                <label className="rf-field-label">
                  Store/ Warehouse <span className="text-[#EF4444]">*</span>
                </label>
                <WarehouseDropdown
                  value={storeWarehouse}
                  onChange={(value) => setStoreWarehouse(value)}
                  options={availableWarehouseOptions}
                  placeholder="Select Store/ Warehouse"
                  required
                  disabled={isStoreUser}
                />
                {isStoreUser && (
                  <p className="text-[11px] text-[#7A7A7A] mt-1">This is your assigned store (read-only)</p>
                )}
              </div>

              {/* Destination Warehouse */}
              <div>
                <label className="rf-field-label">
                  Destination Warehouse <span className="text-[#EF4444]">*</span>
                </label>
                <div className="w-full h-[42px] rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] pl-3.5 pr-2.5 flex items-center justify-between text-[13px] text-[#525252] cursor-not-allowed">
                  <span className="font-medium text-[#212121]">Warehouse</span>
                  <div className="flex items-center pl-2.5 border-l border-[#E5E5E5] h-[22px] shrink-0">
                    <ChevronDown size={15} className="text-[#A1A1AA]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Description */}
            <div>
              <label className="rf-field-label">Description</label>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the transfer reason"
                maxLength={500}
                className="w-full rounded-[10px] border border-[#E5E5E5] bg-white p-3.5 text-[13px] text-[#212121] placeholder:text-[#A1A1AA] focus:border-[#9D43D6] focus:outline-none focus:ring-2 focus:ring-[#9D43D6]/15 resize-none transition-colors"
              />
              <div className="text-right text-[11px] text-[#7A7A7A] mt-1">
                Maximum 500 characters
              </div>
            </div>
          </div>

          {/* Section 2: Requested Items Table */}
          <div className="bg-white rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-[#E5E5E5] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-wider select-none">
                    <th className="py-3.5 px-4 w-12 text-center">
                      <input type="checkbox" className="h-4 w-4 rounded-[4px] border-gray-500 accent-[#9D43D6] cursor-pointer align-middle" />
                    </th>
                    <th className="py-3.5 px-4 text-left min-w-[280px]">ITEM DETAILS</th>
                    <th className="py-3.5 px-4 text-center w-56">CURRENT STOCK (READ-ONLY)</th>
                    <th className="py-3.5 px-4 text-center w-56">QUANTITY REQUESTED</th>
                    <th className="py-3.5 px-3 text-center w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0] text-[13px] text-[#212121] bg-white">
                  {tableRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAFAFA] transition-colors">
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center border-r border-[#F5F5F5] align-middle">
                        <input type="checkbox" className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#9D43D6] cursor-pointer align-middle" />
                      </td>

                      {/* Item Details */}
                      <td className="py-3.5 px-4 border-r border-[#F5F5F5] align-middle">
                        <ItemDropdown
                          rowId={row.id}
                          value={row.item}
                          onChange={(item) => handleItemSelect(row.id, item)}
                          storeWarehouse={storeWarehouse}
                          onStockFetched={handleStockFetched(row.id)}
                          isStoreUser={isStoreUser}
                          userWarehouse={userWarehouse}
                        />
                      </td>

                      {/* Current Stock (Read-Only Box matching screenshot) */}
                      <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center align-middle">
                        <div className="inline-flex items-center justify-center min-w-[120px] h-[38px] px-3 rounded-[8px] border border-[#EBEBEB] bg-white text-[13px] font-medium text-[#1B1B1B] tabular-nums">
                          {Math.round(row.currentStock || 0)} Units
                        </div>
                      </td>

                      {/* Quantity Requested */}
                      <td className="py-3.5 px-4 border-r border-[#F5F5F5] align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => handleQuantityChange(row.id, e.target.value)}
                            placeholder="0"
                            min="0"
                            step="1"
                            className="rf-input !h-[38px] max-w-[130px] text-center font-medium tabular-nums"
                          />
                          <span className="text-[12px] text-[#7A7A7A] font-medium shrink-0">Units</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="w-[36px] h-[36px] rounded-[8px] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA]/60 text-[#EF4444] inline-flex items-center justify-center transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Row Bar */}
            <div className="px-4 py-3.5 border-t border-[#F0F0F0] bg-white flex items-center justify-between">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[10px] bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[13px] font-medium text-[#212121] transition-colors cursor-pointer"
              >
                <Plus size={14} className="text-[#525252]" />
                <span>New Row</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreOrderCreate;
