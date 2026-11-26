import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Send, Search, X, Plus } from "lucide-react";
import Header from "../components/Header";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse as mapWarehouse } from "../utils/warehouseMapping";
import useSidebar from "../hooks/useSidebar";

const currency = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);

const fallbackLocations = [];

const PurchaseOrders = () => {
  const isSidebarOpen = useSidebar();
  const location = useLocation();
  const isNewOrder = location.pathname === "/purchase/orders/new";
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchOrderNumber, setSearchOrderNumber] = useState("");
  const [sending, setSending] = useState({});

  useEffect(() => {
    if (isNewOrder) return;
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const userStr = localStorage.getItem("rootfinuser");
        const user = userStr ? JSON.parse(userStr) : null;
        const userId = user?.email || null;
        const userPower = user?.power || "";

        let searchParam;
        if (searchOrderNumber) {
          searchParam = `orderNumber=${encodeURIComponent(searchOrderNumber)}`;
        } else if (userId) {
          const params = new URLSearchParams({ userId });
          if (userPower) params.append("userPower", userPower);
          if (user?.locCode) params.append("locCode", user.locCode);
          let userLocName = "";
          if (user?.locCode) {
            const loc = fallbackLocations.find(l => l.locCode === user.locCode || l.locCode === String(user.locCode));
            if (loc) userLocName = loc.locName;
          }
          if (!userLocName) userLocName = user?.username || user?.locName || "";
          const userWarehouse = mapWarehouse(userLocName);
          if (userWarehouse) params.append("warehouse", userWarehouse);
          searchParam = params.toString();
        } else {
          searchParam = "";
        }

        const url = `${API_URL}/api/purchase/orders${searchParam ? `?${searchParam}` : ""}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch purchase orders");
        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error loading purchase orders:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
    const handleOrderSaved = () => fetchOrders();
    window.addEventListener("orderSaved", handleOrderSaved);
    return () => window.removeEventListener("orderSaved", handleOrderSaved);
  }, [isNewOrder, API_URL, searchOrderNumber]);

  const handleSendOrder = async (orderId) => {
    setSending(prev => ({ ...prev, [orderId]: true }));
    try {
      const response = await fetch(`${API_URL}/api/purchase/orders/${orderId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send purchase order");
      }
      setOrders(prev => prev.map(order => order._id === orderId ? { ...order, status: "sent" } : order));
      alert("Purchase order sent successfully!");
    } catch (error) {
      alert("Failed to send purchase order: " + error.message);
    } finally {
      setSending(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "-";
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    } catch { return "-"; }
  };

  const getStatusBadge = (status) => {
    const map = {
      draft:     { label: "Draft",     bg: "bg-[#F4F4F5]", text: "text-[#525252]", dot: "bg-[#9CA3AF]" },
      sent:      { label: "Sent",      bg: "bg-[#F3E8FF]", text: "text-[#9D43D6]", dot: "bg-[#9D43D6]" },
      received:  { label: "Received",  bg: "bg-[#DCFCE7]", text: "text-[#15803D]", dot: "bg-[#16A34A]" },
      cancelled: { label: "Cancelled", bg: "bg-[#FEE2E2]", text: "text-[#DC2626]", dot: "bg-[#EF4444]" },
    };
    const s = map[status] || map.draft;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[12px] font-medium ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Purchase Orders" />
      <div className={`transition-all duration-300 flex flex-col ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>

        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#1B1B1B]">All Purchase Orders</h1>
          <Link
            to="/purchase/orders/new"
            className="rf-btn-primary inline-flex items-center gap-1.5 !h-[38px] !px-5 !text-[13px]"
          >
            <Plus size={15} />
            <span>New Purchase Order</span>
          </Link>
        </div>

        <div className="p-5 md:p-6 flex-1 space-y-4">
          {/* Toolbar Row: Search (left) & Count Pill (right) */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full sm:w-[340px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center">
                <Search size={15} className="text-[#212121]" />
                <span className="h-4 w-[1px] bg-[#E5E5E5] ml-2.5" />
              </div>
              <input
                type="text"
                placeholder="Search by order number"
                value={searchOrderNumber}
                onChange={(e) => setSearchOrderNumber(e.target.value)}
                className="rf-input !pl-12 !pr-9 !h-[42px] bg-white"
              />
              {searchOrderNumber && (
                <button
                  type="button"
                  onClick={() => setSearchOrderNumber("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#525252] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <span className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-[#F3E8FF] text-[#9D43D6] text-[12px] font-medium">
              {orders.length} {orders.length === 1 ? "Purchase Order" : "Purchase Orders"}
            </span>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="bg-white rounded-[16px] border border-[#E5E5E5] py-24 flex flex-col items-center justify-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#9D43D6] border-t-transparent" />
              <p className="text-[13px] font-medium text-[#7A7A7A]">Loading purchase orders...</p>
            </div>

          ) : orders.length === 0 ? (
            /* ── Empty State Card ── */
            <div className="bg-white rounded-[16px] border border-[#E5E5E5] shadow-[0_1px_2px_rgba(0,0,0,0.02)] py-20 px-6 flex flex-col items-center justify-center text-center min-h-[340px]">
              {/* Purple Clipboard & Magnifier Illustration */}
              <svg
                width="170"
                height="120"
                viewBox="0 0 170 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-5"
                aria-hidden="true"
              >
                <ellipse cx="85" cy="108" rx="62" ry="6" fill="#F3E8FF" />
                {/* Leaf accents */}
                <path d="M132 104C132 90 140 80 148 76C146 88 140 97 132 104Z" fill="#C4B5FD" />
                <path d="M130 104C128 92 132 82 137 74C138 85 135 95 130 104Z" fill="#A78BFA" />
                <path d="M124 104C121 96 121 89 124 83C127 89 127 97 124 104Z" fill="#DDD6FE" />
                {/* Clipboard */}
                <rect x="68" y="20" width="54" height="84" rx="8" fill="#EDE9FE" stroke="#C4B5FD" strokeWidth="2" />
                <rect x="74" y="27" width="42" height="70" rx="5" fill="#FFFFFF" />
                <rect x="85" y="14" width="20" height="10" rx="4" fill="#9D43D6" />
                <circle cx="95" cy="19" r="2" fill="#FFFFFF" />
                {/* Document icon inside clipboard */}
                <rect x="83" y="42" width="24" height="32" rx="3" fill="#F5F3FF" stroke="#A78BFA" strokeWidth="1.5" />
                <circle cx="91" cy="54" r="1.5" fill="#9D43D6" />
                <circle cx="99" cy="54" r="1.5" fill="#9D43D6" />
                <path d="M90 62C92.5 59.5 97.5 59.5 100 62" stroke="#9D43D6" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="107" cy="70" r="7" fill="#9D43D6" />
                <path d="M104.5 67.5L109.5 72.5M109.5 67.5L104.5 72.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                {/* Magnifying glass */}
                <circle cx="66" cy="48" r="13" fill="#F3E8FF" fillOpacity="0.65" stroke="#7C3AED" strokeWidth="2.5" />
                <line x1="56.5" y1="57.5" x2="47" y2="67" stroke="#7C3AED" strokeWidth="3.5" strokeLinecap="round" />
                {/* Subtle person silhouette accent */}
                <circle cx="44" cy="42" r="8" fill="#2E1065" />
                <path d="M30 78C30 62 36 54 46 54C54 54 58 60 60 72L52 80H30V78Z" fill="#A78BFA" />
                <path d="M32 78L52 78L62 96H34L32 78Z" fill="#4C1D95" />
                <rect x="34" y="96" width="28" height="8" rx="4" fill="#DDD6FE" />
              </svg>

              <h2 className="text-[16px] font-semibold text-[#1B1B1B] tracking-tight">
                Start Managing your purchase activities
              </h2>
              <p className="text-[13px] text-[#8A8A8A] mt-1.5 max-w-md">
                Create, customize, and send professional purchase orders to your vendors
              </p>
            </div>

          ) : (
            /* ── Orders Table Card ── */
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1B1B1B] text-white">
                    <tr>
                      <th className="py-3.5 px-4 text-center text-[11px] font-semibold uppercase tracking-wider w-12">#</th>
                      <th className="py-3.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Date</th>
                      <th className="py-3.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Order #</th>
                      <th className="py-3.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Vendor</th>
                      <th className="py-3.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Reference #</th>
                      <th className="py-3.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Delivery Date</th>
                      <th className="py-3.5 px-4 text-right text-[11px] font-semibold uppercase tracking-wider">Total</th>
                      <th className="py-3.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Status</th>
                      <th className="py-3.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#F0F0F0]">
                    {orders.map((order, index) => (
                      <tr key={order._id || order.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3.5 px-4 text-center text-[13px] text-[#8A8A8A] font-medium">{index + 1}</td>
                        <td className="py-3.5 px-4 text-[13px] text-[#525252] whitespace-nowrap">{formatDate(order.date)}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Link
                            to={`/purchase/orders/${order._id || order.id}`}
                            className="text-[13px] font-semibold text-[#9D43D6] hover:text-[#7E22CE] hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 text-[13px] text-[#212121] font-medium whitespace-nowrap">{order.vendorName || "—"}</td>
                        <td className="py-3.5 px-4 text-[13px] text-[#525252] whitespace-nowrap">{order.referenceNumber || "—"}</td>
                        <td className="py-3.5 px-4 text-[13px] text-[#525252] whitespace-nowrap">{formatDate(order.deliveryDate)}</td>
                        <td className="py-3.5 px-4 text-[13px] font-semibold text-[#1B1B1B] text-right whitespace-nowrap tabular-nums">
                          {currency(order.finalTotal || 0)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getStatusBadge(order.status || "draft")}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {order.status === "draft" && (
                            <button
                              type="button"
                              onClick={() => handleSendOrder(order._id || order.id)}
                              disabled={sending[order._id || order.id]}
                              className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[8px] border border-[#E9D5FF] bg-[#F3E8FF] text-[#9D43D6] text-[12px] font-medium hover:bg-[#E9D5FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Send size={12} />
                              <span>{sending[order._id || order.id] ? "Sending..." : "Send"}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrders;
