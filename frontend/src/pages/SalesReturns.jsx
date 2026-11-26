import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse as mapWarehouse } from "../utils/warehouseMapping";
import { useSidebar } from "../hooks/useSidebar.js";
import dataCache from "../utils/cache";
import { Search, Calendar, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw, ArrowLeft } from "lucide-react";

import AppSelect from "../components/AppSelect.jsx";
const SalesReturns = () => {
  const isSidebarOpen = useSidebar();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState(null);
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

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Delete return invoice
  const handleDeleteReturn = async () => {
    if (!returnToDelete) return;
    
    setDeleting(true);
    try {
      const user = getUserInfo();
      const returnId = returnToDelete._id || returnToDelete.id;
      
      console.log(`Deleting return invoice: ${returnId}`);
      
      const response = await fetch(
        `${API_URL}/api/sales/invoices/${returnId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user?.email }),
        }
      );

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error("Delete response error:", responseData);
        throw new Error(responseData.message || "Failed to delete return");
      }

      setReturns(returns.filter(ret => (ret._id || ret.id) !== returnId));
      setShowDeleteModal(false);
      setReturnToDelete(null);
      
      dataCache.clear();
      sessionStorage.setItem('invoiceDeleted', 'true');
      
      alert("Return invoice deleted successfully");
    } catch (error) {
      console.error("Error deleting return:", error);
      alert(`Failed to delete return: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const fetchReturns = async () => {
      setLoading(true);
      setError(null);

      try {
        const user = getUserInfo();
        if (!user || !user.email) {
          setError("User information not found. Please log in again.");
          setLoading(false);
          return;
        }

        const adminEmails = ['officerootments@gmail.com'];
        const isAdminEmail = user.email && adminEmails.some(email => user.email.toLowerCase() === email.toLowerCase());
        const userIsAdmin = isAdminEmail || user.power === "admin" || (user.locCode && (user.locCode === '858' || user.locCode === '103'));
        setIsAdmin(userIsAdmin);

        const params = new URLSearchParams({
          userId: user.email,
          category: "Return",
        });

        if (user.power) params.append("userPower", user.power);
        if (user.locCode) params.append("locCode", user.locCode);
        
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
        if (user?.locCode) {
          params.append("filterLocCode", user.locCode);
        }

        const response = await fetch(`${API_URL}/api/sales/invoices?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch returns: ${response.statusText}`);
        }

        const data = await response.json();
        const returnInvoices = Array.isArray(data) ? data.filter(inv => inv.category === "Return") : [];
        setReturns(returnInvoices);
      } catch (err) {
        console.error("Error fetching returns:", err);
        setError(err.message || "Failed to load returns");
      } finally {
        setLoading(false);
      }
    };

    fetchReturns();
  }, [API_URL]);

  const filteredReturns = returns.filter(ret => {
    // Date range filtering
    if (fromDate || toDate) {
      if (!ret.invoiceDate) return false;
      const invoiceDateStr = new Date(ret.invoiceDate).toISOString().split("T")[0];
      if (fromDate && invoiceDateStr < fromDate) return false;
      if (toDate && invoiceDateStr > toDate) return false;
    }

    const searchLower = searchTerm.toLowerCase();
    return (
      ret.invoiceNumber?.toLowerCase().includes(searchLower) ||
      ret.customer?.toLowerCase().includes(searchLower) ||
      ret.originalInvoiceNumber?.toLowerCase().includes(searchLower) ||
      ret.branch?.toLowerCase().includes(searchLower)
    );
  });

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredReturns.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReturns = filteredReturns.slice(startIndex, endIndex);

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
      <Header title="Invoice Returns" />
      <div className={`invoice-page-wrapper transition-all duration-300 min-h-screen bg-[#FFFFFF] flex flex-col ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="px-8 py-4 border-b border-[#E5E5E5] bg-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[18px] font-semibold text-[#212121]">Invoice Returns</h1>
            <span className="bg-[#EFE3F7] text-[#9D43D6] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
              {filteredReturns.length} {filteredReturns.length === 1 ? 'Return' : 'Returns'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/sales/invoices"
              className="rf-btn-cancel h-[38px]"
            >
              <ArrowLeft size={14} />
              <span>Back to Invoices</span>
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
                  placeholder="Search by return #, customer name, or original invoice #..."
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
                <p className="text-[13px] text-[#6A6A6A]">Loading returns...</p>
              </div>
            ) : error ? (
              <div className="px-8 py-16 text-center">
                <p className="text-[13px] font-semibold text-red-500">{error}</p>
              </div>
            ) : returns.length === 0 ? (
              <div className="px-8 py-16 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[#EFE3F7] flex items-center justify-center mb-3">
                  <RotateCcw size={22} className="text-[#9D43D6]" />
                </div>
                <h3 className="text-[15px] font-semibold text-[#212121] mb-1">No Returns Found</h3>
                <p className="text-[13px] text-[#6A6A6A] max-w-sm mb-4">
                  No returns found. Create your first return from invoices!
                </p>
                <Link
                  to="/sales/invoices"
                  className="rf-btn-primary"
                >
                  <FileText size={14} />
                  <span>View Invoices</span>
                </Link>
              </div>
            ) : filteredReturns.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <p className="text-[13px] text-[#6A6A6A]">No returns match your search. Try a different search term.</p>
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
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">RETURN #</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">ORIGINAL INVOICE</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">CUSTOMER NAME</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">REASON</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">SUB CATEGORY</th>
                      <th className="px-3.5 py-3 text-right whitespace-nowrap">RETURN AMOUNT</th>
                      <th className="px-3.5 py-3 text-left whitespace-nowrap">BRANCH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEFEF] text-[13px] text-[#212121]">
                    {paginatedReturns.map((ret, index) => (
                      <tr
                        key={ret._id || index}
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
                          {formatDate(ret.invoiceDate)}
                        </td>
                        <td className="px-3.5 py-3 font-semibold border-r border-[#F3F3F3]">
                          <Link
                            to={`/sales/invoices/${ret._id}`}
                            className="text-[#9D43D6] hover:text-[#8B3CBD] hover:underline"
                          >
                            {ret.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-3.5 py-3 text-[#4A4A4A] border-r border-[#F3F3F3]">
                          {ret.originalInvoiceNumber || "-"}
                        </td>
                        <td className="px-3.5 py-3 text-[#212121] font-medium border-r border-[#F3F3F3]">{ret.customer || "-"}</td>
                        <td className="px-3.5 py-3 text-[#4A4A4A] border-r border-[#F3F3F3]">
                          <span className="inline-block max-w-xs truncate" title={ret.remark}>
                            {ret.remark?.replace("Return for: ", "") || "-"}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-[#4A4A4A] border-r border-[#F3F3F3]">{ret.subCategory || "-"}</td>
                        <td className="px-3.5 py-3 text-right font-semibold text-[#DC2626] border-r border-[#F3F3F3] tabular-nums">
                          {formatCurrency(Math.abs(ret.finalTotal))}
                        </td>
                        <td className="px-3.5 py-3 text-[#4A4A4A]">{ret.branch || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Table Footer with Pagination */}
                <div className="border-t border-[#E5E5E5] bg-[#FAFAFA] px-5 py-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#6A6A6A]">
                    <div className="flex items-center gap-4">
                      <span>
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredReturns.length)} of {filteredReturns.length} {filteredReturns.length !== 1 ? 'returns' : 'return'}
                      </span>
                      <span className="font-semibold text-[#212121] tabular-nums">
                        Total: ₹{filteredReturns.reduce((sum, ret) => sum + (Math.abs(parseFloat(ret.finalTotal)) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                            </AppSelect>
                          </div>
                        </div>
                        <span className="text-[12px] font-semibold text-[#212121]">
                          {currentPage} / {totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={goToFirstPage}
                            disabled={currentPage === 1}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="First Page"
                          >
                            <ChevronsLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Previous Page"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Next Page"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={goToLastPage}
                            disabled={currentPage === totalPages}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Last Page"
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

export default SalesReturns;
