export const SYSTEM_ROLES = [
    { key: "super_admin",     label: "Super Admin",      legacyKeys: ["superadmin", "super_admin", "super admin"] },
    { key: "admin",           label: "Admin",            legacyKeys: ["admin"] },
    { key: "warehouse_admin", label: "Warehouse Admin",  legacyKeys: ["warehouse_admin", "warehouse admin", "warehouseadmin"] },
    { key: "financial_admin", label: "Financial Admin",  legacyKeys: ["financial_head", "financial_admin", "financial admin"] },
    { key: "cluster_admin",   label: "Cluster Admin",    legacyKeys: ["cluster_manager", "cluster_admin", "cluster admin"] },
    { key: "store_admin",     label: "Store Admin",      legacyKeys: ["store_manager", "store_admin", "store admin"] },
    { key: "normal_user",     label: "Normal User",      legacyKeys: ["store_user", "normal_user", "normal user", "normal"] }
];

export const normalizeRole = (role) => {
    if (!role) return "normal_user";
    const cleaned = role.toString().toLowerCase().trim().replace(/[\s-]+/g, "_");

    if (cleaned === "superadmin" || cleaned === "super_admin") return "super_admin";
    if (cleaned === "admin") return "admin";
    if (cleaned === "warehouseadmin" || cleaned === "warehouse_admin") return "warehouse_admin";
    if (cleaned === "financial_head" || cleaned === "financial_admin") return "financial_admin";
    if (cleaned === "cluster_manager" || cleaned === "cluster_admin") return "cluster_admin";
    if (cleaned === "store_manager" || cleaned === "store_admin") return "store_admin";
    if (cleaned === "store_user" || cleaned === "normal_user" || cleaned === "normal") return "normal_user";

    return cleaned;
};

export const getRoleLabel = (role) => {
    const normalized = normalizeRole(role);
    const found = SYSTEM_ROLES.find(r => r.key === normalized);
    return found ? found.label : (role ? String(role).toUpperCase() : "NORMAL USER");
};

export const isSuperAdmin = (user) => {
    if (!user) return false;
    const role = normalizeRole(user.role || user.power);
    return role === "super_admin";
};

export const isAdmin = (user) => {
    if (!user) return false;
    const role = normalizeRole(user.role || user.power);
    return role === "super_admin" || role === "admin" || role === "warehouse_admin";
};

/** Admin or Super Admin only (by role or legacy power field). */
export const isAdminOrSuperAdmin = (user) => {
    if (!user) return false;
    const role = normalizeRole(user.role);
    const power = normalizeRole(user.power);
    return role === "super_admin" || role === "admin" || power === "super_admin" || power === "admin";
};

export const isWarehouseAdmin = (user) => {
    if (!user) return false;
    return normalizeRole(user.role || user.power) === "warehouse_admin";
};

export const isClusterAdmin = (user) => {
    if (!user) return false;
    return normalizeRole(user.role || user.power) === "cluster_admin";
};

export const isStoreAdmin = (user) => {
    if (!user) return false;
    return normalizeRole(user.role || user.power) === "store_admin";
};

export const isFinancialAdmin = (user) => {
    if (!user) return false;
    return normalizeRole(user.role || user.power) === "financial_admin";
};
