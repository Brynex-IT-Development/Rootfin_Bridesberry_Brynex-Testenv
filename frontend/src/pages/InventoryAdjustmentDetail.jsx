import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Edit, Printer, ChevronDown, MoreVertical } from "lucide-react";
import Header from "../components/Header";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";

const InventoryAdjustmentDetail = () => {
  const isSidebarOpen = useSidebar();
  const { id } = useParams();
  const navigate = useNavigate();
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  
  const [adjustment, setAdjustment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPdfView, setShowPdfView] = useState(true);
  
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
  
  // Fetch adjustment
  useEffect(() => {
    const fetchAdjustment = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/inventory/adjustments/${id}`);
        if (!response.ok) throw new Error("Failed to fetch adjustment");
        const data = await response.json();
        setAdjustment(data);
      } catch (error) {
        console.error("Error fetching adjustment:", error);
        alert("Failed to load adjustment");
        navigate("/inventory/adjustments");
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchAdjustment();
    }
  }, [id, API_URL, navigate]);
  
  const handlePrint = () => {
    window.print();
  };

  // Company information
  const companyName = "Bridesberry";
  const companyAddress = "Thrissur Kerala 680002";
  const companyCountry = "India";
  const companyGSTIN = "32ABCFR1426N1Z9";
  const companyPhone = "7593838704";
  const companyEmail = "rootmentsoffice@gmail.com";
  
  if (loading) {
    return (
      <div className={`transition-all duration-300 p-6 bg-[#f5f7fb] min-h-screen flex items-center justify-center ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        <div className="text-[#64748b]">Loading adjustment...</div>
      </div>
    );
  }
  
  if (!adjustment) {
    return (
      <div className={`transition-all duration-300 p-6 bg-[#f5f7fb] min-h-screen flex items-center justify-center ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        <div className="text-center">
          <p className="text-[#64748b] mb-4">Adjustment not found</p>
          <Link
            to="/inventory/adjustments"
            className="text-[#2563eb] hover:underline"
          >
            Back to Inventory Adjustments
          </Link>
        </div>
      </div>
    );
  }

  // Format branch name
  const branchName = adjustment.branch 
    ? (adjustment.branch.includes("Branch") 
        ? adjustment.branch 
        : `${adjustment.branch} Branch`)
    : "-";

  // Format created by (warehouse)
  const createdBy = adjustment.warehouse
    ? (adjustment.warehouse.includes("Warehouse")
        ? adjustment.warehouse
        : `Warehouse ${adjustment.warehouse}`)
    : adjustment.createdBy || "-";

  // Format adjustment type
  const adjustmentType = adjustment.adjustmentType === "quantity" 
    ? "Quantity" 
    : adjustment.adjustmentType === "value"
    ? "Value"
    : adjustment.adjustmentType || "-";
  
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Adjustment Details" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#212121]">Adjustment Details</h1>
        </div>
        <div className="p-5 md:p-6">
      {/* Top Bar with Actions */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-white rounded-[12px] border border-[#E5E5E5] px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/inventory/adjustments"
            className="inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 text-[13px] font-medium text-[#212121] hover:bg-[#FAFAFA] transition-colors"
          >
            <ArrowLeft size={15} />
            <span>Back</span>
          </Link>
          <Link
            to={`/inventory/adjustments/${id}/edit`}
            className="inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 text-[13px] font-medium text-[#212121] hover:bg-[#FAFAFA] transition-colors"
          >
            <Edit size={15} className="text-[#9D43D6]" />
            <span>Edit</span>
          </Link>
          <button
            onClick={handlePrint}
            className="rf-btn-primary inline-flex items-center gap-2 !h-[38px] !px-4 !text-[13px]"
          >
            <Printer size={15} />
            <span>PDF / Print</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] font-medium text-[#525252] cursor-pointer">
            <input
              type="checkbox"
              checked={showPdfView}
              onChange={(e) => setShowPdfView(e.target.checked)}
              className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#9D43D6] cursor-pointer"
            />
            Show PDF View
          </label>
          <button className="p-1.5 rounded-[8px] hover:bg-[#F4F4F5] transition-colors">
            <MoreVertical size={16} className="text-[#7A7A7A]" />
          </button>
        </div>
      </div>
      
      {/* Document View */}
      {showPdfView && (
        <div className="bg-white rounded-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#E5E5E5] overflow-hidden print:shadow-none print:border-0" style={{ maxWidth: '210mm', margin: '0 auto', position: 'relative' }}>
          {/* Status Banner - Diagonal Overlay (Top Left) */}
          {adjustment.status === "adjusted" && (
            <div 
              className="absolute top-0 left-0 bg-[#9D43D6] text-white px-16 py-2 text-xs font-bold uppercase tracking-wider shadow-lg z-10"
              style={{
                transform: 'rotate(-45deg)',
                transformOrigin: 'top left',
                marginLeft: '-35px',
                marginTop: '25px',
                letterSpacing: '0.1em',
              }}
            >
              Adjusted
            </div>
          )}
          
          <div className="p-10 print:p-8" style={{ paddingTop: adjustment.status === "adjusted" ? '60px' : '24px' }}>
            {/* Header with Company Info and Document Title */}
            <div className="mb-8 flex justify-between items-start">
              {/* Company Information (Left) */}
              <div className="text-[13px] text-[#212121] space-y-1">
                <div>
                  <span className="font-semibold text-[#525252]">Branch Name: </span>
                  <span>{branchName}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#525252]">Created By: </span>
                  <span>{createdBy}</span>
                </div>
                <div className="mt-2">{companyCountry}</div>
                <div>GSTIN {companyGSTIN}</div>
              </div>

              {/* Document Title (Center) */}
              <div className="flex-1 text-center">
                <h1 className="text-[24px] font-bold text-[#1B1B1B] tracking-tight">INVENTORY ADJUSTMENT</h1>
              </div>

              {/* Adjustment Details (Right) */}
              <div className="text-[13px] text-[#212121] space-y-1 text-right">
                <div>
                  <span className="font-semibold text-[#525252]">Date: </span>
                  <span>{formatDate(adjustment.date)}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#525252]">Ref#: </span>
                  <span className="font-semibold text-[#9D43D6]">{adjustment.referenceNumber || "-"}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#525252]">Reason: </span>
                  <span>{adjustment.reason || "-"}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#525252]">Account: </span>
                  <span>{adjustment.account || "-"}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#525252]">Adjustment Type: </span>
                  <span>{adjustmentType}</span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mt-8 rounded-[10px] border border-[#E5E5E5] overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#1B1B1B] text-white">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Item & Description</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Quantity Adjusted</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Newly Adjusted Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {adjustment.items && adjustment.items.length > 0 ? (
                    adjustment.items.map((item, index) => (
                      <tr key={index} className="hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3 text-[13px] text-[#525252]">{index + 1}</td>
                        <td className="px-4 py-3 text-[13px] text-[#1B1B1B] font-mono font-medium">
                          {item.itemSku || "-"}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#1B1B1B]">
                          {item.itemName || "-"}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right text-[#1B1B1B] font-semibold tabular-nums">
                          {parseFloat(item.quantityAdjusted || 0).toFixed(2)} PCS
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right text-[#1B1B1B] font-semibold tabular-nums">
                          {parseFloat(item.newQuantity || item.currentQuantity || 0).toFixed(2)} PCS
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-[13px] text-[#7A7A7A]">
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Non-PDF View (if toggle is off) */}
      {!showPdfView && (
        <div className="bg-white rounded-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#E5E5E5] p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#F0F0F0]">
            <h1 className="text-[20px] font-bold text-[#1B1B1B]">
              {adjustment.referenceNumber || "Inventory Adjustment"}
            </h1>
            <span className={`inline-flex items-center rounded-[6px] px-3 py-1 text-[12px] font-semibold ${
              adjustment.status === "adjusted"
                ? "bg-[#DCFCE7] text-[#16A34A]"
                : "bg-[#FEF3C7] text-[#B45309]"
            }`}>
              {adjustment.status === "adjusted" ? "Adjusted" : "Draft"}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-3.5">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Date</span>
              <span className="text-[13px] font-semibold text-[#1B1B1B] mt-0.5 block">{formatDate(adjustment.date)}</span>
            </div>
            <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-3.5">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Reason</span>
              <span className="text-[13px] font-semibold text-[#1B1B1B] mt-0.5 block">{adjustment.reason || "-"}</span>
            </div>
            <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-3.5">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Warehouse</span>
              <span className="text-[13px] font-semibold text-[#1B1B1B] mt-0.5 block">{adjustment.warehouse || "-"}</span>
            </div>
            <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-3.5">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Branch</span>
              <span className="text-[13px] font-semibold text-[#1B1B1B] mt-0.5 block">{branchName}</span>
            </div>
            <div className="rounded-[10px] border border-[#EBEBEB] bg-[#FAFAFA] p-3.5">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Adjustment Type</span>
              <span className="text-[13px] font-semibold text-[#1B1B1B] mt-0.5 block">{adjustmentType}</span>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-[13px] font-semibold text-[#1B1B1B] mb-3">Adjusted Items</h3>
            <div className="border border-[#E5E5E5] rounded-[12px] overflow-hidden">
              <table className="min-w-full border-collapse">
                <thead className="bg-[#1B1B1B] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Quantity Adjusted</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Newly Adjusted Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {adjustment.items && adjustment.items.length > 0 ? (
                    adjustment.items.map((item, index) => (
                      <tr key={index} className="hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3 text-[13px] font-mono font-medium text-[#1B1B1B]">{item.itemSku || "-"}</td>
                        <td className="px-4 py-3 text-[13px] text-[#212121]">{item.itemName || "-"}</td>
                        <td className="px-4 py-3 text-[13px] text-right font-medium text-[#1B1B1B] tabular-nums">
                          {parseFloat(item.quantityAdjusted || 0).toFixed(2)} PCS
                        </td>
                        <td className="px-4 py-3 text-[13px] text-right font-semibold text-[#1B1B1B] tabular-nums">
                          {parseFloat(item.newQuantity || item.currentQuantity || 0).toFixed(2)} PCS
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-[13px] text-[#7A7A7A]">
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default InventoryAdjustmentDetail;

