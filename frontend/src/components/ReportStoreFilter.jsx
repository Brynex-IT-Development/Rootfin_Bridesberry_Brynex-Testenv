import { useState } from "react";
import AppSelect from "./AppSelect.jsx";
import { findStore, useActiveStores } from "../utils/storeService";
import { isAdminOrSuperAdmin } from "../utils/roleUtils";

export const ALL_STORES = "all";

/**
 * Store selection for report pages.
 * Admin / Super Admin: "All Stores" + every backend store (defaults to All Stores).
 * Everyone else: locked to their own store (no dropdown).
 */
export const useReportStoreFilter = () => {
  const user = JSON.parse(localStorage.getItem("rootfinuser") || "{}");
  const canSelectStore = isAdminOrSuperAdmin(user);
  const { stores } = useActiveStores();
  const [selectedStore, setSelectedStore] = useState(canSelectStore ? ALL_STORES : (user?.locCode || ""));

  const isAllStores = canSelectStore && selectedStore === ALL_STORES;
  const effectiveStore = canSelectStore ? selectedStore : (user?.locCode || "");

  /** locCodes to query: every backend store for "All Stores", else the one selected. */
  const locCodesToQuery = () =>
    isAllStores ? stores.map((s) => s.locCode).filter(Boolean) : [effectiveStore].filter(Boolean);

  const storeLabel = (locCode) => findStore(locCode, stores)?.locName || locCode || "";

  return { canSelectStore, selectedStore: effectiveStore, setSelectedStore, isAllStores, stores, locCodesToQuery, storeLabel };
};

/** The Store dropdown itself (renders nothing for non-admins). */
const ReportStoreFilter = ({ filter, className = "" }) => {
  if (!filter?.canSelectStore) return null;
  return (
    <div className={`rf-form-field !mb-0 ${className}`}>
      <label className="rf-field-label">Store</label>
      <AppSelect
        value={filter.selectedStore}
        onChange={(e) => filter.setSelectedStore(e.target.value)}
        className="rf-input !w-[200px] !h-[40px] !rounded-[10px] bg-white cursor-pointer"
      >
        <option value={ALL_STORES}>All Stores</option>
        {filter.stores.map((s) => (
          <option key={s.locCode} value={s.locCode}>{s.locName}</option>
        ))}
      </AppSelect>
    </div>
  );
};

export default ReportStoreFilter;
