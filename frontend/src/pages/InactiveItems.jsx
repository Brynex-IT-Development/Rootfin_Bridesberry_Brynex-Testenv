import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse as mapWarehouse } from "../utils/warehouseMapping";
import useSidebar from "../hooks/useSidebar";
import Header from "../components/Header";
import { isWarehouseStore, getUserStoreName } from "../utils/storeService";
import { isAdminOrSuperAdmin } from "../utils/roleUtils";

const API_ROOT = (baseUrl?.baseUrl || "").replace(/\/$/, "");

const InactiveItems = () => {
  const isSidebarOpen = useSidebar();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Get user info for filtering
  const userStr = localStorage.getItem("rootfinuser");
  const user = userStr ? JSON.parse(userStr) : null;
  const userEmail = user?.email || user?.username || "";
  const isAdminEmail = isAdminOrSuperAdmin(user);
  const isAdmin = isAdminEmail ||
    user?.power === "admin" ||
    (user?.locCode && isWarehouseStore(user.locCode));

  // Fallback locations mapping
  const fallbackLocations = [];

  // Get location name - prioritize locCode lookup over username
  let userLocName = "";
  if (user?.locCode) {
    const location = fallbackLocations.find(loc => loc.locCode === user.locCode || loc.locCode === String(user.locCode));
    if (location) {
      userLocName = location.locName;
    }
  }
  if (!userLocName) {
    userLocName = getUserStoreName(user);
  }

  // Helper function to map locName to warehouse name
  // Use the shared warehouse mapping utility
  const mapLocNameToWarehouse = (locName) => {
    if (!locName) return "";
    return mapWarehouse(locName);
  };

  const userWarehouse = mapLocNameToWarehouse(userLocName);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // Build query params with warehouse filtering
      const groupsParams = new URLSearchParams({
        page: "1",
        limit: "100",
      });
      const itemsParams = new URLSearchParams({
        page: "1",
        limit: "100",
      });

      // Pass warehouse for both non-admin users AND admins viewing a specific store
      if (userWarehouse) {
        groupsParams.append("warehouse", userWarehouse);
        itemsParams.append("warehouse", userWarehouse);
      }
      groupsParams.append("isAdmin", isAdmin.toString());
      itemsParams.append("isAdmin", isAdmin.toString());
      if (user?.power) groupsParams.append("userPower", user.power);
      if (user?.locCode) groupsParams.append("locCode", user.locCode);
      if (user?.power) itemsParams.append("userPower", user.power);
      if (user?.locCode) itemsParams.append("locCode", user.locCode);

      const [groupsRes, itemsRes, vendorsRes] = await Promise.all([
        fetch(`${API_ROOT}/api/shoe-sales/item-groups?${groupsParams}`),
        fetch(`${API_ROOT}/api/shoe-sales/items?${itemsParams}`),
        fetch(`${API_ROOT}/api/purchase/vendors?userId=${encodeURIComponent(userEmail)}${user?.power ? `&userPower=${encodeURIComponent(user.power)}` : ""}`),
      ]);
      if (!groupsRes.ok) throw new Error("Failed to load item groups");
      if (!itemsRes.ok) throw new Error("Failed to load items");
      if (!vendorsRes.ok) throw new Error("Failed to load vendors");

      const groupsData = await groupsRes.json();
      const itemsData = await itemsRes.json();
      const vendorsData = await vendorsRes.json();

      // Handle paginated response for groups
      let groupsList = [];
      if (Array.isArray(groupsData)) {
        groupsList = groupsData;
      } else if (groupsData.groups && Array.isArray(groupsData.groups)) {
        groupsList = groupsData.groups;
      }

      // Fetch full details for each group to get items with isActive status
      const fullGroupsPromises = groupsList.map(async (group) => {
        const groupId = group._id || group.id;
        try {
          const fullRes = await fetch(`${API_ROOT}/api/shoe-sales/item-groups/${groupId}`);
          if (fullRes.ok) {
            return await fullRes.json();
          }
          return group;
        } catch {
          return group;
        }
      });
      const fullGroupsList = await Promise.all(fullGroupsPromises);

      // Handle paginated response for items
      let itemsList = [];
      if (Array.isArray(itemsData)) {
        itemsList = itemsData;
      } else if (itemsData.items && Array.isArray(itemsData.items)) {
        itemsList = itemsData.items;
      }

      setGroups(fullGroupsList);
      setItems(itemsList);
      setVendors(vendorsData || []);
      console.log("Vendors loaded:", vendorsData?.length || 0);
      console.log("Inactive vendors found:", (vendorsData || []).filter(v => v.isActive === false || v.status === 'inactive').length);
    } catch (e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const inactiveGroups = useMemo(
    () => groups.filter((g) => (g?.isActive === false) || (String(g?.isActive).toLowerCase() === "false")),
    [groups]
  );
  const inactiveItems = useMemo(
    () => {
      // Get set of all group item IDs for filtering
      const groupItemIds = new Set();
      groups.forEach((group) => {
        if (Array.isArray(group.items)) {
          group.items.forEach((item) => {
            const itemId = item._id?.toString() || item.id?.toString();
            if (itemId) {
              groupItemIds.add(itemId);
            }
          });
        }
      });
      
      return items.filter((i) => {
        // Only include items that are inactive AND are truly standalone (not from groups)
        const isInactive = (i?.isActive === false) || (String(i?.isActive).toLowerCase() === "false");
        const itemId = i._id?.toString() || i.id?.toString();
        const isFromGroup = i?.isFromGroup || i?.itemGroupId || (itemId && groupItemIds.has(itemId));
        return isInactive && !isFromGroup;
      });
    },
    [items, groups]
  );
  const inactiveVendors = useMemo(
    () => vendors.filter((v) => (v?.isActive === false) || (v?.status === 'inactive')),
    [vendors]
  );
  const activeGroups = useMemo(
    () => groups.filter((g) => !(g?.isActive === false || String(g?.isActive).toLowerCase() === "false")),
    [groups]
  );

  // Extract inactive items from all groups (both active and inactive)
  const inactiveItemsFromGroups = useMemo(() => {
    const result = [];
    groups.forEach((group) => {
      if (Array.isArray(group.items)) {
        group.items.forEach((item) => {
          if ((item?.isActive === false) || (String(item?.isActive).toLowerCase() === "false")) {
            result.push({
              ...item,
              groupId: group._id || group.id,
              groupName: group.name,
              isFromGroup: true,
            });
          }
        });
      }
    });
    return result;
  }, [groups]);

  const activateGroup = async (groupId) => {
    try {
      setSaving(true);

      // IMPORTANT: The list API returns summarized groups (no full items).
      // Fetch the full item group by id before updating.
      const fullRes = await fetch(`${API_ROOT}/api/shoe-sales/item-groups/${groupId}`);
      if (!fullRes.ok) throw new Error("Failed to load item group");
      const fullGroup = await fullRes.json();

      const payload = {
        name: fullGroup.name,
        sku: fullGroup.sku || "",
        itemType: fullGroup.itemType || "goods",
        unit: fullGroup.unit || "",
        manufacturer: fullGroup.manufacturer || "",
        brand: fullGroup.brand || "",
        taxPreference: fullGroup.taxPreference || "taxable",
        intraStateTaxRate: fullGroup.intraStateTaxRate || "",
        interStateTaxRate: fullGroup.interStateTaxRate || "",
        inventoryValuationMethod: fullGroup.inventoryValuationMethod || "",
        createAttributes: fullGroup.createAttributes !== undefined ? fullGroup.createAttributes : true,
        attributeRows: fullGroup.attributeRows || [],
        sellable: fullGroup.sellable !== undefined ? fullGroup.sellable : true,
        purchasable: fullGroup.purchasable !== undefined ? fullGroup.purchasable : true,
        trackInventory: fullGroup.trackInventory !== undefined ? fullGroup.trackInventory : false,
        items: Array.isArray(fullGroup.items) ? fullGroup.items : [],
        stock: fullGroup.stock || 0,
        reorder: fullGroup.reorder || "",
        isActive: true,
      };

      const res = await fetch(`${API_ROOT}/api/shoe-sales/item-groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to activate group");
      await fetchData();
    } catch (e) {
      alert(e.message || "Failed to activate group");
    } finally {
      setSaving(false);
    }
  };

  const activateItem = async (itemId) => {
    try {
      setSaving(true);
      const item = items.find((i) => (i._id || i.id) === itemId);
      if (!item) {
        alert("Item not found");
        return;
      }
      
      // Fetch full item details first to ensure we have all fields
      const fullItemRes = await fetch(`${API_ROOT}/api/shoe-sales/items/${itemId}`);
      if (!fullItemRes.ok) throw new Error("Failed to load item details");
      const fullItem = await fullItemRes.json();
      
      // Prepare payload with all required fields
      const payload = {
        ...fullItem,
        isActive: true,
      };
      
      const res = await fetch(`${API_ROOT}/api/shoe-sales/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to activate item");
      }
      
      await fetchData();
      alert("Item activated successfully");
    } catch (e) {
      alert(e.message || "Failed to activate item");
    } finally {
      setSaving(false);
    }
  };

  const activateVendor = async (vendorId) => {
    try {
      setSaving(true);
      const vendor = vendors.find((v) => (v._id || v.id) === vendorId);
      if (!vendor) return;

      const res = await fetch(`${API_ROOT}/api/purchase/vendors/${vendorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vendor, isActive: true, status: 'active' }),
      });
      if (!res.ok) throw new Error("Failed to activate vendor");

      // Update localStorage if it exists
      try {
        const savedVendors = JSON.parse(localStorage.getItem("vendors") || "[]");
        const updatedVendorsList = savedVendors.map(v => {
          if ((v._id || v.id) === vendorId) {
            return { ...v, isActive: true, status: 'active' };
          }
          return v;
        });
        localStorage.setItem("vendors", JSON.stringify(updatedVendorsList));
      } catch (localErr) {
        console.warn("Failed to update localStorage:", localErr);
      }

      await fetchData();
    } catch (e) {
      alert(e.message || "Failed to activate vendor");
    } finally {
      setSaving(false);
    }
  };

  const activateItemFromGroup = async (itemId, groupId) => {
    try {
      setSaving(true);

      // Fetch the full group
      const groupRes = await fetch(`${API_ROOT}/api/shoe-sales/item-groups/${groupId}`);
      if (!groupRes.ok) throw new Error("Failed to load group");
      const group = await groupRes.json();

      // Find and activate the item in the group
      const updatedItems = group.items.map((i) => {
        const iId = i._id?.toString() || i.id?.toString() || "";
        if (iId === itemId.toString()) {
          return { ...i, isActive: true };
        }
        return i;
      });

      const payload = {
        name: group.name,
        sku: group.sku || "",
        itemType: group.itemType || "goods",
        unit: group.unit || "",
        manufacturer: group.manufacturer || "",
        brand: group.brand || "",
        taxPreference: group.taxPreference || "taxable",
        intraStateTaxRate: group.intraStateTaxRate || "",
        interStateTaxRate: group.interStateTaxRate || "",
        inventoryValuationMethod: group.inventoryValuationMethod || "",
        createAttributes: group.createAttributes !== undefined ? group.createAttributes : true,
        attributeRows: group.attributeRows || [],
        sellable: group.sellable !== undefined ? group.sellable : true,
        purchasable: group.purchasable !== undefined ? group.purchasable : true,
        trackInventory: group.trackInventory !== undefined ? group.trackInventory : false,
        items: updatedItems,
        stock: group.stock || 0,
        reorder: group.reorder || "",
        isActive: group.isActive !== undefined ? group.isActive : true,
      };

      const res = await fetch(`${API_ROOT}/api/shoe-sales/item-groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to activate item");
      await fetchData();
    } catch (e) {
      alert(e.message || "Failed to activate item");
    } finally {
      setSaving(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Header title="Inactive Items" />
        <div className={`transition-all duration-300 flex min-h-screen items-center justify-center p-6 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F2572B] border-t-transparent" />
            <p className="text-[12px] font-medium text-[#7A7A7A]">Loading inactive items...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Header title="Inactive Items" />
        <div className={`transition-all duration-300 p-6 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
          <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-4 text-[#DC2626] text-[13px] font-medium">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Inactive Items" />
      <div className={`transition-all duration-300 flex flex-col ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#212121]">Inactive Items</h1>
        </div>
        <div className="p-5 md:p-6 space-y-5">
          {/* Summary Pills Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Inactive Groups", count: inactiveGroups.length },
              { label: "Inactive Items", count: inactiveItems.length },
              { label: "Items in Groups", count: inactiveItemsFromGroups.length },
              { label: "Inactive Vendors", count: inactiveVendors.length },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-[12px] border border-[#E5E5E5] px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#7A7A7A]">{stat.label}</span>
                <span className="text-[18px] font-bold text-[#1B1B1B] tabular-nums">{stat.count}</span>
              </div>
            ))}
          </div>

          {/* Inactive Item Groups */}
          <div className="rounded-[12px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0F0F0]">
              <h2 className="text-[14px] font-semibold text-[#1B1B1B]">Inactive Item Groups</h2>
              <Link to="/shoe-sales/item-groups" className="text-[12px] font-semibold text-[#F2572B] hover:underline">Go to Groups</Link>
            </div>
            {inactiveGroups.length === 0 ? (
              <p className="text-[13px] text-[#7A7A7A] py-8 text-center">No inactive groups.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-[#1B1B1B] text-white">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Group Name</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">SKU</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#F0F0F0]">
                    {inactiveGroups.map((grp) => {
                      const id = grp._id || grp.id;
                      return (
                        <tr key={id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="px-5 py-3 text-[13px] font-semibold text-[#1B1B1B]">{grp.name || "Untitled"}</td>
                          <td className="px-5 py-3 text-[13px] text-[#525252]">{grp.sku || "-"}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => activateGroup(id)}
                              disabled={saving}
                              className="inline-flex h-[34px] items-center px-4 rounded-[8px] bg-[#16A34A] hover:bg-[#15803D] text-[12px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              {saving ? "Activating..." : "Activate"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inactive Standalone Items */}
          <div className="rounded-[12px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0F0F0]">
              <h2 className="text-[14px] font-semibold text-[#1B1B1B]">Inactive Standalone Items</h2>
              <Link to="/shoe-sales/items" className="text-[12px] font-semibold text-[#F2572B] hover:underline">Go to Items</Link>
            </div>
            {inactiveItems.length === 0 ? (
              <p className="text-[13px] text-[#7A7A7A] py-8 text-center">No inactive items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-[#1B1B1B] text-white">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Item</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">SKU</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#F0F0F0]">
                    {inactiveItems.map((it) => {
                      const id = it._id || it.id;
                      return (
                        <tr key={id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="px-5 py-3 text-[13px] font-semibold text-[#1B1B1B]">{it.itemName || "Untitled"}</td>
                          <td className="px-5 py-3 text-[13px] text-[#525252]">{it.sku || "-"}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => activateItem(id)}
                              disabled={saving}
                              className="inline-flex h-[34px] items-center px-4 rounded-[8px] bg-[#16A34A] hover:bg-[#15803D] text-[12px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              {saving ? "Activating..." : "Activate"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inactive Items from Groups */}
          <div className="rounded-[12px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0F0F0]">
              <h2 className="text-[14px] font-semibold text-[#1B1B1B]">Inactive Items from Groups</h2>
              <Link to="/shoe-sales/item-groups" className="text-[12px] font-semibold text-[#F2572B] hover:underline">Go to Groups</Link>
            </div>
            {inactiveItemsFromGroups.length === 0 ? (
              <p className="text-[13px] text-[#7A7A7A] py-8 text-center">No inactive items in groups.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-[#1B1B1B] text-white">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Item</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">SKU</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Group</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#F0F0F0]">
                    {inactiveItemsFromGroups.map((it) => {
                      const id = it._id || it.id;
                      return (
                        <tr key={id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="px-5 py-3 text-[13px] font-semibold text-[#1B1B1B]">{it.name || it.itemName || "Untitled"}</td>
                          <td className="px-5 py-3 text-[13px] text-[#525252]">{it.sku || "-"}</td>
                          <td className="px-5 py-3 text-[13px] text-[#525252]">{it.groupName}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => activateItemFromGroup(id, it.groupId)}
                              disabled={saving}
                              className="inline-flex h-[34px] items-center px-4 rounded-[8px] bg-[#16A34A] hover:bg-[#15803D] text-[12px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              {saving ? "Activating..." : "Activate"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inactive Vendors */}
          <div className="rounded-[12px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0F0F0]">
              <h2 className="text-[14px] font-semibold text-[#1B1B1B]">Inactive Vendors</h2>
              <Link to="/purchase/vendors" className="text-[12px] font-semibold text-[#F2572B] hover:underline">Go to Vendors</Link>
            </div>
            {inactiveVendors.length === 0 ? (
              <p className="text-[13px] text-[#7A7A7A] py-8 text-center">No inactive vendors.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-[#1B1B1B] text-white">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Vendor</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Contact</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">Phone</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#F0F0F0]">
                    {inactiveVendors.map((v) => {
                      const id = v._id || v.id;
                      return (
                        <tr key={id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="px-5 py-3 text-[13px] font-semibold text-[#1B1B1B]">{v.companyName || "Untitled"}</td>
                          <td className="px-5 py-3 text-[13px] text-[#525252]">{v.contactPerson || "-"}</td>
                          <td className="px-5 py-3 text-[13px] text-[#525252]">{v.phone || "-"}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => activateVendor(id)}
                              disabled={saving}
                              className="inline-flex h-[34px] items-center px-4 rounded-[8px] bg-[#16A34A] hover:bg-[#15803D] text-[12px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              {saving ? "Activating..." : "Activate"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InactiveItems;
