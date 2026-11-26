import React, { useEffect, useMemo, useState } from "react";
import Headers from "../components/Header.jsx";
import Select from "react-select";
import baseUrl from "../api/api.js";
import { CSVLink } from "react-csv";
import { Helmet } from "react-helmet";
import { FiDownload } from "react-icons/fi";
import {
  Loader2,
  Printer,
  Clock,
  Package,
  AlertTriangle,
  Layers,
  Search,
  RefreshCw,
  Folder,
  ShoppingCart,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Tag,
  ListFilter,
  LayoutList,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  CalendarClock,
  Gem,
} from "lucide-react";
import { useSidebar } from "../hooks/useSidebar.js";
import { useActiveStores } from "../utils/storeService.js";
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

const categoryOptions = [
  { value: "all", label: "All Categories" },
  { value: "shirt", label: "Shirt Sales" },
  { value: "shoe", label: "Shoe Sales" },
  { value: "other", label: "Other Goods" },
];

const bracketOptions = [
  { value: "all", label: "All Age Brackets" },
  { value: "0_30", label: "0 - 30 Days" },
  { value: "31_60", label: "31 - 60 Days" },
  { value: "61_90", label: "61 - 90 Days" },
  { value: "90_plus", label: "90+ Days" },
  { value: "91_120", label: "91 - 120 Days" },
  { value: "120_plus", label: "120+ Days" },
];

const quickBracketTabs = [
  { value: "0_30", label: "0 - 30 Days" },
  { value: "31_60", label: "31 - 60 Days" },
  { value: "61_90", label: "61 - 90 Days" },
  { value: "90_plus", label: "90+ Days" },
];

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const formatVerboseDate = (isoDate) => {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const salesStatusOptions = [
  { value: "all", label: "All Items (Sold & Unsold)" },
  { value: "sold", label: "Sold Items Only (Has Sales)" },
  { value: "unsold", label: "Unsold Items Only (0 Sales)" },
];

const normalizeStoreIdentity = (value) =>
  (value || "").toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeWarehouseIdentity = (value) =>
  normalizeStoreIdentity(mapLocNameToWarehouse(value) || value);

const isSameWarehouse = (left, right) => {
  const normalizedLeft = normalizeWarehouseIdentity(left);
  const normalizedRight = normalizeWarehouseIdentity(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const InventoryAgingReport = () => {
  const isSidebarOpen = useSidebar();
  const { stores: activeStores } = useActiveStores();
  const storeOptions = [
    { value: "All Stores", label: "All Stores" },
    ...activeStores.map((s) => ({ value: s.locName, label: s.locName })),
  ];
  const [selectedStore, setSelectedStore] = useState("All Stores");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedBracket, setSelectedBracket] = useState("all");
  const [selectedSalesStatus, setSelectedSalesStatus] = useState("all");
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("age_desc"); // age_desc, age_asc, value_desc, sales_desc, name_asc
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hideZeroStock, setHideZeroStock] = useState(false);
  const [groupByBracketView, setGroupByBracketView] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState("50");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [draftStore, setDraftStore] = useState("All Stores");
  const [draftGroup, setDraftGroup] = useState("all");
  const [draftSalesStatus, setDraftSalesStatus] = useState("all");
  const [draftBracket, setDraftBracket] = useState("all");
  const [draftCategory, setDraftCategory] = useState("all");
  const [draftAsOfDate, setDraftAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);

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
  const isMainAdmin = isAdmin;
  const currentUserEmail = (currentUser?.email || "").toLowerCase();
  const userStoreIdentities = [
    currentUser?.storeName,
    currentUser?.locName,
    currentUser?.username,
    currentUserEmail.split("@")[0],
  ]
    .map(normalizeStoreIdentity)
    .filter(Boolean);
  const userStoreByName = activeStores.find((store) =>
    userStoreIdentities.includes(normalizeStoreIdentity(store.locName))
  );
  const userStoreByCode = activeStores.find(
    (store) => store.locCode === (currentUser?.locCode || "").toString()
  );
  const resolvedUserStore = userStoreByName || userStoreByCode || null;
  const isDedicatedStoreAccount = Boolean(
    resolvedUserStore &&
    !["858", "103"].includes(resolvedUserStore.locCode) &&
    !adminEmails.includes(currentUserEmail)
  );
  const canChooseStore = (isMainAdmin && !isDedicatedStoreAccount) || isClusterManager;

  useEffect(() => {
    if (!canChooseStore) {
      if (resolvedUserStore) {
        setSelectedStore(resolvedUserStore.locName);
      } else if (currentUser?.storeName || currentUser?.locName) {
        setSelectedStore(currentUser.storeName || currentUser.locName);
      } else if (currentUser?.locCode === "155") {
        setSelectedStore("Brides Berry");
      } else if (currentUser?.locCode === "718") {
        setSelectedStore("MG Road");
      } else {
        setSelectedStore("Warehouse");
      }
    }
  }, [activeStores, canChooseStore, resolvedUserStore]);

  // Compute dynamic group options from backend and loaded items
  const groupOptions = useMemo(() => {
    const opts = [
      { value: "all", label: "All Groups" },
      { value: "ungrouped", label: "Standalone / No Group" },
    ];
    const set = new Set();
    (reportData?.groups || []).forEach((g) => {
      if (g && typeof g === "string") set.add(g.trim());
    });
    (reportData?.items || []).forEach((it) => {
      if (it.groupName && typeof it.groupName === "string") set.add(it.groupName.trim());
    });
    Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .forEach((g) => {
        opts.push({ value: g, label: g });
      });
    return opts;
  }, [reportData]);

  const fetchReport = async () => {
    setLoading(true);
    setHasFetched(true);
    try {
      const warehouseParam = selectedStore || "All Stores";
      const selectedStoreRecord = activeStores.find((store) =>
        isSameWarehouse(store.locName, warehouseParam)
      );
      const reportLocCode = !canChooseStore
        ? (resolvedUserStore?.locCode || selectedStoreRecord?.locCode || currentUser?.locCode || "")
        : (selectedStoreRecord?.locCode || currentUser?.locCode || "");

      const params = new URLSearchParams({
        warehouse: warehouseParam,
        locCode: reportLocCode,
        userId: currentUser?.email || currentUser?._id || "",
        userPower: currentUser?.power || "",
        userRole: currentUser?.role || "",
        category: selectedCategory,
        group: selectedGroup,
        salesStatus: selectedSalesStatus,
        bracket: selectedBracket === "90_plus" ? "all" : selectedBracket,
        asOfDate: asOfDate,
      });

      if (isClusterManager && clusterAllowedLocCodes.length > 0) {
        params.append("allowedLocCodes", clusterAllowedLocCodes.join(","));
      }

      const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
      const response = await fetch(`${API_URL}/api/reports/inventory/aging?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch inventory aging report");
      const result = await response.json();

      if (result.success && result.data) {
        let items = result.data.items || [];

        // Never allow another warehouse's rows into a store-scoped report,
        // even if a stale backend process or old locCode returns extra data.
        if (warehouseParam !== "All Stores") {
          items = items.filter((item) => isSameWarehouse(item.warehouse, warehouseParam));

          // Reconcile the aging rows with the same live stock source used by
          // the item detail page. This also handles legacy duplicate names
          // such as "BridesBerry" and "Brides Berry" without picking a stale 0 row.
          try {
            const stockWarehouse = mapLocNameToWarehouse(warehouseParam) || warehouseParam;
            const stockParams = new URLSearchParams({
              page: "1",
              limit: "10000",
              warehouse: stockWarehouse,
            });
            const stockResponse = await fetch(
              `${API_URL}/api/shoe-sales/items?${stockParams.toString()}`,
              { cache: "no-store" }
            );

            if (stockResponse.ok) {
              const stockPayload = await stockResponse.json();
              const liveItems = Array.isArray(stockPayload)
                ? stockPayload
                : (stockPayload.items || []);
              const liveById = new Map();
              const liveBySku = new Map();

              liveItems.forEach((liveItem) => {
                const liveId = (liveItem?._id || liveItem?.id || "").toString();
                const liveSku = (liveItem?.sku || "").toString().trim().toLowerCase();
                if (liveId) liveById.set(liveId, liveItem);
                if (liveSku) liveBySku.set(liveSku, liveItem);
              });

              items = items.map((agingItem) => {
                const agingId = (agingItem.itemId || agingItem._id || "").toString();
                const agingSku = (agingItem.sku || "").toString().trim().toLowerCase();
                const liveItem = liveById.get(agingId) || liveBySku.get(agingSku);
                if (!liveItem) return agingItem;

                const matchingStocks = (liveItem.warehouseStocks || []).filter((stock) =>
                  isSameWarehouse(stock.warehouse, warehouseParam)
                );
                const liveQuantity = matchingStocks.length > 0
                  ? matchingStocks.reduce(
                      (sum, stock) => sum + (Number(stock.stockOnHand) || 0),
                      0
                    )
                  : (Number(liveItem.stockOnHand ?? liveItem.stock) || 0);

                return {
                  ...agingItem,
                  stockOnHand: liveQuantity,
                  stockValue: liveQuantity * (Number(agingItem.costPrice) || 0),
                };
              });
            }
          } catch (stockError) {
            console.warn("Unable to reconcile live item stock for aging report", stockError);
          }
        }

        let brackets = result.data.brackets || null;
        let summary = result.data.summary || null;
        let groups = result.data.groups || [];

        // Fallback calculation if summary is missing
        if (!summary) {
          const totalStock = items.reduce((s, i) => s + (i.stockOnHand || 0), 0);
          const totalVal = items.reduce((s, i) => s + (i.stockValue || 0), 0);
          const totalSold = items.reduce((s, i) => s + (i.soldQuantity || 0), 0);
          const totalSoldVal = items.reduce((s, i) => s + (i.soldValue || 0), 0);
          const unsoldCnt = items.filter((i) => (i.soldQuantity || 0) === 0).length;
          const soldCnt = items.filter((i) => (i.soldQuantity || 0) > 0).length;

          summary = {
            totalItems: items.length,
            totalStock: totalStock,
            totalValue: totalVal,
            totalSoldQuantity: totalSold,
            totalSoldValue: totalSoldVal,
            totalUnsoldItems: unsoldCnt,
            totalSoldItems: soldCnt,
            averageAgeDays:
              totalStock > 0
                ? Math.round(items.reduce((s, i) => s + i.ageInDays * i.stockOnHand, 0) / totalStock)
                : 0,
            criticalAgedValue: items.filter((i) => i.ageInDays > 90).reduce((s, i) => s + i.stockValue, 0),
            criticalAgedStock: items.filter((i) => i.ageInDays > 90).reduce((s, i) => s + i.stockOnHand, 0),
            warehouse: selectedStore || "All Stores",
          };
        }

        setReportData({
          summary,
          brackets,
          groups,
          items,
        });
      } else {
        setReportData(null);
      }
    } catch (error) {
      console.error("Error fetching inventory aging report:", error);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedStore, selectedCategory, selectedGroup, selectedSalesStatus, selectedBracket, asOfDate]);

  // Filter and sort items client-side for immediate responsiveness
  const processedItems = useMemo(() => {
    if (!reportData?.items) return [];
    let list = [...reportData.items];

    // Filter zero stock if toggle enabled
    if (hideZeroStock) {
      list = list.filter((item) => (item.stockOnHand || 0) > 0);
    }

    // Filter by Group
    if (selectedGroup !== "all") {
      if (selectedGroup === "ungrouped") {
        list = list.filter((item) => !item.groupName || item.groupName === "Standalone");
      } else {
        list = list.filter((item) => (item.groupName || "").toLowerCase() === selectedGroup.toLowerCase());
      }
    }

    // Filter by Age Bracket
    if (selectedBracket !== "all") {
      if (selectedBracket === "90_plus") {
        list = list.filter((item) => (item.ageInDays || 0) > 90);
      } else {
        list = list.filter((item) => item.ageBracket === selectedBracket);
      }
    }

    // Filter by Sales Status (Sold vs Unsold)
    if (selectedSalesStatus === "sold") {
      list = list.filter((item) => (item.soldQuantity || 0) > 0);
    } else if (selectedSalesStatus === "unsold") {
      list = list.filter((item) => (item.soldQuantity || 0) === 0);
    }

    // Search query filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.itemName?.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.groupName?.toLowerCase().includes(q) ||
          item.warehouse?.toLowerCase().includes(q) ||
          item.inwardSource?.toLowerCase().includes(q) ||
          item.bracketLabel?.toLowerCase().includes(q)
      );
    }

    // Sort items (Note: "Highest quantity" has been removed per requirement 1)
    list.sort((a, b) => {
      if (sortBy === "age_desc") return (b.ageInDays || 0) - (a.ageInDays || 0);
      if (sortBy === "age_asc") return (a.ageInDays || 0) - (b.ageInDays || 0);
      if (sortBy === "value_desc") return (b.stockValue || 0) - (a.stockValue || 0);
      if (sortBy === "sales_desc") return (b.soldQuantity || 0) - (a.soldQuantity || 0);
      if (sortBy === "name_asc") return (a.itemName || "").localeCompare(b.itemName || "");
      return 0;
    });

    return list;
  }, [reportData, selectedGroup, selectedBracket, selectedSalesStatus, hideZeroStock, searchQuery, sortBy]);

  // Grouped items by bracket for "Group by Age Bracket" view
  const groupedByBracketData = useMemo(() => {
    if (!groupByBracketView) return null;
    const bracketOrder = [
      { key: "0_30", label: "0 - 30 Days (Fresh Stock)", color: "emerald", border: "border-emerald-200", bg: "bg-emerald-50/60" },
      { key: "31_60", label: "31 - 60 Days (Normal)", color: "blue", border: "border-blue-200", bg: "bg-blue-50/60" },
      { key: "61_90", label: "61 - 90 Days (Slow Moving)", color: "amber", border: "border-amber-200", bg: "bg-amber-50/60" },
      { key: "91_120", label: "91 - 120 Days (Attention Needed)", color: "orange", border: "border-orange-200", bg: "bg-orange-50/60" },
      { key: "120_plus", label: "120+ Days (Stagnant Stock)", color: "red", border: "border-red-200", bg: "bg-red-50/60" },
    ];

    return bracketOrder.map((grp) => {
      const itemsInBracket = processedItems.filter((it) => it.ageBracket === grp.key);
      const totalStock = itemsInBracket.reduce((sum, it) => sum + (it.stockOnHand || 0), 0);
      const totalVal = itemsInBracket.reduce((sum, it) => sum + (it.stockValue || 0), 0);
      const totalSold = itemsInBracket.reduce((sum, it) => sum + (it.soldQuantity || 0), 0);
      return {
        ...grp,
        items: itemsInBracket,
        totalStock,
        totalVal,
        totalSold,
      };
    }).filter((grp) => {
      if (selectedBracket === "all") return true;
      if (selectedBracket === "90_plus") return grp.key === "91_120" || grp.key === "120_plus";
      return grp.key === selectedBracket;
    });
  }, [processedItems, groupByBracketView, selectedBracket]);

  // Pagination
  const paginatedItems = useMemo(() => {
    if (groupByBracketView || itemsPerPage === "all") return processedItems;
    const perPage = parseInt(itemsPerPage, 10);
    const start = (currentPage - 1) * perPage;
    return processedItems.slice(start, start + perPage);
  }, [processedItems, currentPage, itemsPerPage, groupByBracketView]);

  const totalPages = useMemo(() => {
    if (groupByBracketView || itemsPerPage === "all") return 1;
    return Math.ceil(processedItems.length / parseInt(itemsPerPage, 10)) || 1;
  }, [processedItems, itemsPerPage, groupByBracketView]);

  // CSV Data preparation including Group, Sales Status, and Sold info
  const csvData = useMemo(() => {
    if (!processedItems || processedItems.length === 0) return [];
    return processedItems.map((item, index) => {
      const row = {
        "Sl No": index + 1,
        "Item Name": item.itemName || "",
        "Group Name": item.groupName || "Standalone",
        "SKU": item.sku || "",
        "Size": item.size || "-",
        "Category": item.category || "",
        "Warehouse": item.warehouse || "",
        "Sales Status": (item.soldQuantity || 0) > 0 ? "Sold" : "Unsold",
        "Sold Quantity (pcs)": item.soldQuantity || 0,
        "Current Stock (pcs)": item.stockOnHand || 0,
      };
      if (isAdmin) {
        row["Sold Value (₹)"] = item.soldValue || 0;
        row["Cost Price (₹)"] = item.costPrice || 0;
        row["Stock Valuation (₹)"] = item.stockValue || 0;
      }
      row["Inward Date"] = item.inwardDate || "";
      row["Inward Source"] = item.inwardSource || "";
      row["Last Sold Date"] = item.lastSaleDate || "-";
      row["Age (Days)"] = item.ageInDays || 0;
      row["Age Bracket"] = item.bracketLabel || "";
      return row;
    });
  }, [processedItems, isAdmin]);

  // Recalculate every visible total from the already store-scoped rows. This
  // keeps KPIs and bracket cards aligned with Store, Group, Sales and Age filters.
  const summary = useMemo(() => {
    if (!reportData) return null;

    const totalStock = processedItems.reduce((sum, item) => sum + (item.stockOnHand || 0), 0);
    const totalValue = processedItems.reduce((sum, item) => sum + (item.stockValue || 0), 0);
    const totalSoldQuantity = processedItems.reduce((sum, item) => sum + (item.soldQuantity || 0), 0);
    const totalSoldValue = processedItems.reduce((sum, item) => sum + (item.soldValue || 0), 0);
    const totalUnsoldItems = processedItems.filter((item) => (item.soldQuantity || 0) === 0).length;
    const totalSoldItems = processedItems.length - totalUnsoldItems;
    const weightedAge = processedItems.reduce(
      (sum, item) => sum + ((item.ageInDays || 0) * (item.stockOnHand || 0)),
      0
    );
    const criticalItems = processedItems.filter((item) => (item.ageInDays || 0) > 90);

    return {
      ...(reportData.summary || {}),
      totalItems: processedItems.length,
      totalStock,
      totalValue,
      totalSoldQuantity,
      totalSoldValue,
      totalSoldItems,
      totalUnsoldItems,
      averageAgeDays: totalStock > 0 ? Math.round(weightedAge / totalStock) : 0,
      criticalAgedValue: criticalItems.reduce((sum, item) => sum + (item.stockValue || 0), 0),
      criticalAgedStock: criticalItems.reduce((sum, item) => sum + (item.stockOnHand || 0), 0),
      warehouse: selectedStore,
    };
  }, [reportData, processedItems, selectedStore]);

  const brackets = useMemo(() => {
    if (!reportData) return null;

    const result = {
      "0_30": { bracket: "0_30", label: "0 - 30 Days", count: 0, stock: 0, value: 0, soldQty: 0, badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      "31_60": { bracket: "31_60", label: "31 - 60 Days", count: 0, stock: 0, value: 0, soldQty: 0, badgeBg: "bg-blue-50 text-blue-700 border-blue-200" },
      "61_90": { bracket: "61_90", label: "61 - 90 Days", count: 0, stock: 0, value: 0, soldQty: 0, badgeBg: "bg-amber-50 text-amber-700 border-amber-200" },
      "91_120": { bracket: "91_120", label: "91 - 120 Days", count: 0, stock: 0, value: 0, soldQty: 0, badgeBg: "bg-orange-50 text-orange-700 border-orange-200" },
      "120_plus": { bracket: "120_plus", label: "120+ Days", count: 0, stock: 0, value: 0, soldQty: 0, badgeBg: "bg-red-50 text-red-700 border-red-200" },
    };

    processedItems.forEach((item) => {
      const target = result[item.ageBracket];
      if (!target) return;
      target.count += 1;
      target.stock += item.stockOnHand || 0;
      target.value += item.stockValue || 0;
      target.soldQty += item.soldQuantity || 0;
    });

    return result;
  }, [reportData, processedItems]);

  const openFiltersPanel = () => {
    setDraftStore(selectedStore);
    setDraftGroup(selectedGroup);
    setDraftSalesStatus(selectedSalesStatus);
    setDraftBracket(selectedBracket);
    setDraftCategory(selectedCategory);
    setDraftAsOfDate(asOfDate);
    setFiltersExpanded(true);
  };

  const handleToggleFilters = () => {
    if (filtersExpanded) {
      setFiltersExpanded(false);
    } else {
      openFiltersPanel();
    }
  };

  const handleApplyFilters = () => {
    setSelectedStore(draftStore);
    setSelectedGroup(draftGroup);
    setSelectedSalesStatus(draftSalesStatus);
    setSelectedBracket(draftBracket);
    setSelectedCategory(draftCategory);
    setAsOfDate(draftAsOfDate);
    setCurrentPage(1);
    setFiltersExpanded(false);
  };

  const handleResetFilters = () => {
    const defaultStore = canChooseStore ? "All Stores" : selectedStore;
    const today = new Date().toISOString().split("T")[0];
    setSelectedStore(defaultStore);
    setSelectedGroup("all");
    setSelectedSalesStatus("all");
    setSelectedBracket("all");
    setSelectedCategory("all");
    setAsOfDate(today);
    setSearchQuery("");
    setDraftStore(defaultStore);
    setDraftGroup("all");
    setDraftSalesStatus("all");
    setDraftBracket("all");
    setDraftCategory("all");
    setDraftAsOfDate(today);
    setCurrentPage(1);
  };

  const activeGroupLabel =
    groupOptions.find((opt) => opt.value === selectedGroup)?.label || "All Groups";
  const activeBracketLabel =
    bracketOptions.find((opt) => opt.value === selectedBracket)?.label || "All Age Brackets";
  const activeCategoryLabel =
    categoryOptions.find((opt) => opt.value === selectedCategory)?.label || "All Categories";
  const activeSalesLabel =
    salesStatusOptions.find((opt) => opt.value === selectedSalesStatus)?.label || "All Items";

  return (
    <>
      <Helmet>
        <title>Inventory Aging Report | RootFin</title>
      </Helmet>
      <Headers title={"Inventory Aging Report"} />

      <div
        className={`invoice-page-wrapper transition-all duration-300 bg-[#FAFAFA] min-h-screen text-[#1B1B1B] ${
          isSidebarOpen ? "ml-[240px]" : "ml-0"
        }`}
      >
        {/* Clean Page Title Header */}
        <div className="no-print bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-semibold text-[#1B1B1B] leading-snug">
              Inventory Aging Report
            </h1>
            <p className="text-[12px] text-[#8A8A8A] mt-0.5">
              Analyze product stock aging, item groups, sales velocity, and unsold stagnant inventory.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {csvData.length > 0 && (
              <CSVLink
                data={csvData}
                filename={`inventory-aging-report-${asOfDate}.csv`}
                className="rf-btn-cancel !h-[38px] !px-4 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors no-underline cursor-pointer"
              >
                <span>Export CSV</span>
                <FiDownload size={15} className="text-[#1B1B1B]" />
              </CSVLink>
            )}
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => window.print()}
              className="rf-btn-cancel !h-[38px] !px-4 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Print</span>
              <Printer size={15} className="text-[#1B1B1B]" />
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={fetchReport}
              disabled={loading}
              title="Refresh report"
              className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#EFEFF1] hover:bg-[#E4E4E7] text-[#1B1B1B] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-[#9D43D6]" : "text-[#1B1B1B]"} />
            </button>
          </div>
        </div>

        <div className="px-6 md:px-8 pt-5 pb-10 space-y-5">

          {/* Collapsible Filter Card */}
          <div className="bg-white rounded-[16px] border border-[#EAEAEA] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            {/* Top Row: Filters Toggle + Quick Age Bracket Pills (or Evaluation Date when expanded) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                data-no-confirm="true"
                onClick={handleToggleFilters}
                className={`inline-flex h-[38px] items-center gap-2 rounded-[10px] px-4 text-[13px] font-medium transition-colors cursor-pointer border ${
                  filtersExpanded
                    ? "bg-white border-[#9D43D6] text-[#1B1B1B] shadow-[0_0_0_2px_rgba(157,67,214,0.12)]"
                    : "bg-[#F7F7F8] border-[#E5E5E5] text-[#1B1B1B] hover:bg-[#EFEFF1]"
                }`}
              >
                <SlidersHorizontal size={14} className="text-[#525252]" />
                <span>Filters</span>
                {filtersExpanded ? (
                  <ChevronUp size={15} className="text-[#525252]" />
                ) : (
                  <ChevronDown size={15} className="text-[#525252]" />
                )}
              </button>

              {filtersExpanded ? (
                <span className="text-[12px] font-medium text-[#8A8A8A]">
                  Evaluation date: {formatVerboseDate(draftAsOfDate)}
                </span>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {quickBracketTabs.map((tab) => {
                    const isActive = selectedBracket === tab.value;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        data-no-confirm="true"
                        onClick={() => {
                          setSelectedBracket(isActive ? "all" : tab.value);
                          setCurrentPage(1);
                        }}
                        className={`h-[36px] px-4 rounded-[10px] text-[12.5px] font-medium border transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#1B1B1B] text-white border-[#1B1B1B] shadow-xs"
                            : "bg-white text-[#7A7A7A] border-[#E5E5E5] hover:bg-[#F7F7F8] hover:text-[#1B1B1B]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Collapsed Summary Chips Row */}
            {!filtersExpanded && (
              <div className="mt-3.5 pt-3.5 border-t border-[#F1F1F1] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded-[8px] bg-[#FAF5FF] px-3 py-1.5 text-[12px] font-medium text-[#9D43D6]">
                    Store : {selectedStore}
                  </span>
                  <span className="inline-flex items-center rounded-[8px] bg-[#FAF5FF] px-3 py-1.5 text-[12px] font-medium text-[#9D43D6]">
                    Item Group : {activeGroupLabel}
                  </span>
                  <span className="inline-flex items-center rounded-[8px] bg-[#FAF5FF] px-3 py-1.5 text-[12px] font-medium text-[#9D43D6]">
                    {activeBracketLabel}
                  </span>
                  <span className="inline-flex items-center rounded-[8px] bg-[#FAF5FF] px-3 py-1.5 text-[12px] font-medium text-[#9D43D6]">
                    Category : {activeCategoryLabel}
                  </span>
                  {selectedSalesStatus !== "all" && (
                    <span className="inline-flex items-center rounded-[8px] bg-[#FAF5FF] px-3 py-1.5 text-[12px] font-medium text-[#9D43D6]">
                      Sales : {activeSalesLabel}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-[8px] bg-[#FAF5FF] px-3 py-1.5 text-[12px] font-medium text-[#9D43D6]">
                    Evaluation Date : {formatDisplayDate(asOfDate)}
                  </span>
                </div>

                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={handleResetFilters}
                  className="h-[34px] px-3.5 rounded-[8px] bg-[#F4F4F5] hover:bg-[#E8E8EA] text-[12px] font-medium text-[#1B1B1B] transition-colors cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            )}

            {/* Expanded Filter Editing Panel (Screenshot 2) */}
            {filtersExpanded && (
              <div className="mt-4 pt-4 border-t border-[#F1F1F1]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                  {/* Store / Warehouse */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                      Store/ Warehouse
                    </label>
                    <Select
                      classNamePrefix="rf-select"
                      options={storeOptions}
                      styles={appSelectStyles}
                      value={storeOptions.find((opt) => opt.value === draftStore)}
                      onChange={(option) => setDraftStore(option ? option.value : "All Stores")}
                      isDisabled={!canChooseStore}
                      placeholder="All Stores"
                    />
                  </div>

                  {/* Item Group */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                      Item Group
                    </label>
                    <Select
                      classNamePrefix="rf-select"
                      options={groupOptions}
                      styles={appSelectStyles}
                      value={groupOptions.find((opt) => opt.value === draftGroup) || groupOptions[0]}
                      onChange={(option) => setDraftGroup(option ? option.value : "all")}
                      placeholder="All Groups"
                    />
                  </div>

                  {/* Sales Status */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                      Sales Status
                    </label>
                    <Select
                      classNamePrefix="rf-select"
                      options={salesStatusOptions}
                      styles={appSelectStyles}
                      value={salesStatusOptions.find((opt) => opt.value === draftSalesStatus)}
                      onChange={(option) => setDraftSalesStatus(option ? option.value : "all")}
                      placeholder="All Items"
                    />
                  </div>

                  {/* Age Bracket */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                      Age Bracket
                    </label>
                    <Select
                      classNamePrefix="rf-select"
                      options={bracketOptions}
                      styles={appSelectStyles}
                      value={bracketOptions.find((opt) => opt.value === draftBracket)}
                      onChange={(option) => setDraftBracket(option ? option.value : "all")}
                      placeholder="All Age Brackets"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                      Category
                    </label>
                    <Select
                      classNamePrefix="rf-select"
                      options={categoryOptions}
                      styles={appSelectStyles}
                      value={categoryOptions.find((opt) => opt.value === draftCategory)}
                      onChange={(option) => setDraftCategory(option ? option.value : "all")}
                      placeholder="All Categories"
                    />
                  </div>

                  {/* Evaluation Date */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#525252] mb-1.5">
                      Evaluation Date
                    </label>
                    <input
                      type="date"
                      value={draftAsOfDate}
                      onChange={(e) => setDraftAsOfDate(e.target.value)}
                      className="w-full h-[40px] px-3 rounded-[10px] border border-[#E5E5E5] bg-white text-[13px] text-[#1B1B1B] focus:outline-none focus:border-[#9D43D6] focus:ring-2 focus:ring-[#9D43D6]/15 transition-all"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2.5">
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={handleResetFilters}
                    className="h-[36px] px-4 rounded-[10px] bg-[#F4F4F5] hover:bg-[#E8E8EA] text-[12.5px] font-medium text-[#1B1B1B] transition-colors cursor-pointer"
                  >
                    Reset Filter
                  </button>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={handleApplyFilters}
                    className="h-[36px] px-5 rounded-[10px] bg-[#9D43D6] hover:bg-[#8732BE] text-[12.5px] font-semibold text-white shadow-[0_2px_8px_rgba(157,67,214,0.28)] transition-colors cursor-pointer"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Top 6 KPI Metric Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
              {/* Total Stock */}
              <div className="bg-white rounded-[14px] border border-[#EAEAEA] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#212121]">Total Stock</span>
                  <div className="w-8 h-8 rounded-[8px] bg-[#F5EEFD] text-[#9D43D6] flex items-center justify-center shrink-0">
                    <Package size={16} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-bold text-[#1B1B1B] tracking-tight">
                    {(summary.totalStock || 0).toLocaleString()}
                  </span>
                  <span className="text-[12px] text-[#8A8A8A]">pcs</span>
                </div>
                <div className="text-[11px] text-[#16A34A] font-medium mt-1">
                  {summary.totalItems || 0}{" "}
                  <span className="text-[#8A8A8A] font-normal">active items</span>
                </div>
              </div>

              {/* Stock Valuation */}
              <div className="bg-white rounded-[14px] border border-[#EAEAEA] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#212121]">Stock Valuation</span>
                  <div className="w-8 h-8 rounded-[8px] bg-[#F5EEFD] text-[#9D43D6] flex items-center justify-center shrink-0">
                    <Layers size={16} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-bold text-[#1B1B1B] tracking-tight truncate">
                    {formatCurrency(summary.totalValue)}
                  </span>
                </div>
                <div className="text-[11px] text-[#16A34A] font-medium mt-1">
                  At cost <span className="text-[#8A8A8A] font-normal">price</span>
                </div>
              </div>

              {/* Total Sale */}
              <div className="bg-white rounded-[14px] border border-[#EAEAEA] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#212121]">Total Sale</span>
                  <div className="w-8 h-8 rounded-[8px] bg-[#F5EEFD] text-[#9D43D6] flex items-center justify-center shrink-0">
                    <ShoppingCart size={16} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-bold text-[#1B1B1B] tracking-tight">
                    {(summary.totalSoldQuantity || 0).toLocaleString()}
                  </span>
                  <span className="text-[12px] text-[#8A8A8A]">pcs</span>
                </div>
                <div className="text-[11px] text-[#16A34A] font-medium mt-1 truncate">
                  {formatCurrency(summary.totalSoldValue || 0)}{" "}
                  <span className="text-[#8A8A8A] font-normal">revenue</span>
                </div>
              </div>

              {/* Avg Stock Age */}
              <div className="bg-white rounded-[14px] border border-[#EAEAEA] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#212121]">Avg Stock Age</span>
                  <div className="w-8 h-8 rounded-[8px] bg-[#F5EEFD] text-[#9D43D6] flex items-center justify-center shrink-0">
                    <CalendarClock size={16} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-bold text-[#1B1B1B] tracking-tight">
                    {summary.averageAgeDays || 0}
                  </span>
                  <span className="text-[12px] text-[#8A8A8A]">Days</span>
                </div>
                <div className="text-[11px] text-[#16A34A] font-medium mt-1">
                  Weighted <span className="text-[#8A8A8A] font-normal">average</span>
                </div>
              </div>

              {/* Unsold Items */}
              <div className="bg-white rounded-[14px] border border-[#EAEAEA] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#212121]">Unsold Items</span>
                  <div className="w-8 h-8 rounded-[8px] bg-[#FFF4ED] text-[#EA580C] flex items-center justify-center shrink-0">
                    <Gem size={16} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-bold text-[#1B1B1B] tracking-tight">
                    {(summary.totalUnsoldItems || 0).toLocaleString()}
                  </span>
                  <span className="text-[12px] text-[#8A8A8A]">Items</span>
                </div>
                <div className="text-[11px] text-[#16A34A] font-medium mt-1">
                  0 units <span className="text-[#8A8A8A] font-normal">sold to date</span>
                </div>
              </div>

              {/* Aged (>90 Days) */}
              <div className="bg-white rounded-[14px] border border-[#EAEAEA] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#212121]">Aged</span>
                  <div className="w-8 h-8 rounded-[8px] bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                    <Clock size={16} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-bold text-[#DC2626] tracking-tight truncate">
                    {formatCurrency(summary.criticalAgedValue)}
                  </span>
                </div>
                <div className="text-[11px] text-[#DC2626] font-medium mt-1">
                  {summary.criticalAgedStock || 0}{" "}
                  <span className="text-[#8A8A8A] font-normal">pcs &gt;90 days</span>
                </div>
              </div>
            </div>
          )}

          {/* Main Table Card (Toolbar + Dark Header Table) */}
          <div className="bg-white rounded-[16px] border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
            {/* Search, Group By, In-Stock, Sort & Show Toolbar */}
            <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#F1F1F1]">
              <div className="relative flex-1 max-w-[320px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="search by item name, SKU, stock, warehouse..."
                  className="w-full h-[38px] pl-9 pr-3.5 rounded-[10px] border border-[#E5E5E5] bg-white text-[12.5px] text-[#1B1B1B] placeholder:text-[#9A9A9A] focus:outline-none focus:border-[#9D43D6] focus:ring-2 focus:ring-[#9D43D6]/15 transition-all"
                />
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Group By : Bracket */}
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={() => setGroupByBracketView(!groupByBracketView)}
                  className={`inline-flex h-[38px] items-center gap-2 rounded-[10px] border px-3.5 text-[12.5px] font-medium transition-colors cursor-pointer ${
                    groupByBracketView
                      ? "bg-[#FAF5FF] text-[#9D43D6] border-[#9D43D6]"
                      : "bg-white text-[#1B1B1B] border-[#E5E5E5] hover:bg-[#F7F7F8]"
                  }`}
                >
                  <Layers size={14} className={groupByBracketView ? "text-[#9D43D6]" : "text-[#6A6A6A]"} />
                  <span>Group By : Bracket</span>
                </button>

                {/* In Stock Only */}
                <label className="inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 text-[12.5px] font-medium text-[#1B1B1B] cursor-pointer select-none hover:bg-[#F7F7F8] transition-colors">
                  <input
                    type="checkbox"
                    checked={hideZeroStock}
                    onChange={(e) => {
                      setHideZeroStock(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="w-3.5 h-3.5 accent-[#9D43D6] rounded border-[#D4D4D8]"
                  />
                  <span>In Stock Only</span>
                </label>

                {/* Sort */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium text-[#8A8A8A]">Sort:</span>
                  <AppSelect
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-[38px] px-3 rounded-[10px] border border-[#E5E5E5] text-[12.5px] font-medium text-[#1B1B1B] bg-white focus:outline-none focus:border-[#9D43D6] cursor-pointer"
                  >
                    <option value="age_desc">Oldest Stock First</option>
                    <option value="age_asc">Newest Stock First</option>
                    <option value="value_desc">Highest Valuation</option>
                    <option value="sales_desc">Highest Sales</option>
                    <option value="name_asc">Item Name (A-Z)</option>
                  </AppSelect>
                </div>

                {/* Show */}
                {!groupByBracketView && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium text-[#8A8A8A]">Show:</span>
                    <AppSelect
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="h-[38px] px-2.5 rounded-[10px] border border-[#E5E5E5] text-[12.5px] font-medium text-[#1B1B1B] bg-white focus:outline-none focus:border-[#9D43D6] cursor-pointer"
                    >
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="all">All</option>
                    </AppSelect>
                  </div>
                )}
              </div>
            </div>

            {/* Table Content */}
            <div className="p-4 pt-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#6A6A6A]">
                  <Loader2 size={30} className="animate-spin text-[#9D43D6] mb-3" />
                  <p className="text-[13px] font-medium">Calculating stock age, groups, and sales data...</p>
                </div>
              ) : processedItems.length === 0 ? (
                <div className="py-16 text-center text-[#6A6A6A]">
                  <Package size={38} className="mx-auto text-[#D4D4D8] mb-2.5" />
                  <p className="text-[15px] font-semibold text-[#1B1B1B]">No aging records found</p>
                  <p className="text-[12.5px] text-[#8A8A8A] mt-1">
                    Try adjusting the warehouse, group, sales status, or age bracket filters.
                  </p>
                </div>
              ) : groupByBracketView ? (
                /* Grouped by Age Bracket View */
                <div className="space-y-5">
                  {groupedByBracketData.map((section) => (
                    <div key={section.key} className="rounded-[12px] border border-[#EAEAEA] overflow-hidden">
                      <div className="px-4 py-3 bg-[#FAF5FF] border-b border-[#EFE6FA] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[13px] font-bold text-[#1B1B1B]">{section.label}</span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white font-semibold text-[#9D43D6] border border-[#E9D5FF]">
                            {section.items.length} items
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[12px] font-medium text-[#525252]">
                          <span>Stock: <strong className="text-[#1B1B1B]">{section.totalStock.toLocaleString()} pcs</strong></span>
                          <span>Valuation: <strong className="text-[#16A34A]">{formatCurrency(section.totalVal)}</strong></span>
                          <span>Sales: <strong className="text-[#9D43D6]">{section.totalSold.toLocaleString()} pcs</strong></span>
                        </div>
                      </div>

                      {section.items.length === 0 ? (
                        <p className="text-[12px] text-[#8A8A8A] italic py-5 text-center">
                          No items currently in this bracket
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                                <th className="py-3.5 px-4">#</th>
                                <th className="py-3.5 px-4">Item Details</th>
                                <th className="py-3.5 px-4">Group</th>
                                <th className="py-3.5 px-4">Warehouse</th>
                                <th className="py-3.5 px-4">Inward Date &amp; Source</th>
                                <th className="py-3.5 px-4 text-center">Stock Age</th>
                                <th className="py-3.5 px-4 text-center">Sale Status</th>
                                <th className="py-3.5 px-4 text-right">Current Stock</th>
                                {isAdmin && <th className="py-3.5 px-4 text-right">Unit Cost</th>}
                                <th className="py-3.5 px-4 text-right">Stock Valuation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1F1F1] text-[12.5px] text-[#1B1B1B]">
                              {section.items.map((item, idx) => (
                                <tr
                                  key={`${item.itemId}_${item.warehouse}_${idx}`}
                                  className="even:bg-[#FAF7FD]/60 hover:bg-[#F5EEFD]/70 transition-colors"
                                >
                                  <td className="py-3.5 px-4 text-[#525252] font-medium">{idx + 1}</td>
                                  <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-[6px] bg-[#EFEFEF] shrink-0 overflow-hidden flex items-center justify-center">
                                        {item.image ? (
                                          <img src={item.image} alt={item.itemName} className="w-full h-full object-cover" />
                                        ) : null}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-medium text-[#1B1B1B] leading-snug">{item.itemName}</div>
                                        <div className="text-[11px] text-[#8A8A8A] mt-0.5">
                                          {item.sku ? `SKU: ${item.sku}` : ""}
                                          {item.size && item.size !== "-" ? ` • Size: ${item.size}` : ""}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-[#1B1B1B] font-medium">
                                    {item.groupName || <span className="text-[#8A8A8A]">Standalone</span>}
                                  </td>
                                  <td className="py-3.5 px-4 text-[#1B1B1B]">{item.warehouse}</td>
                                  <td className="py-3.5 px-4">
                                    <div className="font-medium text-[#1B1B1B]">{item.inwardDate || "-"}</div>
                                    <div className="text-[11px] text-[#8A8A8A]">{item.inwardSource || "Initial Stock"}</div>
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    <span className="inline-flex items-center px-3 py-1 rounded-[6px] text-[12px] font-semibold bg-[#F5EEFD] text-[#9D43D6]">
                                      {item.ageInDays} Days
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    {(item.soldQuantity || 0) > 0 ? (
                                      <div className="inline-flex flex-col items-center leading-tight">
                                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#1B1B1B]">
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                                          Sold
                                        </span>
                                        <span className="text-[11px] font-semibold text-[#16A34A] mt-0.5">
                                          {item.soldQuantity.toLocaleString()} Pcs
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#D97706]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                                        Unsold
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-medium text-[#1B1B1B]">
                                    {(item.stockOnHand ?? 0).toLocaleString()} Pcs
                                  </td>
                                  {isAdmin && (
                                    <td className="py-3.5 px-4 text-right font-medium text-[#1B1B1B]">
                                      {formatCurrency(item.costPrice)}
                                    </td>
                                  )}
                                  <td className="py-3.5 px-4 text-right font-semibold text-[#16A34A]">
                                    {formatCurrency(item.stockValue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Flat Standard Table (Matches Screenshot 1 & 2) */
                <div className="overflow-x-auto rounded-[10px] border border-[#EAEAEA]">
                  <table className="min-w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                        <th className="py-3.5 px-4">#</th>
                        <th className="py-3.5 px-4">Item Details</th>
                        <th className="py-3.5 px-4">Group</th>
                        <th className="py-3.5 px-4">Warehouse</th>
                        <th className="py-3.5 px-4">Inward Date &amp; Source</th>
                        <th className="py-3.5 px-4 text-center">Stock Age</th>
                        <th className="py-3.5 px-4 text-center">Age Bracket</th>
                        <th className="py-3.5 px-4 text-center">Sale Status</th>
                        <th className="py-3.5 px-4 text-right">Current Stock</th>
                        {isAdmin && <th className="py-3.5 px-4 text-right">Unit Cost</th>}
                        <th className="py-3.5 px-4 text-right">Stock Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F1F1] text-[12.5px] text-[#1B1B1B]">
                      {paginatedItems.map((item, idx) => {
                        const rowNumber =
                          itemsPerPage === "all"
                            ? idx + 1
                            : (currentPage - 1) * parseInt(itemsPerPage, 10) + idx + 1;

                        const agePillClass =
                          (item.ageInDays || 0) > 90
                            ? "bg-[#FEF2F2] text-[#DC2626]"
                            : "bg-[#F5EEFD] text-[#9D43D6]";

                        return (
                          <tr
                            key={`${item.itemId}_${item.warehouse}_${idx}`}
                            className="even:bg-[#FAF7FD]/60 hover:bg-[#F5EEFD]/70 transition-colors"
                          >
                            <td className="py-3.5 px-4 text-[#525252] font-medium">{rowNumber}</td>

                            {/* Item Details */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-[6px] bg-[#EFEFEF] shrink-0 overflow-hidden flex items-center justify-center">
                                  {item.image ? (
                                    <img src={item.image} alt={item.itemName} className="w-full h-full object-cover" />
                                  ) : null}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-[#1B1B1B] leading-snug">{item.itemName}</div>
                                  <div className="text-[11px] text-[#8A8A8A] mt-0.5">
                                    {item.sku ? `SKU: ${item.sku}` : ""}
                                    {item.size && item.size !== "-" ? ` • Size: ${item.size}` : ""}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Group */}
                            <td className="py-3.5 px-4 text-[#1B1B1B] font-medium">
                              {item.groupName || <span className="text-[#8A8A8A]">Standalone</span>}
                            </td>

                            {/* Warehouse */}
                            <td className="py-3.5 px-4 text-[#1B1B1B]">{item.warehouse}</td>

                            {/* Inward Date & Source */}
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-[#1B1B1B]">{item.inwardDate || "-"}</div>
                              <div className="text-[11px] text-[#8A8A8A]">{item.inwardSource || "Initial Stock"}</div>
                            </td>

                            {/* Stock Age */}
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-[6px] text-[12px] font-semibold ${agePillClass}`}
                              >
                                {item.ageInDays} Days
                              </span>
                            </td>

                            {/* Age Bracket */}
                            <td className="py-3.5 px-4 text-center text-[#1B1B1B] font-medium">
                              {item.bracketLabel}
                            </td>

                            {/* Sale Status */}
                            <td className="py-3.5 px-4 text-center">
                              {(item.soldQuantity || 0) > 0 ? (
                                <div className="inline-flex flex-col items-center leading-tight">
                                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#1B1B1B]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                                    Sold
                                  </span>
                                  <span className="text-[11px] font-semibold text-[#16A34A] mt-0.5">
                                    {item.soldQuantity.toLocaleString()} Pcs
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#D97706]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                                  Unsold
                                </span>
                              )}
                            </td>

                            {/* Current Stock */}
                            <td className="py-3.5 px-4 text-right font-medium text-[#1B1B1B]">
                              {(item.stockOnHand ?? 0).toLocaleString()} Pcs
                            </td>

                            {/* Unit Cost */}
                            {isAdmin && (
                              <td className="py-3.5 px-4 text-right font-medium text-[#1B1B1B]">
                                {formatCurrency(item.costPrice)}
                              </td>
                            )}

                            {/* Stock Valuation */}
                            <td className="py-3.5 px-4 text-right font-semibold text-[#16A34A]">
                              {formatCurrency(item.stockValue)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination Footer */}
            {!loading && !groupByBracketView && processedItems.length > 0 && itemsPerPage !== "all" && totalPages > 1 && (
              <div className="bg-[#FAFAFA] border-t border-[#EAEAEA] px-5 py-3 flex items-center justify-between text-[12px] text-[#6A6A6A]">
                <div>
                  Showing {(currentPage - 1) * parseInt(itemsPerPage, 10) + 1} to{" "}
                  {Math.min(currentPage * parseInt(itemsPerPage, 10), processedItems.length)} of{" "}
                  {processedItems.length} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-[32px] px-3 rounded-[8px] border border-[#E5E5E5] bg-white font-medium text-[#1B1B1B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Previous
                  </button>
                  <span className="font-medium text-[#1B1B1B] px-1">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-[32px] px-3 rounded-[8px] border border-[#E5E5E5] bg-white font-medium text-[#1B1B1B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default InventoryAgingReport;
