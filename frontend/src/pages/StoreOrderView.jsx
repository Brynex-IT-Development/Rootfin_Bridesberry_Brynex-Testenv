import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Head from "../components/Head";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse } from "../utils/warehouseMapping";
import useSidebar from "../hooks/useSidebar";

import AppSelect from "../components/AppSelect.jsx";
const StoreOrderView = () => {
  const isSidebarOpen = useSidebar();
  const { id } = useParams();
  const navigate = useNavigate();
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  
  const [loading, setLoading] = useState(true);
  const [storeOrder, setStoreOrder] = useState(null);
  const [error, setError] = useState(null);
  const [itemStocks, setItemStocks] = useState({});
  const [processing, setProcessing] = useState(false);
  
  // Get user info to check if admin
  const userStr = localStorage.getItem("rootfinuser");
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.power === "admin";
  const isWarehouseUser = user?.power === "warehouse";
  
  useEffect(() => {
    const loadStoreOrder = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/inventory/store-orders/${id}`);
        if (!response.ok) throw new Error("Failed to load store order");
        const data = await response.json();
        setStoreOrder(data);
        
        // Fetch current stock for each item
        if (data.items && data.items.length > 0 && data.storeWarehouse) {
          const stockPromises = data.items.map(async (item) => {
            try {
              const params = new URLSearchParams({ warehouse: data.storeWarehouse });
              
              if (item.itemGroupId) {
                params.append('itemGroupId', item.itemGroupId);
                params.append('itemName', item.itemName);
                if (item.itemSku) params.append('itemSku', item.itemSku);
              } else if (item.itemId) {
                params.append('itemId', item.itemId);
              }
              
              const stockResponse = await fetch(`${API_URL}/api/inventory/store-orders/stock/item?${params}`);
              if (stockResponse.ok) {
                const stockData = await stockResponse.json();
                return {
                  itemKey: item.itemId || `${item.itemGroupId}-${item.itemName}`,
                  stock: stockData.currentQuantity ?? stockData.stockOnHand ?? 0
                };
              }
            } catch (err) {
              console.error(`Error fetching stock for ${item.itemName}:`, err);
            }
            return {
              itemKey: item.itemId || `${item.itemGroupId}-${item.itemName}`,
              stock: 0
            };
          });
          
          const stockResults = await Promise.all(stockPromises);
          const stockMap = {};
          stockResults.forEach(result => {
            stockMap[result.itemKey] = result.stock;
          });
          setItemStocks(stockMap);
        }
      } catch (err) {
        console.error("Error loading store order:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      loadStoreOrder();
    }
  }, [id, API_URL]);
  
  // Listen for status changes from other pages (like StoreOrders list)
  useEffect(() => {
    const handleStatusChange = (event) => {
      console.log("📦 Store order status changed event received in StoreOrderView", event.detail);
      
      const { orderId, status } = event.detail;
      const currentOrderId = storeOrder?._id || storeOrder?.id;
      
      // Check if this is the current order
      if (currentOrderId && orderId?.toString() === currentOrderId?.toString()) {
        console.log("🔄 This store order was updated, refreshing...");
        
        // Refetch the store order data
        fetch(`${API_URL}/api/inventory/store-orders/${id}`)
          .then(res => res.json())
          .then(data => {
            setStoreOrder(data);
            console.log("✅ Store order data refreshed", { newStatus: data.status });
          })
          .catch(err => console.error("Error refreshing store order:", err));
      }
    };

    window.addEventListener("storeOrderStatusChanged", handleStatusChange);
    return () => {
      window.removeEventListener("storeOrderStatusChanged", handleStatusChange);
    };
  }, [id, storeOrder, API_URL]);
  
  // Handle Manual Status Change
  const handleManualStatusChange = async (newStatus) => {
    if (!storeOrder) return;
    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/inventory/store-orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...storeOrder,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update store order status');
      }

      setStoreOrder(prev => ({ ...prev, status: newStatus }));

      // Dispatch event to notify other pages
      window.dispatchEvent(new CustomEvent("storeOrderStatusChanged", {
        detail: {
          orderId: id,
          status: newStatus,
          source: "store-order-view"
        }
      }));
    } catch (err) {
      console.error('Error updating status:', err);
      alert(err.message || 'Failed to update status. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Create Transfer Order
  const handleCreateTransferOrder = () => {
    if (!storeOrder) return;
    
    const mappedDestinationWarehouse = mapLocNameToWarehouse(storeOrder.storeWarehouse) || storeOrder.storeWarehouse;
    
    // Store the store order data in sessionStorage to pre-fill transfer order without auto-selecting item groups
    const transferOrderData = {
      sourceWarehouse: "Warehouse", // Always from main warehouse
      destinationWarehouse: mappedDestinationWarehouse,
      reason: `Store Order: ${storeOrder.orderNumber}${storeOrder.reason ? ` - ${storeOrder.reason}` : ''}`,
      storeOrderId: storeOrder._id || storeOrder.id,
      storeOrderNumber: storeOrder.orderNumber,
      requestedItems: (storeOrder.items || []).map(item => ({
        itemId: item.itemId,
        itemGroupId: item.itemGroupId,
        itemName: item.itemName,
        itemSku: item.itemSku,
        quantity: item.quantity,
      })),
    };
    
    sessionStorage.setItem('transferOrderPrefill', JSON.stringify(transferOrderData));
    navigate('/inventory/transfer-orders/new');
  };

  // Handle Reject
  const handleReject = async () => {
    if (!storeOrder) return;
    
    const confirmReject = window.confirm(
      `Are you sure you want to reject Store Order ${storeOrder.orderNumber}?`
    );
    
    if (!confirmReject) return;
    
    await handleManualStatusChange('rejected');
  };
  
  if (loading) {
    return (
      <div className={`transition-all duration-300 p-6 bg-[#FAFAFA] min-h-screen flex items-center justify-center ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        <div className="text-[13px] text-[#7A7A7A]">Loading store order...</div>
      </div>
    );
  }
  
  if (error || !storeOrder) {
    return (
      <div className={`transition-all duration-300 p-6 bg-[#FAFAFA] min-h-screen flex items-center justify-center ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        <div className="text-[13px] text-[#7A7A7A]">{error || "Store order not found"}</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Store Order Details" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#212121]">Store Order Details</h1>
          <div className="flex items-center gap-2.5">
            <Link
              to="/inventory/store-orders"
              className="rf-btn-cancel inline-flex items-center gap-2 !h-[38px] !px-4 !text-[13px]"
            >
              Back to Store Orders
            </Link>
            <button
              onClick={handleCreateTransferOrder}
              className="rf-btn-primary inline-flex items-center gap-2 !h-[38px] !px-4 !text-[13px]"
            >
              Create Transfer Order
            </button>
          </div>
        </div>
        <div className="p-5 md:p-6">
        <div className="rounded-[16px] border border-[#E5E5E5] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F0F0F0] px-6 py-5">
            <div className="space-y-0.5">
              <h1 className="text-[18px] font-bold text-[#1B1B1B]">
                Store Order: {storeOrder.orderNumber || "N/A"}
              </h1>
              <p className="text-[13px] text-[#7A7A7A]">
                View and manage store order details
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] font-semibold text-[#7A7A7A] uppercase tracking-wider">Status:</span>
              <div className="min-w-[140px]">
                <AppSelect
                  value={storeOrder.status || 'pending'}
                  onChange={(e) => handleManualStatusChange(e.target.value)}
                  disabled={processing}
                >
                  <option value="draft">DRAFT</option>
                  <option value="pending">PENDING</option>
                  <option value="approved">APPROVED</option>
                  <option value="rejected">REJECTED</option>
                  <option value="transferred">TRANSFERRED</option>
                </AppSelect>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A] mb-1">Order Number</p>
                <p className="text-[14px] font-semibold text-[#1B1B1B]">{storeOrder.orderNumber || "N/A"}</p>
              </div>
              <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A] mb-1">Date</p>
                <p className="text-[14px] font-semibold text-[#1B1B1B]">{storeOrder.date ? new Date(storeOrder.date).toLocaleDateString() : "N/A"}</p>
              </div>
              <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A] mb-1">Store Warehouse</p>
                <p className="text-[14px] font-semibold text-[#1B1B1B]">{storeOrder.storeWarehouse || "N/A"}</p>
              </div>
              <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A] mb-1">Current Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-[12px] font-semibold uppercase ${
                  storeOrder.status === 'draft' ? 'bg-[#F4F4F5] text-[#525252]' :
                  storeOrder.status === 'pending' ? 'bg-[#FEF3C7] text-[#B45309]' :
                  storeOrder.status === 'approved' ? 'bg-[#DCFCE7] text-[#16A34A]' :
                  storeOrder.status === 'rejected' ? 'bg-[#FEE2E2] text-[#DC2626]' :
                  'bg-[#F3E8FF] text-[#9D43D6]'
                }`}>
                  {storeOrder.status || 'pending'}
                </span>
              </div>
            </div>
            
            {storeOrder.reason && (
              <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A] mb-1">Reason</p>
                <p className="text-[13px] text-[#212121]">{storeOrder.reason}</p>
              </div>
            )}
            
            {storeOrder.items && storeOrder.items.length > 0 && (
              <div className="rounded-[12px] border border-[#E5E5E5] bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[13px] text-[#212121]">
                    <thead className="bg-[#1B1B1B] text-white">
                      <tr>
                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">Item Name</th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">SKU</th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">Current Stock</th>
                        <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider">Quantity Requested</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0F0]">
                      {storeOrder.items.map((item, index) => {
                        const itemKey = item.itemId || `${item.itemGroupId}-${item.itemName}`;
                        const currentStock = itemStocks[itemKey] ?? 0;
                        
                        return (
                          <tr key={index} className="hover:bg-[#FAFAFA] transition-colors">
                            <td className="px-5 py-3.5 font-medium text-[#1B1B1B]">{item.itemName || "N/A"}</td>
                            <td className="px-5 py-3.5 text-[#525252] font-mono">{item.itemSku || "N/A"}</td>
                            <td className="px-5 py-3.5">
                              <span className={`font-semibold tabular-nums ${currentStock > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                {Math.round(currentStock)} units
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-semibold text-[#1B1B1B] tabular-nums">{item.quantity || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[#F0F0F0] bg-[#FAFAFA] px-6 py-4">
            {storeOrder.status !== 'rejected' && (
              <button
                onClick={handleReject}
                disabled={processing}
                className="h-[40px] rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] px-5 text-[13px] font-semibold text-[#DC2626] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Reject
              </button>
            )}
            <button
              onClick={handleCreateTransferOrder}
              disabled={processing}
              className="rf-btn-primary !h-[40px] !px-5 !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Transfer Order
            </button>
          </div>
        </div>
      </div>
        </div>
      </div>
  );
};

export default StoreOrderView;
