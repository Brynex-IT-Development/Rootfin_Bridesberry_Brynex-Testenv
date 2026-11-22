import RolePermission from '../model/RolePermission.js';

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
    const normalized = (role || "").toLowerCase().trim().replace(/[\s-]+/g, "_");

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
        case "superadmin":
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
        case "financial_head":
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
        case "cluster_manager":
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
        case "store_manager":
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
        case "store_user":
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

const STANDARD_ROLES = ["super_admin", "admin", "financial_admin", "cluster_admin", "store_admin", "normal_user"];

// GET /api/permissions
export const GetAllRolePermissions = async (req, res) => {
    try {
        const docs = await RolePermission.find({});
        const permMap = {};

        // Prepopulate standard roles with defaults
        STANDARD_ROLES.forEach(r => {
            permMap[r] = getDefaultPermissionsForRole(r);
        });

        // Overlay with database records
        docs.forEach(doc => {
            if (doc.role && doc.permissions) {
                permMap[doc.role] = {
                    ...permMap[doc.role],
                    ...doc.permissions
                };
            }
        });

        res.status(200).json({
            success: true,
            permissions: permMap
        });
    } catch (error) {
        console.error("GetAllRolePermissions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve role permissions",
            error: error.message
        });
    }
};

// GET /api/permissions/:role
export const GetRolePermissions = async (req, res) => {
    try {
        const { role } = req.params;
        const normalized = (role || "").toLowerCase().trim().replace(/[\s-]+/g, "_");

        let doc = await RolePermission.findOne({ role: normalized });
        let permissions = doc ? doc.permissions : getDefaultPermissionsForRole(normalized);

        res.status(200).json({
            success: true,
            role: normalized,
            permissions: permissions
        });
    } catch (error) {
        console.error("GetRolePermissions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve permissions for role",
            error: error.message
        });
    }
};

// PUT /api/permissions/:role
export const UpdateRolePermissions = async (req, res) => {
    try {
        const { role } = req.params;
        const { permissions, updatedBy } = req.body;

        if (!permissions || typeof permissions !== 'object') {
            return res.status(400).json({
                success: false,
                message: "Permissions object is required"
            });
        }

        const normalized = (role || "").toLowerCase().trim().replace(/[\s-]+/g, "_");

        const updated = await RolePermission.findOneAndUpdate(
            { role: normalized },
            {
                $set: {
                    permissions: permissions,
                    updatedBy: updatedBy || "super_admin",
                    updatedAt: new Date()
                }
            },
            { new: true, upsert: true }
        );

        res.status(200).json({
            success: true,
            message: `Permissions updated successfully for ${normalized}`,
            data: updated
        });
    } catch (error) {
        console.error("UpdateRolePermissions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update role permissions",
            error: error.message
        });
    }
};

// POST /api/permissions/reset/:role
export const ResetRolePermissions = async (req, res) => {
    try {
        const { role } = req.params;
        const normalized = (role || "").toLowerCase().trim().replace(/[\s-]+/g, "_");

        const defaultPerms = getDefaultPermissionsForRole(normalized);

        const updated = await RolePermission.findOneAndUpdate(
            { role: normalized },
            {
                $set: {
                    permissions: defaultPerms,
                    updatedBy: "reset_to_default",
                    updatedAt: new Date()
                }
            },
            { new: true, upsert: true }
        );

        res.status(200).json({
            success: true,
            message: `Permissions reset to default for ${normalized}`,
            permissions: defaultPerms
        });
    } catch (error) {
        console.error("ResetRolePermissions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reset role permissions",
            error: error.message
        });
    }
};

// Aliases for compatibility
export const getAllPermissions = GetAllRolePermissions;
export const getRolePermissions = GetRolePermissions;
export const updateRolePermissions = UpdateRolePermissions;
export const resetRolePermissions = ResetRolePermissions;

