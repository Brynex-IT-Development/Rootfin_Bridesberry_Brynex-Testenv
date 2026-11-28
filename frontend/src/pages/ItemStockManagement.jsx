import { useState, useEffect } from "react";
import { useEnterToSave } from "../hooks/useEnterToSave";
import { useParams, useNavigate } from "react-router-dom";
import { Package, ArrowLeft } from "lucide-react";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";

import StockManagementLayout from "../components/StockManagementLayout.jsx";
import { getActiveStores } from "../utils/storeService";
// Store names for the dropdown come from the backend store list
const getWarehouses = () => getActiveStores().map((st) => st.locName).filter(Boolean);

const ItemStockManagement = () => {
  const isSidebarOpen = useSidebar();
  const { id, itemId } = useParams();
  const navigate = useNavigate();
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
    <StockManagementLayout
      isSidebarOpen={isSidebarOpen}
      itemName={item.name || item.itemName || "Item"}
      sku={item.sku || ""}
      meta={[itemGroup?.name && { label: "Group", value: itemGroup.name }, item.size && { label: "Size", value: item.size }].filter(Boolean)}
      backPath={`/shoe-sales/item-groups/${id}/items/${itemId}`}
      onNavigate={navigate}
      stockRows={stockRows}
      warehouses={warehouses}
      copiedField={copiedField}
      loading={loading}
      onAddRow={handleAddRow}
      onDeleteRow={handleDeleteRow}
      onInputChange={handleInputChange}
      onCopyToAll={handleCopyToAll}
      onSave={handleSave}
    />
  );
};

export default ItemStockManagement;

