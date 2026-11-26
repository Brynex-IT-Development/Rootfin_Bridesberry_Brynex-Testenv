import { useState, useEffect } from "react";
import baseUrl from "../api/api";

export const FALLBACK_STORES = [];

export const STORE_OPTIONS = [
  { value: "all", label: "All Stores" },
];

export const isAllowedStoreNameOrCode = (locCode, locName) => {
  const code = (locCode || "").toString().trim();
  const name = (locName || "").trim();
  return Boolean(code || name);
};

export const saveCustomStore = (store) => {
  if (!store || !store.locCode) return;
  try {
    const code = store.locCode.toString().trim();
    const name = (store.locName || store.name || code).trim();
    if (!code || !name) return;

    // 1. Read custom stores list
    const rawCustom = localStorage.getItem("rootfin_custom_stores");
    let customList = [];
    if (rawCustom) {
      try {
        customList = JSON.parse(rawCustom) || [];
      } catch (e) {
        customList = [];
      }
    }

    const storeEntry = {
      locName: name,
      locCode: code,
      name: name,
      label: name,
      value: code,
      address: store.address || "",
      phone: store.phone || "",
      email: store.email || ""
    };

    const idx = customList.findIndex(s => s.locCode.toString().trim() === code);
    if (idx >= 0) {
      customList[idx] = storeEntry;
    } else {
      customList.push(storeEntry);
    }
    localStorage.setItem("rootfin_custom_stores", JSON.stringify(customList));

    // 2. Read current active stores and merge
    const currentActive = getActiveStores();
    const activeMap = new Map();
    currentActive.forEach(s => activeMap.set(s.locCode.toString().trim(), s));
    activeMap.set(code, storeEntry);

    const updated = Array.from(activeMap.values()).sort((a, b) => 
      a.locName.localeCompare(b.locName)
    );

    localStorage.setItem("rootfin_active_stores", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("rootfin-stores-updated", { detail: updated }));
    return updated;
  } catch (err) {
    console.error("Error saving custom store:", err);
  }
};

export const removeCustomStore = (locCode) => {
  if (!locCode) return;
  const code = locCode.toString().trim();

  try {
    // 1. Remove from rootfin_custom_stores
    const rawCustom = localStorage.getItem("rootfin_custom_stores");
    if (rawCustom) {
      try {
        const customList = JSON.parse(rawCustom) || [];
        const filteredCustom = customList.filter(s => (s.locCode || "").toString().trim() !== code);
        localStorage.setItem("rootfin_custom_stores", JSON.stringify(filteredCustom));
      } catch (e) {
        localStorage.removeItem("rootfin_custom_stores");
      }
    }

    // 2. Remove from rootfin_active_stores
    const rawActive = localStorage.getItem("rootfin_active_stores");
    if (rawActive) {
      try {
        const activeList = JSON.parse(rawActive) || [];
        const filteredActive = activeList.filter(s => (s.locCode || "").toString().trim() !== code);
        localStorage.setItem("rootfin_active_stores", JSON.stringify(filteredActive));
      } catch (e) {
        localStorage.removeItem("rootfin_active_stores");
      }
    }

    // 3. Rebuild active stores and dispatch update event
    const updated = getActiveStores().filter(s => (s.locCode || "").toString().trim() !== code);
    localStorage.setItem("rootfin_active_stores", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("rootfin-stores-updated", { detail: updated }));
    return updated;
  } catch (err) {
    console.error("Error removing custom store:", err);
  }
};

export const getActiveStores = () => {
  // Sanitize super admin in rootfinuser immediately
  try {
    const rawUser = localStorage.getItem("rootfinuser");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const role = (u?.role || '').toLowerCase();
      const isSuper = role === 'super_admin' || role === 'superadmin';
      if (isSuper && u.username !== "Brynex Admin") {
        u.username = "Brynex Admin";
        localStorage.setItem("rootfinuser", JSON.stringify(u));
      }
    }
  } catch (e) {}

  try {
    const cached = localStorage.getItem("rootfin_active_stores");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(s => s && s.locCode && isAllowedStoreNameOrCode(s.locCode, s.locName || s.name));
      }
    }
  } catch (e) {}

  return [];
};

export const fetchActiveStores = async () => {
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

  const storeMap = new Map();

  // Helper to add raw store object
  const processStore = (code, rawName, extra = {}) => {
    code = (code || "").toString().trim();
    rawName = (rawName || "").trim();
    if (!code || !rawName) return;

    if (!isAllowedStoreNameOrCode(code, rawName)) return;

    let displayName = rawName;
    if (code === "155" || rawName.toLowerCase().replace(/[\s\-_.]+/g, '') === "bridesberry") {
      displayName = "Brides Berry";
      if (!code) code = "155";
    } else if (code === "858" && (!rawName || rawName.toLowerCase().replace(/[\s\-_.]+/g, '') === "warehouse")) {
      displayName = "Warehouse";
    } else if (!code && rawName.toLowerCase().includes("warehouse")) {
      code = "858";
    }

    // If already exists, prefer cleaner casing (e.g. "Brides Berry" over "BRIDES BERRY")
    const existing = storeMap.get(code);
    if (!existing) {
      storeMap.set(code, {
        locName: displayName,
        locCode: code,
        name: displayName,
        label: displayName,
        value: code,
        address: extra.address || "",
        phone: extra.phone || "",
        email: extra.email || "",
        gst: extra.gst || ""
      });
    } else {
      if (existing.locName === existing.locName.toUpperCase() && displayName !== displayName.toUpperCase()) {
        existing.locName = displayName;
        existing.name = displayName;
        existing.label = displayName;
      }
      if (extra.address) existing.address = extra.address;
      if (extra.phone) existing.phone = extra.phone;
      if (extra.email) existing.email = extra.email;
      if (extra.gst) existing.gst = extra.gst;
    }
  };

  try {
    // Fetch in parallel from ALL potential sources
    const [storesRes, userStoresRes, allUsersRes] = await Promise.allSettled([
      fetch(`${API_URL}/api/stores`).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/user/getAllStores`).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/user/getAllUsers`).then(r => r.ok ? r.json() : null)
    ]);

    // 1. Identify active admin users who manage a store or warehouse
    // A store only exists if an active Store Admin or Warehouse Admin user exists!
    const activeAdminLocCodes = new Set();
    if (allUsersRes.status === "fulfilled" && allUsersRes.value?.users && Array.isArray(allUsersRes.value.users)) {
      allUsersRes.value.users.forEach(u => {
        const role = (u.role || '').toLowerCase().trim();
        const isSuper = role === 'super_admin' || role === 'superadmin';
        const isWarehouse = role === 'warehouse_admin' || role === 'warehouseadmin' || role === 'warehouse admin' || (u.username || '').toLowerCase() === 'warehouse';
        const isStoreAdmin = role === 'store_admin' || role === 'store_manager' || role === 'store admin';

        if (!isSuper && isWarehouse) {
          const code = (u.locCode || "858").toString().trim() || "858";
          const name = (u.storeName || u.username || "Warehouse").toString().trim();
          activeAdminLocCodes.add(code);
          processStore(code, name, u);
        } else if (!isSuper && isStoreAdmin) {
          const code = (u.locCode || "").toString().trim();
          if (code) {
            activeAdminLocCodes.add(code);
            processStore(code, u.storeName || u.username || code, u);
          }
        }
      });
    }

    // If NO store admins and NO warehouse admins exist, then NO STORES can exist!
    if (activeAdminLocCodes.size === 0) {
      try {
        localStorage.removeItem("rootfin_custom_stores");
        localStorage.setItem("rootfin_active_stores", JSON.stringify([]));
      } catch (e) {}
      window.dispatchEvent(new CustomEvent("rootfin-stores-updated", { detail: [] }));
      return [];
    }

    // 2. Process /api/stores (only if locCode has an active store/warehouse admin)
    if (storesRes.status === "fulfilled" && storesRes.value?.stores && Array.isArray(storesRes.value.stores)) {
      storesRes.value.stores.forEach(s => {
        const code = (s.locCode || "").toString().trim();
        if (activeAdminLocCodes.has(code)) {
          processStore(code, s.name || s.locName, s);
        }
      });
    }

    // 3. Process /user/getAllStores (only if locCode has an active store/warehouse admin)
    if (userStoresRes.status === "fulfilled" && userStoresRes.value?.stores && Array.isArray(userStoresRes.value.stores)) {
      userStoresRes.value.stores.forEach(s => {
        const code = (s.locCode || "").toString().trim();
        if (activeAdminLocCodes.has(code)) {
          processStore(code, s.locName || s.name, s);
        }
      });
    }

    // 4. Process from active admin users list directly
    if (allUsersRes.status === "fulfilled" && allUsersRes.value?.users && Array.isArray(allUsersRes.value.users)) {
      allUsersRes.value.users.forEach(u => {
        const role = (u.role || '').toLowerCase().trim();
        const isWarehouse = role === 'warehouse_admin' || role === 'warehouseadmin' || role === 'warehouse admin' || (u.username || '').toLowerCase() === 'warehouse';
        let code = (u.locCode || "").toString().trim();
        if (isWarehouse && !code) code = "858";
        if (code && activeAdminLocCodes.has(code)) {
          processStore(code, isWarehouse ? "Warehouse" : (u.storeName || u.username), u);
        }
      });
    }

    // Filter storeMap to only activeAdminLocCodes
    for (const [code] of storeMap.entries()) {
      if (!activeAdminLocCodes.has(code)) {
        storeMap.delete(code);
      }
    }

    const sorted = Array.from(storeMap.values()).sort((a, b) => 
      a.locName.localeCompare(b.locName)
    );

    localStorage.setItem("rootfin_active_stores", JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent("rootfin-stores-updated", { detail: sorted }));
    return sorted;
  } catch (error) {
    console.error("Error fetching active stores:", error);
  }

  const current = getActiveStores();
  return current;
};

export const useActiveStores = () => {
  const [stores, setStores] = useState(() => getActiveStores());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      const updated = await fetchActiveStores();
      if (isMounted && updated && updated.length > 0) {
        setStores(updated);
      }
      if (isMounted) setLoading(false);
    };

    load();

    const handleUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setStores(e.detail);
      } else {
        setStores(getActiveStores());
      }
    };

    window.addEventListener("rootfin-stores-updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("rootfin-stores-updated", handleUpdate);
    };
  }, []);

  const storeOptions = STORE_OPTIONS;

  const warehouseOptions = stores.map(s => s.locName);
  const branchOptions = stores.map(s => s.locName);
  const locations = stores.map(s => ({ value: s.locName, locCode: s.locCode }));

  return {
    stores,
    allLocations: stores,
    storeOptions,
    warehouseOptions,
    branchOptions,
    locations,
    loading,
    refreshStores: fetchActiveStores
  };
};
