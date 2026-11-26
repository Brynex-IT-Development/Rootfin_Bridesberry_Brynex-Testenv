import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse as mapWarehouse } from "../utils/warehouseMapping";
import { useSidebar } from "../hooks/useSidebar.js";
import dataCache from "../utils/cache";
import { Plus, Search, Calendar, RotateCcw, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import AppSelect from "../components/AppSelect.jsx";
const SalesInvoices = () => {
  const isSidebarOpen = useSidebar();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Date range filtering states
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

  // Get user info from localStorage
  const getUserInfo = () => {
    try {
      const userStr = localStorage.getItem("rootfinuser");
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
    }
    return null;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "sent":
        return "bg-purple-50 text-purple-700 border border-purple-200";
      case "draft":
        return "bg-gray-100 text-gray-700 border border-gray-200";
      case "overdue":
        return "bg-red-50 text-red-700 border border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  // Get return status badge
  const getReturnStatusBadge = (returnStatus) => {
    switch (returnStatus) {
      case "full":
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-none bg-red-50 text-red-700 border border-red-200">
            FULLY RETURNED
          </span>
        );
      case "partial":
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-none bg-amber-50 text-amber-700 border border-amber-200">
            PARTIALLY RETURNED
          </span>
        );
      case "none":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-none bg-gray-100 text-gray-600 border border-gray-200">
            NOT RETURNED
          </span>
        );
    }
  };

  // Delete invoice
  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    
    setDeleting(true);
    try {
      const user = getUserInfo();
      const invoiceId = invoiceToDelete._id || invoiceToDelete.id;
      
      console.log(`Deleting invoice: ${invoiceId}`);
      
      const response = await fetch(
        `${API_URL}/api/sales/invoices/${invoiceId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user?.email }),
        }
      );

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error("Delete response error:", responseData);
        // Close modal and reset state before showing error
        setShowDeleteModal(false);
        setInvoiceToDelete(null);
        setDeleting(false);
        
        // Show error message to user
        alert(`Cannot delete invoice: ${responseData.message || "Failed to delete invoice"}`);
        return; // Exit early, don't remove from list
      }

      // Only remove from list if deletion was successful
      setInvoices(invoices.filter(inv => (inv._id || inv.id) !== invoiceId));
      setShowDeleteModal(false);
      setInvoiceToDelete(null);
      
      // Clear cache so Financial Summary Report fetches fresh data
      dataCache.clear();
      
      // Set flag to trigger refresh in Financial Summary Report
      sessionStorage.setItem('invoiceDeleted', 'true');
      
      alert("Invoice deleted successfully");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      // Close modal and reset state on error
      setShowDeleteModal(false);
      setInvoiceToDelete(null);
      alert(`Failed to delete invoice: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Fetch invoices from API
  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      setError(null);

      try {
        const user = getUserInfo();
        if (!user || !user.email) {
          setError("User information not found. Please log in again.");
          setLoading(false);
          return;
        }

        // Check if user is admin
        const adminEmails = ['officerootments@gmail.com'];
        const isAdminEmail = user.email && adminEmails.some(email => user.email.toLowerCase() === email.toLowerCase());
        const userIsAdmin = isAdminEmail || user.power === "admin" || (user.locCode && (user.locCode === '858' || user.locCode === '103'));
        setIsAdmin(userIsAdmin);

        const params = new URLSearchParams({
          userId: user.email,
        });

        // Add userPower and locCode if available
        if (user.power) params.append("userPower", user.power);
        if (user.locCode) params.append("locCode", user.locCode);
        
        // Add warehouse parameter for filtering
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
        
        const userWarehouse = mapWarehouse(userLocName);
        if (userWarehouse) {
          params.append("warehouse", userWarehouse);
        }
        // Also pass the locCode for filtering by location code
        if (user?.locCode) {
          params.append("filterLocCode", user.locCode);
        }

        // Add date range filtering if specified
        if (fromDate) params.append("fromDate", fromDate);
        if (toDate) params.append("toDate", toDate);

        const response = await fetch(`${API_URL}/api/sales/invoices?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch invoices: ${response.statusText}`);
        }

        const data = await response.json();
        setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching invoices:", err);
        setError(err.message || "Failed to load invoices");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [API_URL, fromDate, toDate]);

  // Filter invoices based on search term AND exclude Return/Refund/Cancel categories
  const filteredInvoices = invoices.filter(invoice => {
    // Exclude Return/Refund/Cancel invoices from this page
    const categoryLower = (invoice.category || "").toLowerCase().trim();
    const isReturnRefundCancel = ["return", "refund", "cancel"].includes(categoryLower);
    
    // Also check invoice number pattern (RTN-, RET-, REFUND-INV, etc.)
    const invoiceNumber = (invoice.invoiceNumber || "").toUpperCase();
    const hasReturnPrefix = invoiceNumber.startsWith("RTN-") || 
                           invoiceNumber.startsWith("RET-") || 
                           invoiceNumber.startsWith("REFUND-") || 
                           invoiceNumber.startsWith("CANCEL-");
    
    if (isReturnRefundCancel || hasReturnPrefix) {
      console.log(`🚫 Filtering out return invoice: ${invoice.invoiceNumber} (category: ${invoice.category})`);
      return false; // Don't show return/refund/cancel invoices on this page
    }
    
    // Apply search filter
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
      invoice.customer?.toLowerCase().includes(searchLower) ||
      invoice.orderNumber?.toLowerCase().includes(searchLower) ||
      invoice.branch?.toLowerCase().includes(searchLower)
    );
  });
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);
  
  // Reset to page 1 when search term or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);
  
  // Pagination handlers
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };
  
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Header title="Sales Invoices" />
      <div className={`invoice-page-wrapper transition-all duration-300 min-h-screen bg-[#FFFFFF] flex flex-col ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="px-8 py-4 border-b border-[#E5E5E5] bg-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[18px] font-semibold text-[#212121]">Sales Invoices</h1>
            <span className="bg-[#EFE3F7] text-[#9D43D6] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
              {filteredInvoices.length} {filteredInvoices.length === 1 ? 'Invoice' : 'Invoices'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/sales/invoices/returns"
              className="rf-btn-cancel h-[38px]"
            >
              <RotateCcw size={14} />
              <span>View Returns</span>
            </Link>
            <Link
              to="/sales/invoices/new"
              className="rf-btn-primary h-[38px]"
            >
              <Plus size={15} />
              <span>New Invoice</span>
            </Link>
          </div>
        </div>

        {/* Toolbar Row: Search + Date Filter */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative w-full sm:w-[320px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center">
                  <Search size={15} className="text-[#212121]" />
                  <span className="h-4 w-[1px] bg-[#E5E5E5] ml-2.5" />
                </div>
                <input
                  type="text"
                  placeholder="Search by invoice #, customer name, or order #..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rf-input !pl-12"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowDateFilter(!showDateFilter)}
                className={`h-[40px] px-4 rounded-xl border text-[13px] font-medium transition-colors inline-flex items-center gap-2 cursor-pointer ${
                  showDateFilter || fromDate || toDate
                    ? 'border-[#9D43D6] bg-[#FBF5FC] text-[#9D43D6]'
                    : 'border-[#E5E5E5] bg-white hover:bg-[#F7F7F7] text-[#212121]'
                }`}
              >
                <Calendar size={14} />
                <span>Date Filter</span>
              </button>
            </div>

            {/* Active Filter Badges */}
            <div className="flex items-center gap-2">
              {(fromDate || toDate) && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#EFE3F7] px-2.5 py-1 text-[11px] font-semibold text-[#9D43D6]">
                  Date Filtered
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF3C7] px-2.5 py-1 text-[11px] font-semibold text-[#92400E]">
                  "{searchTerm}"
                </span>
              )}
            </div>
          </div>

          {/* Date Range Drawer */}
          {showDateFilter && (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
              <div className="rf-form-field !mb-0">
                <label className="rf-field-label">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rf-input !w-[165px]"
                />
              </div>
              <div className="rf-form-field !mb-0">
                <label className="rf-field-label">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rf-input !w-[165px]"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="rf-btn-cancel h-[40px] cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Main Table */}
        <div className="px-8 pb-8">
          <section className="rounded-lg border border-[#E5E5E5] bg-white overflow-hidden">
            {loading ? (
              <div className="px-8 py-16 text-center flex flex-col items-center justify-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#9D43D6] border-t-transparent mb-2" />
                <p className="text-[13px] text-[#6A6A6A]">Loading invoices...</p>
              </div>
            ) : error ? (
              <div className="px-8 py-16 text-center">
                <p className="text-[13px] font-semibold text-red-500">{error}</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="px-8 py-16 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[#EFE3F7] flex items-center justify-center mb-3">
                  <FileText size={22} className="text-[#9D43D6]" />
                </div>
                <h3 className="text-[15px] font-semibold text-[#212121] mb-1">No Invoices Found</h3>
                <p className="text-[13px] text-[#6A6A6A] max-w-sm mb-4">
                  You haven't created any sales invoices yet. Get started by creating your first invoice.
                </p>
                <Link
                  to="/sales/invoices/new"
                  className="rf-btn-primary"
                >
                  <Plus size={14} />
                  <span>Create Invoice</span>
                </Link>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <p className="text-[13px] text-[#6A6A6A]">No invoices match your search. Try a different search term.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#1B1B1B] text-white text-[11px] uppercase tracking-wider font-semibold">
                      <th className="w-12 px-3 py-3 text-center whitespace-nowrap">#</th>
                      <th className="w-10 px-3 py-3 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded accent-[#9D43D6] cursor-pointer"
                        />
                      </th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">DATE</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">INVOICE#</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">ORDER NUMBER</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">CUSTOMER NAME</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">INVOICE STATUS</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">RETURN STATUS</th>
                      <th className="px-3.5 py-3 text-right whitespace-nowrap">INVOICE AMOUNT</th>
                      <th className="px-3.5 py-3 text-right whitespace-nowrap">BALANCE</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">BRANCH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEFEF] text-[13px] text-[#212121]">
                    {paginatedInvoices.map((invoice, index) => (
                      <tr
                        key={invoice._id || invoice.id}
                        className="bg-white hover:bg-[#FBF5FC] transition-colors"
                      >
                        <td className="px-3 py-3 text-center text-[#6A6A6A] border-r border-[#F3F3F3] tabular-nums">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-3 py-3 text-center border-r border-[#F3F3F3]">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded accent-[#9D43D6] cursor-pointer"
                          />
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap text-[#4A4A4A] border-r border-[#F3F3F3]">
                          {formatDate(invoice.invoiceDate)}
                        </td>
                        <td className="px-3.5 py-3 font-semibold border-r border-[#F3F3F3]">
                          <Link
                            to={`/sales/invoices/${invoice._id || invoice.id}`}
                            className="text-[#9D43D6] hover:text-[#8B3CBD] hover:underline"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-3.5 py-3 text-[#4A4A4A] border-r border-[#F3F3F3]">{invoice.orderNumber || "-"}</td>
                        <td className="px-3.5 py-3 text-[#212121] font-medium border-r border-[#F3F3F3]">{invoice.customer || "-"}</td>
                        <td className="px-3.5 py-3 border-r border-[#F3F3F3]">
                          <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-md ${getStatusColor(invoice.status)}`}>
                            {(invoice.status || "sent").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 border-r border-[#F3F3F3]">
                          {getReturnStatusBadge(invoice.returnStatus)}
                        </td>
                        <td className="px-3.5 py-3 text-right font-semibold text-[#212121] border-r border-[#F3F3F3] tabular-nums">
                          {formatCurrency(
                            parseFloat(invoice.finalTotal) > 0
                              ? invoice.finalTotal
                              : (invoice.lineItems || []).reduce((s, i) => s + (parseFloat(i.lineTotal) || (parseFloat(i.quantity || 0) * parseFloat(i.rate || 0))), 0)
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right font-semibold text-[#212121] border-r border-[#F3F3F3] tabular-nums">
                          ₹0.00
                        </td>
                        <td className="px-3.5 py-3 text-[#4A4A4A]">{invoice.branch || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Table Footer with Pagination */}
                <div className="border-t border-[#E5E5E5] bg-[#FAFAFA] px-5 py-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#6A6A6A]">
                    <div className="flex items-center gap-4">
                      <span>
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredInvoices.length)} of {filteredInvoices.length} {filteredInvoices.length !== 1 ? 'invoices' : 'invoice'}
                      </span>
                      <span className="font-semibold text-[#212121] tabular-nums">
                        Total: ₹{filteredInvoices.reduce((sum, inv) => {
                          const total = parseFloat(inv.finalTotal) > 0
                            ? parseFloat(inv.finalTotal)
                            : (inv.lineItems || []).reduce((s, i) => s + (parseFloat(i.lineTotal) || (parseFloat(i.quantity || 0) * parseFloat(i.rate || 0))), 0);
                          return sum + total;
                        }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] text-[#6A6A6A]">Rows:</span>
                          <div className="w-[82px]">
                            <AppSelect
                              value={itemsPerPage}
                              onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                              }}
                            >
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                              <option value={200}>200</option>
                            </AppSelect>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={goToFirstPage}
                            disabled={currentPage === 1}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="First page"
                          >
                            <ChevronsLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Previous page"
                          >
                            <ChevronLeft size={14} />
                          </button>

                          <span className="px-2.5 text-[12px] font-semibold text-[#212121]">
                            {currentPage} / {totalPages}
                          </span>

                          <button
                            type="button"
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Next page"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={goToLastPage}
                            disabled={currentPage === totalPages}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Last page"
                          >
                            <ChevronsRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SalesInvoices;

