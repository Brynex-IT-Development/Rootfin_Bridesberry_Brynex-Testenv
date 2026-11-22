import { useState, useEffect } from "react";
import baseUrl from "../api/api";
import { normalizeRole, isSuperAdmin } from "./roleUtils";

export const ALL_MODULE_DEFINITIONS = [
    {
        key: "daybook",
        label: "Day Book",
        isStandalone: true,
        path: "/",
        subpages: [
            { path: "/", label: "Day Book" }
        ]
    },
    {
        key: "financial_summary",
        label: "Financial Summary",
        isStandalone: true,
        path: "/datewisedaybook",
        subpages: [
            { path: "/datewisedaybook", label: "Financial Summary" }
        ]
    },
    {
        key: "sales",
        label: "Sales",
        isStandalone: false,
        subpages: [
            { path: "/sales/invoices", label: "Invoices" },
            { path: "/sales/returns", label: "Invoice Return" }
        ]
    },
    {
        key: "inventory",
        label: "Inventory",
        isStandalone: false,
        subpages: [
            { path: "/shoe-sales/items", label: "Items" },
            { path: "/shoe-sales/item-groups", label: "Item Groups" },
            { path: "/inventory/adjustments", label: "Inventory Adjustments" },
            { path: "/inventory/transfer-orders", label: "Transfer Orders" },
            { path: "/inventory/store-orders", label: "Store Orders" },
            { path: "/inventory/reorder-alerts", label: "Reorder Alerts" },
            { path: "/shoe-sales/inactive", label: "Inactive Items" }
        ]
    },
    {
        key: "purchase",
        label: "Purchase",
        isStandalone: false,
        subpages: [
            { path: "/purchase/orders", label: "Purchase Orders" },
            { path: "/purchase/receives", label: "Purchase Receives" },
            { path: "/purchase/bills", label: "Bills" },
            { path: "/purchase/vendor-credits", label: "Purchase Return" },
            { path: "/purchase/vendors", label: "Vendors" }
        ]
    },
    {
        key: "reports",
        label: "Reports",
        isStandalone: false,
        subpages: [
            { path: "/BookingReport", label: "Booking Report" },
            { path: "/RentOutReport", label: "Rent Out Report" },
            { path: "/securityReport", label: "Security Report" },
            { path: "/Revenuereport", label: "Revenue Report" },
            { path: "/reports/sales-by-invoice", label: "Sales by Invoice" },
            { path: "/reports/sales", label: "Sales Report" },
            { path: "/reports/sales-by-group", label: "Sales by Group" },
            { path: "/reports/inventory", label: "Inventory Report" },
            { path: "/reports/aging", label: "Aging Report" },
            { path: "/reports/income-expense", label: "Income & Expense" }
        ]
    },
    {
        key: "income",
        label: "Income",
        isStandalone: true,
        path: "/income",
        subpages: [
            { path: "/income", label: "Income" }
        ]
    },
    {
        key: "record_expense",
        label: "Record Expense",
        isStandalone: true,
        path: "/record-expense",
        subpages: [
            { path: "/record-expense", label: "Record Expense" }
        ]
    },
    {
        key: "expenses",
        label: "Expenses",
        isStandalone: true,
        path: "/expenses",
        subpages: [
            { path: "/expenses", label: "Expenses" }
        ]
    },
    {
        key: "late_closures",
        label: "Late Closures",
        isStandalone: true,
        path: "/pending-closures",
        subpages: [
            { path: "/pending-closures", label: "Late Closures" }
        ]
    },
    {
        key: "close_report",
        label: "Close Report",
        isStandalone: true,
        path: "/CloseReport",
        subpages: [
            { path: "/CloseReport", label: "Close Report" }
        ]
    },
    {
        key: "admin_close",
        label: "Admin Close",
        isStandalone: true,
        path: "/AdminClose",
        subpages: [
            { path: "/AdminClose", label: "Admin Close" }
        ]
    },
    {
        key: "manage_users",
        label: "Manage Users",
        isStandalone: false,
        subpages: [
            { path: "/manage-users/add-user", label: "Add New User" },
            { path: "/manage-users/existing-users", label: "Existing Users" },
            { path: "/manage-users/reset-password", label: "Reset Password" },
            { path: "/manage-users/permissions", label: "Permissions (Super Admin Only)" }
        ]
    }
];

export const getDefaultPermissionsForRole = (role) => {
    const normalized = normalizeRole(role);

    const fullModule = (key, excludePaths = []) => {
        const mod = ALL_MODULE_DEFINITIONS.find(m => m.key === key);
        if (!mod) return { enabled: true, subpages: [] };
        return {
            enabled: true,
            subpages: mod.subpages.map(s => s.path).filter(p => !excludePaths.includes(p))
        };
    };

    const standaloneEnabled = (path) => ({ enabled: true, subpages: [path] });
    const standaloneDisabled = (path) => ({ enabled: false, subpages: [path] });
    const disabledModule = () => ({ enabled: false, subpages: [] });

    switch (normalized) {
        case "super_admin":
            return {
                daybook: standaloneEnabled("/"),
                financial_summary: standaloneEnabled("/datewisedaybook"),
                sales: fullModule("sales"),
                inventory: fullModule("inventory"),
                purchase: fullModule("purchase"),
                reports: fullModule("reports"),
                income: standaloneEnabled("/income"),
                record_expense: standaloneEnabled("/record-expense"),
                expenses: standaloneEnabled("/expenses"),
                late_closures: standaloneEnabled("/pending-closures"),
                close_report: standaloneEnabled("/CloseReport"),
                admin_close: standaloneEnabled("/AdminClose"),
                manage_users: fullModule("manage_users"),
                manageUsers: fullModule("manage_users")
            };

        case "warehouse_admin":
        case "admin":
            return {
                daybook: standaloneEnabled("/"),
                financial_summary: standaloneEnabled("/datewisedaybook"),
                sales: fullModule("sales"),
                inventory: fullModule("inventory"),
                purchase: fullModule("purchase"),
                reports: fullModule("reports"),
                income: standaloneEnabled("/income"),
                record_expense: standaloneEnabled("/record-expense"),
                expenses: standaloneEnabled("/expenses"),
                late_closures: standaloneEnabled("/pending-closures"),
                close_report: standaloneEnabled("/CloseReport"),
                admin_close: standaloneEnabled("/AdminClose"),
                manage_users: fullModule("manage_users", ["/manage-users/permissions"]),
                manageUsers: fullModule("manage_users", ["/manage-users/permissions"])
            };

        case "financial_admin":
            return {
                daybook: standaloneEnabled("/"),
                financial_summary: standaloneEnabled("/datewisedaybook"),
                sales: disabledModule(),
                inventory: disabledModule(),
                purchase: disabledModule(),
                reports: fullModule("reports"),
                income: standaloneEnabled("/income"),
                record_expense: standaloneEnabled("/record-expense"),
                expenses: standaloneEnabled("/expenses"),
                late_closures: standaloneEnabled("/pending-closures"),
                close_report: standaloneEnabled("/CloseReport"),
                admin_close: standaloneEnabled("/AdminClose"),
                manage_users: disabledModule(),
                manageUsers: disabledModule()
            };

        case "cluster_admin":
            return {
                daybook: standaloneDisabled("/"),
                financial_summary: standaloneEnabled("/datewisedaybook"),
                sales: disabledModule(),
                inventory: disabledModule(),
                purchase: disabledModule(),
                reports: fullModule("reports"),
                income: standaloneDisabled("/income"),
                record_expense: standaloneDisabled("/record-expense"),
                expenses: standaloneDisabled("/expenses"),
                late_closures: standaloneDisabled("/pending-closures"),
                close_report: standaloneDisabled("/CloseReport"),
                admin_close: standaloneDisabled("/AdminClose"),
                manage_users: disabledModule(),
                manageUsers: disabledModule()
            };

        case "store_admin":
            return {
                daybook: standaloneEnabled("/"),
                financial_summary: standaloneDisabled("/datewisedaybook"),
                sales: fullModule("sales"),
                inventory: {
                    enabled: true,
                    subpages: [
                        "/shoe-sales/items",
                        "/shoe-sales/item-groups",
                        "/inventory/transfer-orders",
                        "/inventory/store-orders"
                    ]
                },
                purchase: disabledModule(),
                reports: {
                    enabled: true,
                    subpages: [
                        "/BookingReport",
                        "/RentOutReport",
                        "/securityReport",
                        "/Revenuereport",
                        "/reports/income-expense"
                    ]
                },
                income: standaloneEnabled("/income"),
                record_expense: standaloneDisabled("/record-expense"),
                expenses: standaloneEnabled("/expenses"),
                late_closures: standaloneDisabled("/pending-closures"),
                close_report: standaloneDisabled("/CloseReport"),
                admin_close: standaloneDisabled("/AdminClose"),
                manage_users: disabledModule(),
                manageUsers: disabledModule()
            };

        case "normal_user":
        default:
            return {
                daybook: standaloneEnabled("/"),
                financial_summary: standaloneDisabled("/datewisedaybook"),
                sales: {
                    enabled: true,
                    subpages: ["/sales/invoices"]
                },
                inventory: {
                    enabled: true,
                    subpages: [
                        "/shoe-sales/items",
                        "/shoe-sales/item-groups"
                    ]
                },
                purchase: disabledModule(),
                reports: {
                    enabled: true,
                    subpages: [
                        "/BookingReport",
                        "/RentOutReport",
                        "/securityReport"
                    ]
                },
                income: standaloneEnabled("/income"),
                record_expense: standaloneDisabled("/record-expense"),
                expenses: standaloneEnabled("/expenses"),
                late_closures: standaloneDisabled("/pending-closures"),
                close_report: standaloneDisabled("/CloseReport"),
                admin_close: standaloneDisabled("/AdminClose"),
                manage_users: disabledModule(),
                manageUsers: disabledModule()
            };
    }
};

const CACHE_KEY = "rootfin_role_permissions";

export const getCachedPermissions = () => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        // ignore JSON parse error
    }
    return null;
};

export const fetchAllPermissions = async () => {
    const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
    try {
        const res = await fetch(`${API_URL}/api/permissions`);
        if (res.ok) {
            const data = await res.json();
            if (data.permissions) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(data.permissions));
                window.dispatchEvent(new CustomEvent("rootfin-permissions-updated", { detail: data.permissions }));
                return data.permissions;
            }
        }
    } catch (err) {
        console.warn("Could not fetch permissions from server, using local defaults:", err.message);
    }
    return getCachedPermissions();
};

export const saveRolePermissions = async (role, permissions, updatedBy = "super_admin") => {
    const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
    const normalized = normalizeRole(role);

    try {
        const res = await fetch(`${API_URL}/api/permissions/${normalized}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permissions, updatedBy })
        });

        // Update local cache regardless
        const currentCache = getCachedPermissions() || {};
        currentCache[normalized] = permissions;
        localStorage.setItem(CACHE_KEY, JSON.stringify(currentCache));
        window.dispatchEvent(new CustomEvent("rootfin-permissions-updated", { detail: currentCache }));

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || "Failed to update permissions on server");
        }

        return true;
    } catch (err) {
        console.error("saveRolePermissions error:", err);
        throw err;
    }
};

export const hasModuleAccess = (user, moduleKey) => {
    if (!user) return false;
    if (isSuperAdmin(user)) return true;

    const role = normalizeRole(user.role);
    const cached = getCachedPermissions();
    const rolePerms = cached?.[role] || getDefaultPermissionsForRole(role);

    // Support alias keys
    const normalizedKey = moduleKey === "manageUsers" ? "manage_users" : moduleKey;

    // Check direct module permission
    if (rolePerms?.[normalizedKey] !== undefined) {
        return Boolean(rolePerms[normalizedKey]?.enabled);
    }
    if (rolePerms?.[moduleKey] !== undefined) {
        return Boolean(rolePerms[moduleKey]?.enabled);
    }

    // Backwards compatibility for financial_summary from legacy daybook
    if (normalizedKey === "financial_summary") {
        const daybook = rolePerms?.daybook;
        if (daybook?.enabled && Array.isArray(daybook.subpages)) {
            return daybook.subpages.includes("/datewisedaybook");
        }
    }

    // Backwards compatibility for standalone finance keys from legacy finance
    const standaloneFinanceKeys = ["income", "record_expense", "expenses", "late_closures", "close_report", "admin_close"];
    if (standaloneFinanceKeys.includes(normalizedKey)) {
        const finance = rolePerms?.finance;
        if (finance?.enabled) {
            const pathMap = {
                income: "/income",
                record_expense: "/record-expense",
                expenses: "/expenses",
                late_closures: "/pending-closures",
                close_report: "/CloseReport",
                admin_close: "/AdminClose"
            };
            const p = pathMap[normalizedKey];
            if (p && Array.isArray(finance.subpages) && finance.subpages.includes(p)) return true;
        }
    }

    return false;
};

export const hasSubpageAccess = (user, path) => {
    if (!user) return false;
    if (isSuperAdmin(user)) return true;

    // Special rule: Permissions page can ONLY be accessed by super admin
    if (path === "/manage-users/permissions") {
        return isSuperAdmin(user);
    }

    const role = normalizeRole(user.role);
    const cached = getCachedPermissions();
    const rolePerms = cached?.[role] || getDefaultPermissionsForRole(role);

    // Find which module contains this path
    for (const modDef of ALL_MODULE_DEFINITIONS) {
        const sub = modDef.subpages.find(s => s.path === path || path.startsWith(s.path + "/"));
        if (sub) {
            const modPerm = rolePerms?.[modDef.key] || (modDef.key === "manage_users" ? rolePerms?.manageUsers : undefined);
            if (!modPerm || !modPerm.enabled) return false;
            if (Array.isArray(modPerm.subpages)) {
                return modPerm.subpages.includes(sub.path);
            }
            return true;
        }
    }

    // Fallback: check legacy daybook module
    if (path === "/datewisedaybook" && rolePerms?.daybook?.enabled && rolePerms?.daybook?.subpages?.includes("/datewisedaybook")) {
        return true;
    }

    // Fallback: check legacy finance module
    const legacyFinance = rolePerms?.finance;
    if (legacyFinance?.enabled && Array.isArray(legacyFinance.subpages)) {
        if (legacyFinance.subpages.includes(path)) return true;
    }

    // Default allow for paths not governed by modules
    return true;
};

export const usePermissions = (user) => {
    const [permissions, setPermissions] = useState(() => getCachedPermissions() || {});

    useEffect(() => {
        fetchAllPermissions().then(data => {
            if (data) setPermissions(data);
        });

        const handleUpdate = (e) => {
            if (e.detail) {
                setPermissions(e.detail);
            }
        };

        window.addEventListener("rootfin-permissions-updated", handleUpdate);
        return () => window.removeEventListener("rootfin-permissions-updated", handleUpdate);
    }, []);

    const role = normalizeRole(user?.role);
    const activeRolePerms = permissions[role] || getDefaultPermissionsForRole(role);

    return {
        allPermissions: permissions,
        rolePermissions: activeRolePerms,
        hasModule: (modKey) => hasModuleAccess(user, modKey),
        hasSubpage: (path) => hasSubpageAccess(user, path),
        isSuperAdminUser: isSuperAdmin(user)
    };
};
