import { useMemo, useState, useEffect } from "react";
import Header from "../components/Header";
import { Link, useLocation } from "react-router-dom";
import { Search, Plus, Download, X } from "lucide-react";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";

const currency = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);

const PurchaseVendors = () => {
  const isSidebarOpen = useSidebar();
  const location = useLocation();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Load vendors from API and localStorage
  useEffect(() => {
    const loadVendors = async () => {
      setLoading(true);
      try {
        const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

        // Get user info - use email as primary identifier
        const userStr = localStorage.getItem("rootfinuser");
        const user = userStr ? JSON.parse(userStr) : null;
        const userId = user?.email || null;
        const userPower = user?.power || "";

        let vendorsFromAPI = [];

        // Try to fetch from PostgreSQL API first
        if (userId) {
          try {
            const response = await fetch(`${API_URL}/api/purchase/vendors?userId=${encodeURIComponent(userId)}${userPower ? `&userPower=${encodeURIComponent(userPower)}` : ""}`);
            if (response.ok) {
              const data = await response.json();
              vendorsFromAPI = Array.isArray(data) ? data : [];
            }
          } catch (apiError) {
            console.warn("API fetch failed, trying localStorage:", apiError);
          }
        }

        // Fallback to localStorage if API returns no vendors or fails
        let vendorsFromLocalStorage = [];
        try {
          const savedVendors = JSON.parse(localStorage.getItem("vendors") || "[]");
          vendorsFromLocalStorage = Array.isArray(savedVendors) ? savedVendors : [];
        } catch (localError) {
          console.warn("Error reading localStorage:", localError);
        }

        // Combine both sources, prioritizing API results
        // Use a Map to avoid duplicates (by displayName or id)
        const vendorMap = new Map();

        // Add API vendors first
        vendorsFromAPI.forEach(vendor => {
          const key = vendor.displayName || vendor.companyName || vendor._id || vendor.id;
          if (key) vendorMap.set(key, vendor);
        });

        // Add localStorage vendors if not already present
        vendorsFromLocalStorage.forEach(vendor => {
          const key = vendor.displayName || vendor.companyName || vendor.id;
          if (key && !vendorMap.has(key)) {
            vendorMap.set(key, vendor);
          }
        });

        // Convert to array and ensure each vendor has an id field (use _id if id doesn't exist)
        const allVendors = Array.from(vendorMap.values()).map(vendor => ({
          ...vendor,
          id: vendor.id || vendor._id || vendor.displayName || vendor.companyName,
        }));

        setVendors(allVendors);
      } catch (error) {
        console.error("Error loading vendors:", error);
        // Final fallback to localStorage only
        try {
          const savedVendors = JSON.parse(localStorage.getItem("vendors") || "[]");
          setVendors(savedVendors);
        } catch {
          setVendors([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadVendors();

    // Listen for storage events to update when vendors are added from another tab/window
    const handleStorageChange = (e) => {
      if (e.key === "vendors") {
        loadVendors();
      }
    };

    // Listen for custom event when vendor is saved in the same tab
    const handleVendorSaved = () => {
      loadVendors();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("vendorSaved", handleVendorSaved);

    // Also reload when location changes (when coming back from create page)
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("vendorSaved", handleVendorSaved);
    };
  }, [location]);

  // Filter vendors based on search term
  const filteredVendors = useMemo(() => {
    // First filter out inactive vendors (only show active by default)
    const activeVendors = vendors.filter(v => {
      // If explicitly marked as inactive in either field, filter it out
      if (v.isActive === false || v.isActive === 'false' || v.status === 'inactive') {
        return false;
      }
      return true;
    });

    if (!searchTerm) return activeVendors;
    const term = searchTerm.toLowerCase();
    return activeVendors.filter((v) => {
      const name = (v.displayName || v.companyName || v.name || `${v.firstName || ""} ${v.lastName || ""}`).toLowerCase();
      const company = (v.companyName || "").toLowerCase();
      const email = (v.email || "").toLowerCase();
      const phone = (v.phone || v.mobile || "").toLowerCase();
      return name.includes(term) || company.includes(term) || email.includes(term) || phone.includes(term);
    });
  }, [vendors, searchTerm]);

  const handleExport = () => {
    if (filteredVendors.length === 0) return alert("No vendors to export");

    const headers = ["Name", "Company Name", "Email", "Work Phone", "GST Treatment", "Payables", "Unused Credits"];
    const rows = filteredVendors.map(v => [
      v.displayName || `${v.firstName || ""} ${v.lastName || ""}`.trim(),
      v.companyName || "-",
      v.email || "-",
      v.phone || v.mobile || "-",
      v.gstTreatment || "-",
      v.payables || 0,
      v.credits || 0
    ]);

    const csvContent = [
      headers.map(h => `"${h}"`).join(","),
      ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `all_vendors_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Vendors" />
      <div className={`transition-all duration-300 flex flex-col ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#1B1B1B]">All Vendors</h1>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-[#ECECEE] hover:bg-[#E2E2E5] text-[13px] font-medium text-[#1B1B1B] transition-colors cursor-pointer"
            >
              <span>Export CSV</span>
              <Download size={15} className="text-[#1B1B1B]" />
            </button>
            <Link
              to="/purchase/vendors/new"
              className="rf-btn-primary inline-flex items-center gap-1.5 !h-[38px] !px-5 !text-[13px]"
            >
              <Plus size={15} />
              <span>New Vendor</span>
            </Link>
          </div>
        </div>

        <div className="p-5 md:p-6 flex-1 space-y-4">
          {/* Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full sm:w-[340px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center">
                <Search size={15} className="text-[#212121]" />
                <span className="h-4 w-[1px] bg-[#E5E5E5] ml-2.5" />
              </div>
              <input
                type="text"
                placeholder="Search vendors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rf-input !pl-12 !pr-9 !h-[42px] bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#525252] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Vendors Table */}
          <div className="rounded-[12px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-full text-left">
                <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                  <tr className="bg-[#1B1B1B] text-white text-[11px] uppercase tracking-wider font-semibold">
                    <th scope="col" className="px-4 py-3.5 text-center w-12">
                      #
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-left">
                      NAME
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-left">
                      COMPANY NAME
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-left">
                      EMAIL
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center">
                      WORK PHONE
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center">
                      GST TREATMENT
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      PAYABLES (BCY)
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      UNUSED CREDITS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0] bg-white text-[13px]">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#9D43D6] border-t-transparent" />
                          <p className="text-[13px] font-medium text-[#7A7A7A]">Loading vendors...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredVendors.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-16 text-center text-[#7A7A7A]">
                        {searchTerm ? "No vendors found matching your search." : "No vendors added yet. Click 'New Vendor' to add one."}
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((v, index) => (
                      <tr key={v.id || index} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-4 py-3.5 text-center text-[#525252] font-medium">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Link
                            to={`/purchase/vendors/${v._id || v.id}`}
                            className="font-medium text-[#212121] hover:text-[#9D43D6] transition-colors"
                          >
                            {v.displayName || v.companyName || v.name || `${v.firstName || ""} ${v.lastName || ""}`.trim()}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-[#525252]">{v.companyName || "-"}</td>
                        <td className="px-4 py-3.5 text-[#525252] break-all max-w-[220px]">{v.email || "-"}</td>
                        <td className="px-4 py-3.5 text-center text-[#525252]">{v.phone || v.mobile || "-"}</td>
                        <td className="px-4 py-3.5 text-center whitespace-pre-line text-[#525252]">{v.gstTreatment || "-"}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-[#1B1B1B] tabular-nums">{currency(v.payables || 0)}</td>
                        <td className={`px-4 py-3.5 text-right font-medium tabular-nums ${(v.credits || 0) > 0 ? "text-[#1B1B1B]" : "text-[#A1A1AA]"}`}>
                          {currency(v.credits || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseVendors;



