import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Headers from "../components/Header.jsx";
import Select from "react-select";
import baseUrl from "../api/api.js";
import { CSVLink } from "react-csv";
import { Helmet } from "react-helmet";
import { FiDownload } from "react-icons/fi";
import { Loader2, Printer } from "lucide-react";
import { useSidebar } from "../hooks/useSidebar.js";
import { getActiveStores } from "../utils/storeService.js";
import { mapLocNameToWarehouse } from "../utils/warehouseMapping.js";

import AppSelect, { appSelectStyles } from "../components/AppSelect.jsx";
// Helper to format currency
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return "₹0.00";
  const num = Number(amount);
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Custom React-Select styles for clean modern UI
const customSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: "#ffffff",
    borderColor: state.isFocused ? "#9333ea" : "#d1d5db",
    borderRadius: "0.5rem",
    padding: "1px 2px",
    minHeight: "40px",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(147, 51, 234, 0.2)" : "none",
    "&:hover": {
      borderColor: "#9ca3af",
    },
    fontSize: "0.875rem",
    color: "#1f2937",
    cursor: "pointer",
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "#9333ea"
      : state.isFocused
      ? "#f3e8ff"
      : "#ffffff",
    color: state.isSelected ? "#ffffff" : "#374151",
    fontSize: "0.875rem",
    cursor: "pointer",
  }),
  menu: (provided) => ({
    ...provided,
    borderRadius: "0.5rem",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    zIndex: 50,
  }),
};

const buildStoreOptions = () => {
  const activeStores = getActiveStores() || [];
  const map = new Map();
  map.set("All Stores", { value: "All Stores", label: "All Stores" });

  activeStores.forEach((s) => {
    const val = (s.value || s.locCode || "").toString();
    const lbl = s.label || s.locName || s.name || val;
    if (val) {
      map.set(val, { value: val, label: lbl });
    }
  });

  return Array.from(map.values());
};

const normalizeStoreIdentity = (value) =>
  (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Prefer a store name carried by the authenticated user when it matches a
// known store. This prevents a stale/duplicated locCode cache entry from
// showing (and querying) another branch for the current user.
const resolveUserStore = (user, options) => {
  const userStoreNames = [user?.storeName, user?.locName, user?.username]
    .map((name) => ({ name, normalized: normalizeStoreIdentity(name) }))
    .filter(({ normalized }) => normalized);

  const matchedByName = options.find((option) => {
    const optionName = normalizeStoreIdentity(option.label);
    return userStoreNames.some(({ normalized }) => normalized === optionName);
  });

  if (matchedByName) return matchedByName;

  const userLocCode = (user?.locCode || "").toString();
  const matchedByCode = options.find((option) => option.value === userLocCode);
  if (matchedByCode) return matchedByCode;

  const fallbackName = userStoreNames[0]?.name || userLocCode;
  return fallbackName
    ? { value: userLocCode || fallbackName, label: fallbackName }
    : { value: "", label: "" };
};

const reportTypeOptions = [
  { value: "summary", label: "Inventory Summary" },
  { value: "stock-summary", label: "Stock Summary" },
  { value: "opening-stock", label: "Opening Stock Report" },
  { value: "stock-on-hand", label: "Stock On Hand Report" },
  { value: "aging", label: "Inventory Aging Report" },
];

const categoryOptions = [
  { value: "all", label: "All Categories" },
  { value: "shirt", label: "Shirt Sales" },
  { value: "shoe", label: "Shoe Sales" },
];

const InventoryReport = () => {
  const isSidebarOpen = useSidebar();
  const navigate = useNavigate();
  const [storeOptions, setStoreOptions] = useState(() => buildStoreOptions());
  const [selectedStore, setSelectedStore] = useState("All Stores");
  const [reportType, setReportType] = useState("summary");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [csvData, setCsvData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [selectedCategory, setSelectedCategory] = useState("all");

  const currentUser = JSON.parse(localStorage.getItem("rootfinuser") || "{}");
  const adminEmails = [
    "officerootments@gmail.com",
    "operationsrootments@gmail.com",
    "headoffice01@gmail.com",
  ];
  const isAdmin =
    (currentUser?.power || "").toLowerCase() === "admin" ||
    (currentUser?.power || "").toLowerCase() === "super_admin" ||
    (currentUser?.role || "").toLowerCase() === "admin" ||
    (currentUser?.role || "").toLowerCase() === "superadmin" ||
    adminEmails.some((email) => (currentUser?.email || "").toLowerCase() === email.toLowerCase()) ||
    ["858", "103"].includes(currentUser?.locCode);

  const isClusterManager = (currentUser?.role || "").toLowerCase() === "cluster_manager";
  const clusterAllowedLocCodes = currentUser?.allowedLocCodes || [];
  const canChooseStore = isAdmin || isClusterManager;
  const currentUserStore = resolveUserStore(currentUser, storeOptions);
  const reportLocCode = canChooseStore
    ? (currentUser?.locCode || "")
    : (currentUserStore.value || currentUser?.locCode || "");

  useEffect(() => {
    const opts = buildStoreOptions();
    setStoreOptions(opts);

    if (!canChooseStore) {
      const resolvedStore = resolveUserStore(currentUser, opts);
      if (resolvedStore.value) setSelectedStore(resolvedStore.value);
    } else if (isClusterManager && clusterAllowedLocCodes.length > 0 && selectedStore === "All Stores") {
      setSelectedStore(clusterAllowedLocCodes[0]);
    }
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setHasFetched(true);
    try {
      const endpoint = `api/reports/inventory/${reportType}`;

      let warehouseParam = "All Stores";
      if (!canChooseStore) {
        const rawStoreName =
          currentUserStore.label ||
          currentUser?.storeName ||
          currentUser?.locName ||
          currentUser?.username ||
          currentUser?.locCode ||
          selectedStore;
        warehouseParam = mapLocNameToWarehouse(rawStoreName) || rawStoreName;
      } else {
        if (selectedStore === "All Stores") {
          warehouseParam = "All Stores";
        } else {
          const storeOpt = storeOptions.find((s) => s.value === selectedStore);
          const rawStoreName = storeOpt?.label || selectedStore;
          warehouseParam = mapLocNameToWarehouse(rawStoreName) || rawStoreName;
        }
      }

      const params = new URLSearchParams({
        warehouse: warehouseParam,
        userId: currentUser?.email || currentUser?.userId || "",
        locCode: reportLocCode,
        userPower: currentUser?.power || "",
        userRole: currentUser?.role || "",
      });

      if (isClusterManager && clusterAllowedLocCodes.length > 0) {
        const clusterStoreLabels = clusterAllowedLocCodes
          .map((code) => {
            const opt = storeOptions.find((s) => s.value === code);
            const lbl = opt?.label || code;
            return mapLocNameToWarehouse(lbl) || lbl;
          })
          .filter(Boolean);
        if (clusterStoreLabels.length > 0) {
          params.append("allowedLocCodes", clusterStoreLabels.join(","));
        }
      }

      if (selectedMonth && reportType === "opening-stock") {
        params.append("month", selectedMonth);
      }

      if (reportType === "stock-on-hand") {
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
      }

      if (reportType === "stock-summary" && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }

      const response = await fetch(`${baseUrl.baseUrl}${endpoint}?${params}`);

      if (!response.ok) {
        const text = await response.text();
        console.error("API Error:", response.status, text);
        alert(`API Error: ${response.status} - ${text.substring(0, 100)}`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        setReportData(result.data);
        prepareCsvData(result.data, reportType);
        setCurrentPage(1);
      } else {
        alert("Failed to fetch report: " + (result.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      alert("Error fetching report: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reportType === "aging") {
      navigate("/reports/aging");
      return;
    }
    setCurrentPage(1);
    setReportData(null);
    setCsvData([]);
    setHasFetched(false);
    if (reportType !== "stock-summary") {
      setSelectedCategory("all");
    }
    fetchReport();
  }, [reportType, navigate]);

  const prepareCsvData = (data, type) => {
    let csv = [];
    if (type === "summary") {
      csv =
        data.items?.map((item) => {
          const row = {
            "Item Name": item.itemName,
            SKU: item.sku,
            Category: item.category,
            "Total Stock": item.totalStock,
          };
          if (isAdmin) {
            row["Cost"] = item.cost;
            row["Total Value"] = item.totalValue;
          }
          return row;
        }) || [];
    } else if (type === "stock-summary") {
      const corruptedStores = ["arehouse Branch", "Grooms Trivandum"];
      const filteredWarehouses =
        data.warehouses?.filter((wh) => !corruptedStores.includes(wh.warehouse)) || [];

      csv = filteredWarehouses.map((wh) => {
        const row = {
          Warehouse: wh.warehouse,
          "Total Quantity": wh.totalQuantity,
          "Item Count": wh.itemCount,
        };
        if (isAdmin) {
          row["Total Value"] = wh.totalValue;
        }
        return row;
      });
    } else if (type === "opening-stock") {
      csv =
        data.itemDetails?.map((item) => {
          const row = {
            "Item Name": item.itemName,
            SKU: item.sku || "",
            Store: item.store,
            "Opening Stock": item.openingStock,
            "Date Added": new Date(item.createdAt).toLocaleDateString("en-IN"),
            Type: item.type,
            "Group Name": item.groupName || "",
          };
          if (isAdmin) {
            row["Opening Value"] = item.openingValue;
          }
          return row;
        }) || [];
    } else if (type === "stock-on-hand") {
      csv =
        data.itemDetails?.map((item) => {
          const row = {
            "Item Name": item.itemName,
            SKU: item.sku || "",
            Category: item.category,
            Warehouse: item.warehouse,
            "Opening Stock": item.openingStock,
            "Stock In": item.stockIn,
            "Stock Out": item.stockOut,
            "Closing Stock": item.closingStock,
            "Group Name": item.itemGroupName || "",
          };
          if (isAdmin) {
            row["Cost Price"] = item.costPrice;
            row["Stock Value"] = item.stockValue;
          }
          return row;
        }) || [];
    }
    setCsvData(csv);
  };

  const sortItemsByGroup = (items) => {
    if (!items || !Array.isArray(items)) return [];
    const sortedItems = [...items];

    const extractSizeFromName = (itemName, sku) => {
      if (sku) {
        const skuSizeMatch = sku.match(/([A-Z]+)(\d+)-/);
        if (skuSizeMatch) return parseInt(skuSizeMatch[2]);
      }
      if (itemName) {
        const dashSizeMatch = itemName.match(/\s-\s(\d+)$/);
        if (dashSizeMatch) return parseInt(dashSizeMatch[1]);
        const slashSizeMatch = itemName.match(/\/(\d+)$/);
        if (slashSizeMatch) return parseInt(slashSizeMatch[1]);
        const spaceSizeMatch = itemName.match(/\s(\d+)$/);
        if (spaceSizeMatch) return parseInt(spaceSizeMatch[1]);
        const skuInNameMatch = itemName.match(/[A-Z]+-[A-Z]*(\d+)-/);
        if (skuInNameMatch) return parseInt(skuInNameMatch[1]);
      }
      return 999;
    };

    sortedItems.sort((a, b) => {
      const aGroupId = a.itemGroupId || null;
      const bGroupId = b.itemGroupId || null;

      if (aGroupId && bGroupId) {
        if (aGroupId === bGroupId) {
          const aBaseName = (a.itemName || "").replace(/\s-\s\d+$/, "").replace(/\/\d+$/, "").replace(/\s\d+$/, "").trim();
          const bBaseName = (b.itemName || "").replace(/\s-\s\d+$/, "").replace(/\/\d+$/, "").replace(/\s\d+$/, "").trim();
          if (aBaseName !== bBaseName) return aBaseName.localeCompare(bBaseName);
          return extractSizeFromName(a.itemName, a.sku) - extractSizeFromName(b.itemName, b.sku);
        }
        const aGroupName = a.itemGroupName || "";
        const bGroupName = b.itemGroupName || "";
        if (aGroupName !== bGroupName) return aGroupName.localeCompare(bGroupName);
        const aBaseName = (a.itemName || "").replace(/\s-\s\d+$/, "").replace(/\/\d+$/, "").replace(/\s\d+$/, "").trim();
        const bBaseName = (b.itemName || "").replace(/\s-\s\d+$/, "").replace(/\/\d+$/, "").replace(/\s\d+$/, "").trim();
        if (aBaseName !== bBaseName) return aBaseName.localeCompare(bBaseName);
        return extractSizeFromName(a.itemName, a.sku) - extractSizeFromName(b.itemName, b.sku);
      }

      if (aGroupId && !bGroupId) return -1;
      if (!aGroupId && bGroupId) return 1;

      const aBaseName = (a.itemName || "").replace(/\s-\s\d+$/, "").replace(/\/\d+$/, "").replace(/\s\d+$/, "").trim();
      const bBaseName = (b.itemName || "").replace(/\s-\s\d+$/, "").replace(/\/\d+$/, "").replace(/\s\d+$/, "").trim();
      if (aBaseName !== bBaseName) return aBaseName.localeCompare(bBaseName);
      return extractSizeFromName(a.itemName, a.sku) - extractSizeFromName(b.itemName, b.sku);
    });

    return sortedItems;
  };

  const getPaginatedData = (data) => {
    if (!data || !Array.isArray(data)) return [];
    const sortedData = sortItemsByGroup(data);
    if (itemsPerPage === "all") return sortedData;
    const startIndex = (currentPage - 1) * Number(itemsPerPage);
    const endIndex = startIndex + Number(itemsPerPage);
    return sortedData.slice(startIndex, endIndex);
  };

  const getTotalPages = (data) => {
    if (!data || !Array.isArray(data)) return 1;
    if (itemsPerPage === "all") return 1;
    return Math.ceil(data.length / Number(itemsPerPage));
  };

  const getFilteredWarehouses = (warehouses) => {
    if (!warehouses || !Array.isArray(warehouses)) return [];
    const corruptedStores = ["arehouse Branch", "Grooms Trivandum"];
    return warehouses.filter((wh) => !corruptedStores.includes(wh.warehouse));
  };

  const PaginationControls = ({ totalItems, data }) => {
    if (!data || data.length === 0) return null;
    const totalPages = getTotalPages(data);
    const startItem =
      totalItems > 0
        ? itemsPerPage === "all"
          ? 1
          : (currentPage - 1) * Number(itemsPerPage) + 1
        : 0;
    const endItem =
      itemsPerPage === "all" ? totalItems : Math.min(currentPage * Number(itemsPerPage), totalItems);

    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= maxVisible; i++) pages.push(i);
        } else if (currentPage >= totalPages - 2) {
          for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
        } else {
          for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
        }
      }
      return pages;
    };

    return (
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50/70 border-t border-gray-200 text-sm">
        <div className="text-gray-600 font-medium">
          Showing <span className="font-bold text-gray-900">{startItem}</span> to{" "}
          <span className="font-bold text-gray-900">{endItem}</span> of{" "}
          <span className="font-bold text-gray-900">{totalItems}</span> items
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Items per page:</span>
            <AppSelect
              value={itemsPerPage}
              onChange={(e) => {
                const val = e.target.value === "all" ? "all" : Number(e.target.value);
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </AppSelect>
          </div>

          {itemsPerPage !== "all" && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Prev
              </button>
              {getPageNumbers().map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCurrentPage(num)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    currentPage === num
                      ? "bg-[#9333ea] text-white border-[#9333ea] shadow-xs"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Inventory Report | RootFin</title>
      </Helmet>

      <div className="invoice-page-wrapper min-h-screen bg-[#FAFAFA] text-[#1B1B1B]">
        <div className="no-print">
          <Headers title={"Inventory Report"} />
        </div>

        <div
          className={`transition-all duration-300 ${
            isSidebarOpen ? "ml-[240px]" : "ml-0"
          }`}
        >
          {/* Clean Page Title Header */}
          <div className="no-print bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <h1 className="text-[18px] font-semibold text-[#1B1B1B]">
              Inventory Report
            </h1>
          </div>

          <div className="px-6 md:px-8 pt-6 pb-10 space-y-5">
            {/* Top Control & Filter Bar */}
            <div className="no-print flex flex-wrap items-end justify-between gap-4">
              {/* Left Controls: Store, Report Type, Category/Dates, Action */}
              <div className="flex flex-wrap items-end gap-3">
                {/* Store Selector */}
                <div className="rf-form-field !mb-0 min-w-[195px]">
                  <label className="rf-field-label">Store</label>
                  {canChooseStore ? (
                    <Select
                      classNamePrefix="rf-select"
                      options={
                        isClusterManager
                          ? [
                              { value: "All Stores", label: "All My Stores" },
                              ...storeOptions.filter((s) =>
                                clusterAllowedLocCodes.includes(s.value)
                              ),
                            ]
                          : storeOptions
                      }
                      value={
                        storeOptions.find((s) => s.value === selectedStore) || {
                          value: selectedStore,
                          label: selectedStore,
                        }
                      }
                      onChange={(opt) => setSelectedStore(opt.value)}
                      isSearchable
                      placeholder="Select Store..."
                      styles={appSelectStyles}
                    />
                  ) : (
                    <div className="h-[40px] flex items-center px-3.5 text-[13px] text-[#525252] bg-[#F4F4F5] border border-[#E5E5E5] rounded-[10px]">
                      {currentUserStore.label || selectedStore}
                    </div>
                  )}
                </div>

                {/* Report Type */}
                <div className="rf-form-field !mb-0 min-w-[210px]">
                  <label className="rf-field-label">Report Type</label>
                  <Select
                    classNamePrefix="rf-select"
                    options={reportTypeOptions}
                    value={reportTypeOptions.find((r) => r.value === reportType)}
                    onChange={(opt) => setReportType(opt.value)}
                    styles={appSelectStyles}
                  />
                </div>

                {/* Category Filter (Stock Summary only) */}
                {reportType === "stock-summary" && (
                  <div className="rf-form-field !mb-0 min-w-[180px]">
                    <label className="rf-field-label">Category</label>
                    <Select
                      classNamePrefix="rf-select"
                      options={categoryOptions}
                      value={categoryOptions.find((c) => c.value === selectedCategory)}
                      onChange={(opt) => setSelectedCategory(opt.value)}
                      styles={appSelectStyles}
                    />
                  </div>
                )}

                {/* Month Picker (Opening Stock only) */}
                {reportType === "opening-stock" && (
                  <div className="rf-form-field !mb-0">
                    <label className="rf-field-label">Select Month</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="rf-input !w-[172px] !h-[40px] !rounded-[10px]"
                      />
                      {selectedMonth && (
                        <button
                          type="button"
                          data-no-confirm="true"
                          onClick={() => setSelectedMonth("")}
                          className="h-[40px] px-3.5 text-[12px] font-medium text-[#1B1B1B] bg-[#EFEFF1] hover:bg-[#E4E4E7] rounded-[10px] transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Date Range Picker (Stock On Hand only) */}
                {reportType === "stock-on-hand" && (
                  <>
                    <div className="rf-form-field !mb-0">
                      <label className="rf-field-label">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rf-input !w-[162px] !h-[40px] !rounded-[10px]"
                      />
                    </div>

                    <div className="rf-form-field !mb-0">
                      <label className="rf-field-label">End Date</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="rf-input !w-[162px] !h-[40px] !rounded-[10px]"
                        />
                        <button
                          type="button"
                          data-no-confirm="true"
                          onClick={() => {
                            const today = new Date();
                            setEndDate(today.toISOString().split("T")[0]);
                          }}
                          className="h-[40px] px-3.5 text-[12px] font-medium text-[#9D43D6] bg-[#FAF5FF] hover:bg-[#F3E8FF] rounded-[10px] border border-[#E9D5FF] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Today
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Fetch Data Button */}
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={fetchReport}
                  disabled={loading}
                  className="rf-btn-primary !h-[40px] !px-6 !rounded-[10px] !bg-[#9D43D6] hover:!bg-[#8732BE] !text-[13px] !font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-[0_2px_8px_rgba(157,67,214,0.24)]"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{loading ? "Fetching..." : "Fetch Data"}</span>
                </button>
              </div>

              {/* Right Controls: Export CSV & Print PDF */}
              <div className="flex items-center gap-2.5">
                {csvData.length > 0 ? (
                  <CSVLink
                    data={csvData}
                    filename={`inventory-report-${reportType}-${new Date().toISOString().split("T")[0]}.csv`}
                    className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors no-underline cursor-pointer"
                  >
                    <span>Export CSV</span>
                    <FiDownload className="w-4 h-4 text-[#1B1B1B]" />
                  </CSVLink>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] !text-[#8A8A8A] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 cursor-not-allowed opacity-70"
                  >
                    <span>Export CSV</span>
                    <FiDownload className="w-4 h-4 text-[#8A8A8A]" />
                  </button>
                )}

                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={() => window.print()}
                  disabled={!reportData}
                  className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Print PDF</span>
                  <Printer className="w-4 h-4 text-[#1B1B1B]" />
                </button>
              </div>
            </div>

            {/* Empty State Table when No Data Fetched */}
            {!reportData && (
              <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#18181b] text-white">
                      <tr>
                        {reportType === "summary" && (
                          <>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">ITEM NAME</th>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">SKU</th>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">CATEGORY</th>
                            {isAdmin && (
                              <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">COST</th>
                            )}
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">TOTAL STOCK</th>
                            {isAdmin && (
                              <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">TOTAL VALUE</th>
                            )}
                          </>
                        )}
                        {reportType === "stock-summary" && (
                          <>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">WAREHOUSE</th>
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">TOTAL QUANTITY</th>
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">TOTAL VALUE</th>
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">ITEM COUNT</th>
                          </>
                        )}
                        {reportType === "opening-stock" && (
                          <>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">ITEM NAME</th>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">SKU</th>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">STORE</th>
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">OPENING STOCK</th>
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">OPENING VALUE</th>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">DATE ADDED</th>
                          </>
                        )}
                        {reportType === "stock-on-hand" && (
                          <>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">ITEM NAME</th>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">SKU</th>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">CATEGORY</th>
                            <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">WAREHOUSE</th>
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">OPENING</th>
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">IN</th>
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">OUT</th>
                            <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">CLOSING</th>
                            {isAdmin && (
                              <>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">COST</th>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">STOCK VALUE</th>
                              </>
                            )}
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={isAdmin ? 10 : 8} className="py-24 text-center">
                          <p className="text-sm font-medium text-gray-500">
                            {hasFetched ? "No data found for the selected criteria" : "Select options and click Generate Report"}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Monitor stock levels, aging, and warehouse distribution
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Results Display when Data is Available */}
            {reportData && (
              <div className="space-y-6">
                {/* 1. INVENTORY SUMMARY */}
                {reportType === "summary" && (
                  <>
                    <div className={`grid grid-cols-1 ${isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-4`}>
                      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Total Items</div>
                        <div className="text-3xl font-bold text-gray-900">{reportData.summary?.totalItems || 0}</div>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Total Quantity</div>
                        <div className="text-3xl font-bold text-[#9333ea]">{reportData.summary?.totalQuantity || 0}</div>
                      </div>
                      {isAdmin && (
                        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Total Stock Value</div>
                          <div className="text-3xl font-bold text-emerald-600">{formatCurrency(reportData.summary?.totalStockValue || 0)}</div>
                        </div>
                      )}
                    </div>

                    <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-[#18181b] text-white">
                            <tr>
                              <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">ITEM NAME</th>
                              <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">SKU</th>
                              <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">CATEGORY</th>
                              {isAdmin && (
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">COST</th>
                              )}
                              <th className={`py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase ${isAdmin ? "border-r border-zinc-700/60" : ""}`}>TOTAL STOCK</th>
                              {isAdmin && (
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">TOTAL VALUE</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white text-sm">
                            {getPaginatedData(reportData.items)?.map((item, idx) => (
                              <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-gray-900 border-r border-gray-200">{item.itemName}</td>
                                <td className="py-3 px-4 font-mono text-xs text-gray-600 border-r border-gray-200">{item.sku}</td>
                                <td className="py-3 px-4 border-r border-gray-200">
                                  <span className="inline-block px-3 py-0.5 text-xs font-semibold text-[#9333ea] bg-[#f3e8ff] rounded-full">
                                    {item.category}
                                  </span>
                                </td>
                                {isAdmin && (
                                  <td className="py-3 px-4 text-right text-gray-700 border-r border-gray-200">{formatCurrency(item.cost)}</td>
                                )}
                                <td className={`py-3 px-4 text-right font-bold text-[#9333ea] ${isAdmin ? "border-r border-gray-200" : ""}`}>{item.totalStock}</td>
                                {isAdmin && (
                                  <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(item.totalValue)}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <PaginationControls totalItems={reportData.items?.length || 0} data={reportData.items} />
                    </div>
                  </>
                )}

                {/* 2. STOCK SUMMARY BY WAREHOUSE */}
                {reportType === "stock-summary" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Total Warehouses</div>
                        <div className="text-3xl font-bold text-gray-900">{reportData.summary?.totalWarehouses || 0}</div>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Grand Total Quantity</div>
                        <div className="text-3xl font-bold text-[#9333ea]">{reportData.summary?.grandTotalQuantity || 0}</div>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Grand Total Value</div>
                        <div className="text-3xl font-bold text-emerald-600">{formatCurrency(reportData.summary?.grandTotalValue || 0)}</div>
                      </div>
                    </div>

                    <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-[#18181b] text-white">
                            <tr>
                              <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">WAREHOUSE</th>
                              <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">TOTAL QUANTITY</th>
                              <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">TOTAL VALUE</th>
                              <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">ITEM COUNT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white text-sm">
                            {getPaginatedData(getFilteredWarehouses(reportData.warehouses))?.map((wh, idx) => (
                              <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                                <td className="py-3 px-4 font-semibold text-gray-900 border-r border-gray-200">{wh.warehouse}</td>
                                <td className="py-3 px-4 text-right font-bold text-[#9333ea] border-r border-gray-200">{wh.totalQuantity}</td>
                                <td className="py-3 px-4 text-right font-bold text-emerald-600 border-r border-gray-200">{formatCurrency(wh.totalValue)}</td>
                                <td className="py-3 px-4 text-right text-gray-700">{wh.itemCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <PaginationControls
                        totalItems={getFilteredWarehouses(reportData.warehouses)?.length || 0}
                        data={getFilteredWarehouses(reportData.warehouses)}
                      />
                    </div>
                  </>
                )}

                {/* 3. OPENING STOCK REPORT */}
                {reportType === "opening-stock" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Total Opening Stock</div>
                        <div className="text-3xl font-bold text-[#9333ea]">{reportData.summary?.totalOpeningStock || 0}</div>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Total Opening Value</div>
                        <div className="text-3xl font-bold text-emerald-600">{formatCurrency(reportData.summary?.totalOpeningValue || 0)}</div>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Total Items</div>
                        <div className="text-3xl font-bold text-gray-900">{reportData.summary?.totalItems || 0}</div>
                      </div>
                      <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-purple-700 mb-1.5">Period</div>
                        <div className="text-xl font-bold text-purple-900">{reportData.summary?.period || "All time"}</div>
                      </div>
                    </div>

                    {/* Item Details */}
                    <div className="space-y-3">
                      <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                        Opening Stock Items Added {reportData?.summary?.period && reportData.summary.period !== "All time" && `(${reportData.summary.period})`}
                      </h3>
                      <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[#18181b] text-white">
                              <tr>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">ITEM NAME</th>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">SKU</th>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">STORE</th>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">OPENING STOCK</th>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">OPENING VALUE</th>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase">DATE ADDED</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white text-sm">
                              {reportData.itemDetails?.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-12 text-center text-gray-500">
                                    No opening stock items found in the selected period.
                                  </td>
                                </tr>
                              ) : (
                                getPaginatedData(reportData.itemDetails || []).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                                    <td className="py-3 px-4 font-semibold text-gray-900 border-r border-gray-200">
                                      {item.itemName}
                                      {item.type === "grouped" && item.groupName && (
                                        <span className="block text-xs font-normal text-gray-500">Group: {item.groupName}</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-xs text-gray-600 border-r border-gray-200">{item.sku || "-"}</td>
                                    <td className="py-3 px-4 text-gray-700 border-r border-gray-200">{item.store}</td>
                                    <td className="py-3 px-4 text-right font-bold text-[#9333ea] border-r border-gray-200">{item.openingStock}</td>
                                    <td className="py-3 px-4 text-right font-bold text-emerald-600 border-r border-gray-200">{formatCurrency(item.openingValue)}</td>
                                    <td className="py-3 px-4 text-gray-600">{new Date(item.createdAt).toLocaleDateString("en-IN")}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <PaginationControls totalItems={reportData.itemDetails?.length || 0} data={reportData.itemDetails || []} />
                      </div>
                    </div>

                    {/* Store-wise Opening Stock Summary */}
                    <div className="space-y-3">
                      <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                        Store-wise Opening Stock Summary
                      </h3>
                      <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[#18181b] text-white">
                              <tr>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">STORE</th>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">TOTAL OPENING STOCK</th>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">TOTAL OPENING VALUE</th>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">ITEM COUNT</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white text-sm">
                              {reportData.storeReport?.map((store, idx) => (
                                <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                                  <td className="py-3 px-4 font-semibold text-gray-900 border-r border-gray-200">{store.store}</td>
                                  <td className="py-3 px-4 text-right font-bold text-[#9333ea] border-r border-gray-200">{store.totalStock}</td>
                                  <td className="py-3 px-4 text-right font-bold text-emerald-600 border-r border-gray-200">{formatCurrency(store.totalValue)}</td>
                                  <td className="py-3 px-4 text-right text-gray-700">{store.itemCount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 4. STOCK ON HAND REPORT */}
                {reportType === "stock-on-hand" && (
                  <>
                    <div className={`grid grid-cols-2 sm:grid-cols-3 ${isAdmin ? "lg:grid-cols-6" : "lg:grid-cols-5"} gap-4`}>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Opening Stock</div>
                        <div className="text-2xl font-bold text-gray-800">{reportData.summary?.totalOpeningStock || 0}</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">Stock In</div>
                        <div className="text-2xl font-bold text-emerald-600">{reportData.summary?.totalStockIn || 0}</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-red-500 mb-1">Stock Out</div>
                        <div className="text-2xl font-bold text-red-500">{reportData.summary?.totalStockOut || 0}</div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#9333ea] mb-1">Closing Stock</div>
                        <div className="text-2xl font-bold text-[#9333ea]">{reportData.summary?.totalClosingStock || 0}</div>
                      </div>
                      {isAdmin && (
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">Stock Value</div>
                          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(reportData.summary?.totalStockValue || 0)}</div>
                        </div>
                      )}
                      <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold uppercase tracking-wider text-purple-700 mb-1">Period</div>
                        <div className="text-sm font-bold text-purple-900 truncate">{reportData.summary?.period || "Current"}</div>
                      </div>
                    </div>

                    {/* Stock Details */}
                    <div className="space-y-3">
                      <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                        Stock On Hand Details {reportData?.summary?.period && reportData.summary.period !== "Current Stock" && `(${reportData.summary.period})`}
                      </h3>
                      <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[#18181b] text-white">
                              <tr>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">ITEM NAME</th>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">SKU</th>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">CATEGORY</th>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">WAREHOUSE</th>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">OPENING</th>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">IN</th>
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">OUT</th>
                                <th className={`py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase ${isAdmin ? "border-r border-zinc-700/60" : ""}`}>CLOSING</th>
                                {isAdmin && (
                                  <>
                                    <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">COST</th>
                                    <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">STOCK VALUE</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white text-sm">
                              {reportData.itemDetails?.length === 0 ? (
                                <tr>
                                  <td colSpan={isAdmin ? 10 : 8} className="py-12 text-center text-gray-500">
                                    No items found for the selected criteria.
                                  </td>
                                </tr>
                              ) : (
                                getPaginatedData(reportData.itemDetails || []).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                                    <td className="py-3 px-4 font-semibold text-gray-900 border-r border-gray-200">
                                      {item.itemName}
                                      {item.isFromGroup && item.itemGroupName && (
                                        <span className="block text-xs font-normal text-gray-500">Group: {item.itemGroupName}</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-xs text-gray-600 border-r border-gray-200">{item.sku || "-"}</td>
                                    <td className="py-3 px-4 border-r border-gray-200">
                                      <span className="inline-block px-2.5 py-0.5 text-xs font-semibold text-[#9333ea] bg-[#f3e8ff] rounded-full">
                                        {item.category || "General"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-gray-700 border-r border-gray-200">{item.warehouse}</td>
                                    <td className="py-3 px-4 text-right text-gray-600 border-r border-gray-200">{item.openingStock || 0}</td>
                                    <td className="py-3 px-4 text-right font-bold text-emerald-600 border-r border-gray-200">{item.stockIn || 0}</td>
                                    <td className="py-3 px-4 text-right font-bold text-red-500 border-r border-gray-200">{item.stockOut || 0}</td>
                                    <td className={`py-3 px-4 text-right font-bold text-[#9333ea] ${isAdmin ? "border-r border-gray-200" : ""}`}>{item.closingStock || 0}</td>
                                    {isAdmin && (
                                      <>
                                        <td className="py-3 px-4 text-right text-gray-700 border-r border-gray-200">{formatCurrency(item.costPrice || 0)}</td>
                                        <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(item.stockValue || 0)}</td>
                                      </>
                                    )}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <PaginationControls totalItems={reportData.itemDetails?.length || 0} data={reportData.itemDetails || []} />
                      </div>
                    </div>

                    {/* Warehouse-wise Stock Summary */}
                    <div className="space-y-3">
                      <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                        Warehouse-wise Stock Summary
                      </h3>
                      <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[#18181b] text-white">
                              <tr>
                                <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">WAREHOUSE</th>
                                <th className={`py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase ${isAdmin ? "border-r border-zinc-700/60" : ""}`}>TOTAL STOCK</th>
                                {isAdmin && (
                                  <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase border-r border-zinc-700/60">TOTAL VALUE</th>
                                )}
                                <th className="py-3.5 px-4 text-right text-[11px] font-bold tracking-wider text-white uppercase">ITEM COUNT</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white text-sm">
                              {reportData.warehouseReport?.map((wh, idx) => (
                                <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                                  <td className="py-3 px-4 font-semibold text-gray-900 border-r border-gray-200">{wh.warehouse}</td>
                                  <td className={`py-3 px-4 text-right font-bold text-[#9333ea] ${isAdmin ? "border-r border-gray-200" : ""}`}>{wh.totalStock}</td>
                                  {isAdmin && (
                                    <td className="py-3 px-4 text-right font-bold text-emerald-600 border-r border-gray-200">{formatCurrency(wh.totalValue)}</td>
                                  )}
                                  <td className="py-3 px-4 text-right text-gray-700">{wh.totalItems}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default InventoryReport;
