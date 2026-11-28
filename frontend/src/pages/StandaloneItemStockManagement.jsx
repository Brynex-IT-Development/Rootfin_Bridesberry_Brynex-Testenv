import { useState, useEffect } from "react";
import { useEnterToSave } from "../hooks/useEnterToSave";
import usePreventNumberInputScroll from "../hooks/usePreventNumberInputScroll";
import { useParams, useNavigate } from "react-router-dom";
import { Package, ArrowLeft } from "lucide-react";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";

import StockManagementLayout from "../components/StockManagementLayout.jsx";
import { getActiveStores } from "../utils/storeService";
const API_ROOT = (baseUrl?.baseUrl || "").replace(/\/$/, "");

// Store names for the dropdown come from the backend store list
const getWarehouses = () => getActiveStores().map((st) => st.locName).filter(Boolean);

const StandaloneItemStockManagement = () => {
  const isSidebarOpen = useSidebar();
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [stockRows, setStockRows] = useState([
    { warehouse: "", openingStock: "0", openingStockValue: "0", physicalOpeningStock: "0" }
  ]);
  const [warehouses, setWarehouses] = useState([]);
  
  // Prevent mouse wheel from changing number input values
  usePreventNumberInputScroll();
  
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
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_ROOT}/api/shoe-sales/items/${itemId}?_=${timestamp}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch item");
        }
        
        const data = await response.json();
        setItem(data);
        
        // Load existing warehouse stocks if available
        if (data.warehouseStocks && Array.isArray(data.warehouseStocks) && data.warehouseStocks.length > 0) {
          const existingRows = data.warehouseStocks
            .filter(stock => {
              if (!stock.warehouse || !getWarehouses().includes(stock.warehouse)) {
                return false;
              }
              const stockOnHand = parseFloat(stock.stockOnHand) || 0;
              const openingStock = parseFloat(stock.openingStock) || 0;
              const physicalStockOnHand = parseFloat(stock.physicalStockOnHand) || 0;
              const physicalOpeningStock = parseFloat(stock.physicalOpeningStock) || 0;
              
              return stockOnHand > 0 || openingStock > 0 || physicalStockOnHand > 0 || physicalOpeningStock > 0;
            })
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
      } catch (error) {
        console.error("Error fetching item:", error);
        setItem(null);
      }
    };

    if (itemId) {
      fetchData();
    }
  }, [itemId]);

  // Listen for stock update events
  useEffect(() => {
    const handleStockUpdate = (event) => {
      const itemIds = event.detail?.itemIds || [];
      const itemNames = event.detail?.items || [];
      
      const currentItemId = (item?._id || item?.id)?.toString();
      const currentItemName = item?.itemName;
      
      const isAffected = itemIds.some(id => id?.toString() === currentItemId) ||
                        itemNames.some(name => name === currentItemName);
      
      if (isAffected) {
        fetch(`${API_ROOT}/api/shoe-sales/items/${itemId}`)
          .then(res => res.json())
          .then(data => {
            setItem(data);
            if (data.warehouseStocks && Array.isArray(data.warehouseStocks) && data.warehouseStocks.length > 0) {
              const existingRows = data.warehouseStocks
                .filter(stock => {
                  if (!stock.warehouse || !getWarehouses().includes(stock.warehouse)) {
                    return false;
                  }
                  const stockOnHand = parseFloat(stock.stockOnHand) || 0;
                  const openingStock = parseFloat(stock.openingStock) || 0;
                  const physicalStockOnHand = parseFloat(stock.physicalStockOnHand) || 0;
                  const physicalOpeningStock = parseFloat(stock.physicalOpeningStock) || 0;
                  
                  return stockOnHand > 0 || openingStock > 0 || physicalStockOnHand > 0 || physicalOpeningStock > 0;
                })
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
          })
          .catch(err => console.error("Error refreshing item after stock update:", err));
      }
    };

    window.addEventListener("stockUpdated", handleStockUpdate);
    return () => {
      window.removeEventListener("stockUpdated", handleStockUpdate);
    };
  }, [itemId, item]);

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

      // Keep zero-stock entries so a 0 actually overwrites the old value
      const stockData = Array.from(byWarehouse.values());
      const currentUser = JSON.parse(localStorage.getItem("rootfinuser")) || {};
      const changedBy = currentUser.username || currentUser.locName || "System";

      const updatePayload = {
        itemName: item.itemName || "",
        sku: item.sku || "",
        type: item.type || "goods",
        unit: item.unit || "",
        hsnCode: item.hsnCode || "",
        manufacturer: item.manufacturer || "",
        brand: item.brand || "",
        taxPreference: item.taxPreference || "taxable",
        taxRateInter: item.taxRateInter || "",
        taxRateIntra: item.taxRateIntra || "",
        inventoryAccount: item.inventoryAccount || "",
        inventoryValuation: item.inventoryValuation || item.inventoryValuationMethod || "",
        costPrice: item.costPrice || 0,
        costAccount: item.costAccount || "",
        preferredVendor: item.preferredVendor || "",
        purchaseDescription: item.purchaseDescription || "",
        sellingPrice: item.sellingPrice || 0,
        salesAccount: item.salesAccount || "",
        salesDescription: item.salesDescription || "",
        dimensions: item.dimensions || "",
        weight: item.weight || "",
        reorderPoint: item.reorderPoint || "",
        trackingMethod: item.trackingMethod || "none",
        trackInventory: item.trackInventory !== undefined ? item.trackInventory : true,
        trackBin: item.trackBin !== undefined ? item.trackBin : false,
        returnable: item.returnable !== undefined ? item.returnable : true,
        sellable: item.sellable !== undefined ? item.sellable : true,
        purchasable: item.purchasable !== undefined ? item.purchasable : true,
        warehouseStocks: stockData,
        changedBy: changedBy,
      };

      const response = await fetch(`${API_ROOT}/api/shoe-sales/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to save stock data";
        try {
          const payload = JSON.parse(errorText);
          errorMessage = payload?.message || payload?.errors?.join(", ") || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const successMsg = "Stock data saved successfully!";
      navigate(`/shoe-sales/items/${itemId}?stocksUpdated=true&message=${encodeURIComponent(successMsg)}`, { replace: true });
    } catch (error) {
      console.error("Error saving stock:", error);
      alert(error.message || "Failed to save stock data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEnterToSave(() => handleSave(), loading);

  if (!item) {
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
      itemName={item.itemName || "Item"}
      sku={item.sku || ""}
      meta={[item.brand && { label: "Brand", value: item.brand }, item.category && { label: "Category", value: item.category }].filter(Boolean)}
      backPath={`/shoe-sales/items/${itemId}`}
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

export default StandaloneItemStockManagement;

