import { useState, useEffect, useMemo } from "react";
import { useEnterToSave } from "../hooks/useEnterToSave";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { X, Trash2, Plus, Copy, Package, Store, Check, ArrowLeft, Layers } from "lucide-react";
import Header from "../components/Header";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";

import AppSelect from "../components/AppSelect.jsx";
import { getActiveStores } from "../utils/storeService";
// Store names for the dropdown come from the backend store list
const getWarehouses = () => getActiveStores().map((st) => st.locName).filter(Boolean);

const ItemStockManagement = () => {
  const isSidebarOpen = useSidebar();
  const { id, itemId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stockType = (searchParams.get("type") || "accounting").toLowerCase();
  const [itemGroup, setItemGroup] = useState(null);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [stockRows, setStockRows] = useState([
    { warehouse: "", openingStock: "0", openingStockValue: "0", physicalOpeningStock: "0" }
  ]);
  const [warehouses, setWarehouses] = useState([]);
  
  // Set warehouses to the specified list
  useEffect(() => {
    // Sort warehouses: "Warehouse" first, then alphabetically
    const sortedWarehouses = [...getWarehouses()].sort((a, b) => {
      if (a === "Warehouse") return -1;
      if (b === "Warehouse") return 1;
      return a.localeCompare(b);
    });
    setWarehouses(sortedWarehouses);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_URL}/api/shoe-sales/item-groups/${id}?_=${timestamp}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch item group");
        }
        
        const data = await response.json();
        setItemGroup(data);
        
        // Find the specific item
        if (data.items && Array.isArray(data.items)) {
          const foundItem = data.items.find(i => (i._id || i.id) === itemId);
          if (foundItem) {
            setItem(foundItem);
            // Load existing warehouse stocks if available
            if (foundItem.warehouseStocks && Array.isArray(foundItem.warehouseStocks) && foundItem.warehouseStocks.length > 0) {
              const existingRows = foundItem.warehouseStocks
                .filter(stock => stock.warehouse && getWarehouses().includes(stock.warehouse))
                .map(stock => {
                  const stockOnHandValue = parseFloat(stock.stockOnHand) || 0;
                  const physicalStockOnHandValue = parseFloat(stock.physicalStockOnHand) || 0;
                  
                  return {
                    warehouse: stock.warehouse || "",
                    openingStock: stockOnHandValue.toString(),
                    openingStockValue: stock.openingStockValue?.toString() || "0",
                    physicalOpeningStock: physicalStockOnHandValue.toString()
                  };
                });
              
              if (existingRows.length > 0) {
                setStockRows(existingRows);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching item:", error);
        setItemGroup(null);
        setItem(null);
      }
    };

    if (id && itemId) {
      fetchData();
    }
  }, [id, itemId]);

  // Listen for stock update events
  useEffect(() => {
    const handleStockUpdate = (event) => {
      const itemIds = event.detail?.itemIds || [];
      const itemNames = event.detail?.items || [];
      
      const currentItemId = (item?._id || item?.id)?.toString();
      const currentItemName = item?.name;
      
      const isAffected = itemIds.some(id => id?.toString() === currentItemId) ||
                        itemNames.some(name => name === currentItemName);
      
      if (isAffected) {
        const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
        fetch(`${API_URL}/api/shoe-sales/item-groups/${id}`)
          .then(res => res.json())
          .then(data => {
            setItemGroup(data);
            if (data.items && Array.isArray(data.items)) {
              const foundItem = data.items.find(i => (i._id || i.id) === itemId);
              if (foundItem) {
                setItem(foundItem);
                if (foundItem.warehouseStocks && Array.isArray(foundItem.warehouseStocks) && foundItem.warehouseStocks.length > 0) {
                  const existingRows = foundItem.warehouseStocks
                    .filter(stock => stock.warehouse && getWarehouses().includes(stock.warehouse))
                    .map(stock => {
                      const stockOnHandValue = parseFloat(stock.stockOnHand) || 0;
                      const physicalStockOnHandValue = parseFloat(stock.physicalStockOnHand) || 0;
                      
                      return {
                        warehouse: stock.warehouse || "",
                        openingStock: stockOnHandValue.toString(),
                        openingStockValue: stock.openingStockValue?.toString() || "0",
                        physicalOpeningStock: physicalStockOnHandValue.toString()
                      };
                    });
                  
                  if (existingRows.length > 0) {
                    setStockRows(existingRows);
                  }
                }
              }
            }
          })
          .catch(err => console.error("Error refreshing item after stock update:", err));
      }
    };

    window.addEventListener("stockUpdated", handleStockUpdate);
    return () => {
      window.removeEventListener("stockUpdated", handleStockUpdate);
    };
  }, [id, itemId, item]);

  const handleAddRow = () => {
    setStockRows([...stockRows, { warehouse: "", openingStock: "0", openingStockValue: "0", physicalOpeningStock: "0" }]);
  };

  const handleDeleteRow = (index) => {
    if (stockRows.length > 1) {
      const newRows = stockRows.filter((_, i) => i !== index);
      setStockRows(newRows);
    }
  };

  const handleInputChange = (index, field, value) => {
    const newRows = [...stockRows];
    newRows[index][field] = value;
    setStockRows(newRows);
  };

  const handleCopyToAll = (field) => {
    if (stockRows.length > 0) {
      const value = stockRows[0][field];
      const newRows = stockRows.map(row => ({ ...row, [field]: value }));
      setStockRows(newRows);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }
  };

  // Quick calculations for stats bar
  const totalStock = useMemo(() => {
    return stockRows.reduce((sum, r) => sum + (parseFloat(r.openingStock) || 0), 0);
  }, [stockRows]);

  const configuredBranchesCount = useMemo(() => {
    return stockRows.filter(r => r.warehouse && r.warehouse.trim() !== "").length;
  }, [stockRows]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
      
      // Start from the existing entries so stock in other stores (not shown in this form) is preserved
      const byWarehouse = new Map();
      (item?.warehouseStocks || []).forEach(ws => {
        if (ws && ws.warehouse) byWarehouse.set(ws.warehouse, { ...ws });
      });

      const setStock = (warehouse, qty) => {
        const current = byWarehouse.get(warehouse) || { warehouse };
        current.openingStock = qty;
        current.openingStockValue = 0;
        current.stockOnHand = qty;
        current.availableForSale = qty;
        current.physicalOpeningStock = qty;
        current.physicalStockOnHand = qty;
        current.physicalAvailableForSale = qty;
        byWarehouse.set(warehouse, current);
      };

      // Editable warehouses removed from the form are set to 0
      const formWarehouses = new Set(stockRows.map(r => r.warehouse).filter(Boolean));
      getWarehouses().forEach(wh => {
        if (byWarehouse.has(wh) && !formWarehouses.has(wh)) setStock(wh, 0);
      });

      stockRows
        .filter(row => row.warehouse && row.warehouse.trim() !== "")
        .forEach(row => setStock(row.warehouse, parseFloat(row.openingStock) || 0));

      // Keep zero-stock entries: an empty list makes the backend restore the old stock
      const stockData = Array.from(byWarehouse.values());

      const updatedItems = itemGroup.items.map(i => {
        const currentItemId = (i._id || i.id || "").toString();
        const targetItemId = itemId.toString();
        if (currentItemId === targetItemId) {
          return {
            ...i,
            _id: i._id || i.id,
            id: i.id || i._id,
            warehouseStocks: stockData,
            isActive: i.isActive !== undefined ? i.isActive : true
          };
        }
        return i;
      });

      const currentUser = JSON.parse(localStorage.getItem("rootfinuser")) || {};
      const changedBy = currentUser.username || currentUser.locName || "System";

      const updatePayload = {
        name: itemGroup.name,
        sku: itemGroup.sku || "",
        itemType: itemGroup.itemType || "goods",
        unit: itemGroup.unit || "",
        manufacturer: itemGroup.manufacturer || "",
        brand: itemGroup.brand || "",
        taxPreference: itemGroup.taxPreference || "taxable",
        intraStateTaxRate: itemGroup.intraStateTaxRate || "",
        interStateTaxRate: itemGroup.interStateTaxRate || "",
        inventoryValuationMethod: itemGroup.inventoryValuationMethod || "",
        createAttributes: itemGroup.createAttributes !== undefined ? itemGroup.createAttributes : true,
        attributeRows: itemGroup.attributeRows || [],
        sellable: itemGroup.sellable !== undefined ? itemGroup.sellable : true,
        purchasable: itemGroup.purchasable !== undefined ? itemGroup.purchasable : true,
        trackInventory: itemGroup.trackInventory !== undefined ? itemGroup.trackInventory : false,
        items: updatedItems,
        stock: itemGroup.stock || 0,
        reorder: itemGroup.reorder || "",
        isActive: itemGroup.isActive !== undefined ? itemGroup.isActive : true,
        itemId: itemId,
        changedBy: changedBy,
      };

      const response = await fetch(`${API_URL}/api/shoe-sales/item-groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || payload?.errors?.join(", ") || "Failed to save stock data");
      }
      
      const successMsg = "Stock data saved successfully!";
      navigate(`/shoe-sales/item-groups/${id}/items/${itemId}?stocksUpdated=true&skipWarehouseFilter=true&message=${encodeURIComponent(successMsg)}`, { replace: true });
    } catch (error) {
      console.error("Error saving stock:", error);
      alert(error.message || "Failed to save stock data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEnterToSave(() => handleSave(), loading);

  if (!itemGroup || !item) {
    return (
      <div className={`transition-all duration-300 p-8 bg-[#f8fafc] min-h-screen ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Package size={24} />
          </div>
          <p className="text-base font-semibold text-slate-800">Item not found</p>
          <p className="text-sm text-slate-500 mt-1">Unable to load item stock details.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all"
          >
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Stock Management" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#212121]">Stock Management</h1>
        </div>
        <div className="p-5 md:p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Main Card */}
        <div className="rounded-[16px] border border-[#E5E5E5] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F0F0F0] px-6 py-5 bg-white">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[10px] bg-[#FDE3D9] text-[#F2572B] flex items-center justify-center">
                <Store size={19} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[18px] font-bold text-[#1B1B1B] tracking-tight">
                    {item.name || item.itemName || "Item Stock Management"}
                  </h1>
                  {item.sku && (
                    <span className="text-[11px] font-semibold uppercase tracking-wider bg-[#FDE3D9] text-[#F2572B] px-2 py-0.5 rounded-[6px]">
                      SKU: {item.sku}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[#7A7A7A] mt-0.5 flex items-center gap-2">
                  <span>Group: <strong className="text-[#212121] font-medium">{itemGroup.name}</strong></span>
                  {item.size && (
                    <>
                      <span>•</span>
                      <span>Size: <strong className="text-[#212121] font-medium">{item.size}</strong></span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate(`/shoe-sales/item-groups/${id}/items/${itemId}`)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E5E5E5] bg-white text-[#525252] hover:bg-[#FAFAFA] hover:text-[#1B1B1B] transition-colors cursor-pointer"
              title="Close"
            >
              <X size={17} />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-4 bg-[#FAFAFA] border-b border-[#F0F0F0]">
            <div className="bg-white rounded-[12px] p-3.5 border border-[#E5E5E5] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Configured Locations</p>
                <p className="text-[18px] font-bold text-[#1B1B1B] mt-0.5 tabular-nums">{configuredBranchesCount} / {warehouses.length}</p>
              </div>
              <div className="w-8 h-8 rounded-[8px] bg-[#FDE3D9] text-[#F2572B] flex items-center justify-center">
                <Store size={16} />
              </div>
            </div>

            <div className="bg-white rounded-[12px] p-3.5 border border-[#E5E5E5] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Total Stock</p>
                <p className="text-[18px] font-bold text-[#1B1B1B] mt-0.5 tabular-nums">{totalStock} <span className="text-[12px] font-normal text-[#7A7A7A]">units</span></p>
              </div>
              <div className="w-8 h-8 rounded-[8px] bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
                <Package size={16} />
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-6">
            <div className="overflow-hidden rounded-[12px] border border-[#E5E5E5]">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-[#1B1B1B] text-white">
                    <tr>
                      <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider w-1/2">
                        Store / Warehouse
                      </th>
                      <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div className="flex items-center justify-between gap-2">
                          <span>Opening Stock</span>
                          <button
                            type="button"
                            onClick={() => handleCopyToAll("openingStock")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-[6px] bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                          >
                            {copiedField === "openingStock" ? (
                              <>
                                <Check size={12} className="text-[#4ADE80]" />
                                <span className="text-[#4ADE80]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy All</span>
                              </>
                            )}
                          </button>
                        </div>
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider w-16">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] bg-white">
                    {stockRows.map((row, index) => (
                      <tr key={index} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-5 py-3.5">
                          <AppSelect
                            value={row.warehouse}
                            onChange={(e) => handleInputChange(index, "warehouse", e.target.value)}
                          >
                            <option value="">Select Store</option>
                            {warehouses.map((wh, idx) => (
                              <option key={idx} value={wh}>{wh}</option>
                            ))}
                          </AppSelect>
                        </td>
                        <td className="px-5 py-3.5">
                          <input
                            type="number"
                            value={row.openingStock}
                            onChange={(e) => handleInputChange(index, "openingStock", e.target.value)}
                            className="rf-input !h-[40px]"
                            placeholder="0"
                            step="1"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {stockRows.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(index)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#FEF2F2] text-[#EF4444] hover:bg-[#FEE2E2] transition-colors mx-auto cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <span className="text-[#A1A1AA] text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add New Row Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 h-[38px] rounded-[10px] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-4 text-[13px] font-medium text-[#212121] transition-colors cursor-pointer"
              >
                <Plus size={15} className="text-[#525252]" />
                <span>Add Store Row</span>
              </button>
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[#F0F0F0] pt-5">
              <button
                type="button"
                onClick={() => navigate(`/shoe-sales/item-groups/${id}/items/${itemId}`)}
                disabled={loading}
                className="rf-btn-cancel !h-[40px] !px-5 !text-[13px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="rf-btn-primary inline-flex items-center gap-2 !h-[40px] !px-6 !text-[13px] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default ItemStockManagement;

