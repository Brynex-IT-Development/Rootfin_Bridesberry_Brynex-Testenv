import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    Save,
    RotateCcw,
    Check,
    ChevronDown,
    ChevronRight,
    FileText,
    ShoppingCart,
    Box,
    Truck,
    LineChart,
    DollarSign,
    Receipt,
    FolderClosed,
    Notebook,
    Users,
    Layers,
    CheckCircle2,
    AlertCircle,
    LayoutGrid,
    SlidersHorizontal,
    FileSpreadsheet
} from "lucide-react";
import {
    ALL_MODULE_DEFINITIONS,
    getDefaultPermissionsForRole,
    fetchAllPermissions,
    saveRolePermissions
} from "../utils/permissionService";
import { SYSTEM_ROLES, normalizeRole, isSuperAdmin } from "../utils/roleUtils";

const MODULE_ICONS = {
    daybook: FileText,
    financial_summary: FileSpreadsheet,
    sales: ShoppingCart,
    inventory: Box,
    purchase: Truck,
    reports: LineChart,
    income: DollarSign,
    record_expense: Receipt,
    expenses: DollarSign,
    late_closures: FolderClosed,
    close_report: FolderClosed,
    admin_close: Notebook,
    manage_users: Users
};

const Permissions = () => {
    const navigate = useNavigate();

    // Verify current user
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("rootfinuser") || localStorage.getItem("user") || "{}");
        } catch {
            return {};
        }
    });

    const isAuthorized = isSuperAdmin(currentUser);

    // Active View: "matrix" for full matrix, or role key ("super_admin", "admin", etc.)
    const [activeTab, setActiveTab] = useState("super_admin");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Expanded rows for multi-page modules
    const [expandedModules, setExpandedModules] = useState({
        sales: true,
        inventory: false,
        purchase: false,
        reports: false,
        manage_users: false
    });

    // Store all role permissions: { [roleKey]: { [moduleKey]: { enabled, subpages } } }
    const [allPermissions, setAllPermissions] = useState(() => {
        const initial = {};
        SYSTEM_ROLES.forEach(r => {
            initial[r.key] = getDefaultPermissionsForRole(r.key);
        });
        return initial;
    });

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem("rootfinuser") || localStorage.getItem("user") || "{}");
        setCurrentUser(user);

        const handleSidebarChange = (e) => {
            if (e.detail?.isOpen !== undefined) {
                setIsSidebarOpen(e.detail.isOpen);
            }
        };
        window.addEventListener("sidebar-changed", handleSidebarChange);

        const load = async () => {
            try {
                setLoading(true);
                const data = await fetchAllPermissions();
                if (data && typeof data === 'object') {
                    setAllPermissions(prev => {
                        const merged = { ...prev };
                        Object.keys(data).forEach(roleKey => {
                            merged[roleKey] = {
                                ...(prev[roleKey] || getDefaultPermissionsForRole(roleKey)),
                                ...data[roleKey]
                            };
                        });
                        return merged;
                    });
                }
            } catch (err) {
                console.error("Failed to load permissions:", err);
            } finally {
                setLoading(false);
            }
        };

        load();

        return () => window.removeEventListener("sidebar-changed", handleSidebarChange);
    }, []);

    // Toggle expand/collapse for a module's sub-pages
    const toggleModuleExpand = (modKey) => {
        setExpandedModules(prev => ({
            ...prev,
            [modKey]: !prev[modKey]
        }));
    };

    // Toggle entire module on/off for a specific role
    const handleToggleModule = (roleKey, moduleKey) => {
        const rolePerms = allPermissions[roleKey] || getDefaultPermissionsForRole(roleKey);
        const currentMod = rolePerms[moduleKey] || { enabled: false, subpages: [] };
        const willEnable = !currentMod.enabled;

        const modDef = ALL_MODULE_DEFINITIONS.find(m => m.key === moduleKey);
        let newSubpages = [];

        if (willEnable) {
            if (modDef?.isStandalone) {
                newSubpages = [modDef.path || `/${moduleKey}`];
            } else {
                newSubpages = (modDef?.subpages || []).map(s => s.path);
            }
        }

        const updatedRolePerms = {
            ...rolePerms,
            [moduleKey]: {
                enabled: willEnable,
                subpages: newSubpages
            }
        };

        if (moduleKey === "manage_users") {
            updatedRolePerms.manageUsers = updatedRolePerms[moduleKey];
        }

        setAllPermissions(prev => ({
            ...prev,
            [roleKey]: updatedRolePerms
        }));
    };

    // Toggle single subpage on/off for a specific role
    const handleToggleSubpage = (roleKey, moduleKey, subpagePath) => {
        const rolePerms = allPermissions[roleKey] || getDefaultPermissionsForRole(roleKey);
        const currentMod = rolePerms[moduleKey] || { enabled: false, subpages: [] };
        const currentSubpages = Array.isArray(currentMod.subpages) ? currentMod.subpages : [];

        let newSubpages;
        if (currentSubpages.includes(subpagePath)) {
            newSubpages = currentSubpages.filter(p => p !== subpagePath);
        } else {
            newSubpages = [...currentSubpages, subpagePath];
        }

        const updatedRolePerms = {
            ...rolePerms,
            [moduleKey]: {
                enabled: newSubpages.length > 0 ? true : currentMod.enabled,
                subpages: newSubpages
            }
        };

        if (moduleKey === "manage_users") {
            updatedRolePerms.manageUsers = updatedRolePerms[moduleKey];
        }

        setAllPermissions(prev => ({
            ...prev,
            [roleKey]: updatedRolePerms
        }));
    };

    // Select all subpages of a module for a role
    const handleSelectAllSubpages = (roleKey, moduleKey) => {
        const modDef = ALL_MODULE_DEFINITIONS.find(m => m.key === moduleKey);
        if (!modDef) return;

        const rolePerms = allPermissions[roleKey] || getDefaultPermissionsForRole(roleKey);
        const updatedRolePerms = {
            ...rolePerms,
            [moduleKey]: {
                enabled: true,
                subpages: modDef.subpages.map(s => s.path)
            }
        };

        if (moduleKey === "manage_users") {
            updatedRolePerms.manageUsers = updatedRolePerms[moduleKey];
        }

        setAllPermissions(prev => ({
            ...prev,
            [roleKey]: updatedRolePerms
        }));
    };

    // Deselect all subpages of a module for a role
    const handleDeselectAllSubpages = (roleKey, moduleKey) => {
        const rolePerms = allPermissions[roleKey] || getDefaultPermissionsForRole(roleKey);
        const updatedRolePerms = {
            ...rolePerms,
            [moduleKey]: {
                enabled: false,
                subpages: []
            }
        };

        if (moduleKey === "manage_users") {
            updatedRolePerms.manageUsers = updatedRolePerms[moduleKey];
        }

        setAllPermissions(prev => ({
            ...prev,
            [roleKey]: updatedRolePerms
        }));
    };

    // Reset permissions to default
    const handleResetDefaults = () => {
        if (activeTab === "matrix") {
            if (!window.confirm("Reset permissions for ALL roles to system defaults?")) return;
            const resetAll = {};
            SYSTEM_ROLES.forEach(r => {
                resetAll[r.key] = getDefaultPermissionsForRole(r.key);
            });
            setAllPermissions(resetAll);
        } else {
            if (!window.confirm(`Reset permissions for ${activeTab.replace('_', ' ').toUpperCase()} to system defaults?`)) return;
            const defaults = getDefaultPermissionsForRole(activeTab);
            setAllPermissions(prev => ({
                ...prev,
                [activeTab]: defaults
            }));
        }
    };

    // Save permissions
    const handleSave = async () => {
        setSaving(true);
        setErrorMessage("");
        setSaveSuccess(false);

        try {
            const adminUser = currentUser?.username || "super_admin";
            if (activeTab === "matrix") {
                // Save all roles
                for (const r of SYSTEM_ROLES) {
                    await saveRolePermissions(r.key, allPermissions[r.key], adminUser);
                }
            } else {
                // Save selected role
                await saveRolePermissions(activeTab, allPermissions[activeTab], adminUser);
            }
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3500);
        } catch (err) {
            setErrorMessage(err.message || "Failed to save permissions.");
        } finally {
            setSaving(false);
        }
    };

    if (!isAuthorized) {
        return <Navigate to="/" replace />;
    }

    const currentRolePerms = allPermissions[activeTab] || getDefaultPermissionsForRole(activeTab);

    return (
        <div className={`min-h-screen bg-[#f8fafc] transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "ml-0"}`}>
            <div className="max-w-7xl mx-auto px-6 py-8">
                
                {/* Header Bar */}
                <div className="bg-white px-8 py-5 rounded-xl shadow-sm border border-gray-200 mb-6 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900">Role Permissions</h1>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleResetDefaults}
                            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                            title="Reset permissions to system defaults"
                        >
                            <RotateCcw size={15} />
                            Reset Defaults
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`px-5 py-2 bg-[#a855f7] hover:bg-[#9333ea] text-white rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer ${
                                saving ? "opacity-75 cursor-not-allowed" : ""
                            }`}
                        >
                            {saving ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Saving...
                                </>
                            ) : saveSuccess ? (
                                <>
                                    <Check size={16} />
                                    Saved Lively!
                                </>
                            ) : (
                                <>
                                    <Save size={15} />
                                    Save Permissions
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                {saveSuccess && (
                    <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2.5 text-xs animate-fade-in font-medium">
                        <CheckCircle2 className="text-emerald-500 shrink-0" size={17} />
                        <span>Permissions saved successfully! Navigation for active users will update immediately.</span>
                    </div>
                )}

                {errorMessage && (
                    <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-2.5 text-xs animate-fade-in font-medium">
                        <AlertCircle className="text-red-500 shrink-0" size={17} />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Role Tabs Row */}
                <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 mb-6 flex overflow-x-auto gap-1 [scrollbar-width:none]">
                    {/* All Roles Matrix Option */}
                    <button
                        onClick={() => setActiveTab("matrix")}
                        className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                            activeTab === "matrix"
                                ? "bg-[#18181b] text-white shadow-sm"
                                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                        <LayoutGrid size={14} />
                        All Roles Matrix
                    </button>

                    <div className="w-[1px] bg-gray-200 my-1 mx-1 shrink-0" />

                    {/* Individual Roles */}
                    {SYSTEM_ROLES.map((r) => {
                        const isSelected = activeTab === r.key;
                        return (
                            <button
                                key={r.key}
                                onClick={() => setActiveTab(r.key)}
                                className={`flex-1 min-w-[125px] py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer text-center ${
                                    isSelected
                                        ? "bg-[#a855f7] text-white shadow-sm"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                }`}
                            >
                                {r.label}
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
                        <div className="w-8 h-8 border-3 border-[#a855f7] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-gray-500 text-xs">Loading permissions...</p>
                    </div>
                ) : activeTab === "matrix" ? (
                    /* ── ALL ROLES MATRIX TABLE VIEW ── */
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        <th className="py-3 px-4 min-w-[220px]">Module / Page</th>
                                        {SYSTEM_ROLES.map(r => (
                                            <th key={r.key} className="py-3 px-3 text-center min-w-[110px]">
                                                {r.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                    {ALL_MODULE_DEFINITIONS.map((moduleDef) => {
                                        const modKey = moduleDef.key;
                                        const IconComp = MODULE_ICONS[modKey] || Layers;
                                        const isExpanded = Boolean(expandedModules[modKey]);
                                        const hasSubpages = !moduleDef.isStandalone && moduleDef.subpages && moduleDef.subpages.length > 0;

                                        return (
                                            <React.Fragment key={modKey}>
                                                {/* Parent Module Row */}
                                                <tr className="hover:bg-purple-50/30 transition-colors">
                                                    <td className="py-3 px-4 font-semibold text-gray-800">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="p-1.5 rounded-lg bg-gray-100 text-gray-700">
                                                                    <IconComp size={16} />
                                                                </div>
                                                                <span>{moduleDef.label}</span>
                                                            </div>
                                                            {hasSubpages && (
                                                                <button
                                                                    onClick={() => toggleModuleExpand(modKey)}
                                                                    className="flex items-center gap-1 text-[11px] text-[#a855f7] hover:underline font-normal cursor-pointer py-0.5 px-1.5 rounded hover:bg-purple-50"
                                                                >
                                                                    <span>{moduleDef.subpages.length} sub-pages</span>
                                                                    <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Role Checkboxes for this module */}
                                                    {SYSTEM_ROLES.map(role => {
                                                        const rolePerms = allPermissions[role.key] || getDefaultPermissionsForRole(role.key);
                                                        const modPerm = rolePerms[modKey] || { enabled: false, subpages: [] };
                                                        const isChecked = Boolean(modPerm.enabled);

                                                        return (
                                                            <td key={role.key} className="py-3 px-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => handleToggleModule(role.key, modKey)}
                                                                    className="w-4 h-4 text-[#a855f7] rounded border-gray-300 focus:ring-purple-500 cursor-pointer accent-[#a855f7]"
                                                                    title={`${isChecked ? "Disable" : "Enable"} ${moduleDef.label} for ${role.label}`}
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Sub-pages child rows if expanded */}
                                                {hasSubpages && isExpanded && moduleDef.subpages.map(subpage => (
                                                    <tr key={subpage.path} className="bg-gray-50/60 hover:bg-purple-50/40 border-b border-gray-100">
                                                        <td className="py-2 px-4 pl-12 text-gray-600 font-normal">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-300">↳</span>
                                                                <span>{subpage.label}</span>
                                                                <span className="text-[10px] text-gray-400 font-mono">({subpage.path})</span>
                                                            </div>
                                                        </td>
                                                        {SYSTEM_ROLES.map(role => {
                                                            const rolePerms = allPermissions[role.key] || getDefaultPermissionsForRole(role.key);
                                                            const modPerm = rolePerms[modKey] || { enabled: false, subpages: [] };
                                                            const isChecked = Array.isArray(modPerm.subpages) && modPerm.subpages.includes(subpage.path);

                                                            return (
                                                                <td key={role.key} className="py-2 px-3 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => handleToggleSubpage(role.key, modKey, subpage.path)}
                                                                        className="w-3.5 h-3.5 rounded border-gray-300 focus:ring-purple-500 accent-[#a855f7] cursor-pointer"
                                                                        title={`${subpage.label} for ${role.label}`}
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* ── SINGLE ROLE TABLE VIEW (COLUMNS AND ROWS) ── */
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-3.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Permissions for role: <span className="text-[#a855f7]">{activeTab.replace('_', ' ').toUpperCase()}</span>
                            </span>
                            <span className="text-xs text-gray-400">
                                Click checkbox to open/close module. Open dropdown to toggle inside sub-pages.
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        <th className="py-3 px-4 w-12 text-center">#</th>
                                        <th className="py-3 px-4 min-w-[200px]">Module</th>
                                        <th className="py-3 px-4 w-40">Access</th>
                                        <th className="py-3 px-4">Sub-pages & Screens</th>
                                        <th className="py-3 px-4 w-32 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                    {ALL_MODULE_DEFINITIONS.map((moduleDef, idx) => {
                                        const modKey = moduleDef.key;
                                        const modPerm = currentRolePerms[modKey] || { enabled: false, subpages: [] };
                                        const isModuleEnabled = Boolean(modPerm.enabled);
                                        const allowedSubpages = Array.isArray(modPerm.subpages) ? modPerm.subpages : [];
                                        const isExpanded = Boolean(expandedModules[modKey]);
                                        const hasSubpages = !moduleDef.isStandalone && moduleDef.subpages && moduleDef.subpages.length > 0;
                                        const IconComp = MODULE_ICONS[modKey] || Layers;

                                        return (
                                            <tr key={modKey} className={`hover:bg-purple-50/20 transition-colors ${!isModuleEnabled ? "bg-gray-50/30 opacity-75" : ""}`}>
                                                {/* # */}
                                                <td className="py-3.5 px-4 text-center text-gray-400 font-mono text-[11px]">
                                                    {idx + 1}
                                                </td>

                                                {/* Module Name + Icon */}
                                                <td className="py-3.5 px-4 font-semibold text-gray-800">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`p-1.5 rounded-lg shrink-0 ${isModuleEnabled ? "bg-purple-100 text-[#a855f7]" : "bg-gray-100 text-gray-400"}`}>
                                                            <IconComp size={16} />
                                                        </div>
                                                        <span className={isModuleEnabled ? "text-gray-900" : "text-gray-500"}>
                                                            {moduleDef.label}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Access Checkbox */}
                                                <td className="py-3.5 px-4">
                                                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={isModuleEnabled}
                                                            onChange={() => handleToggleModule(activeTab, modKey)}
                                                            className="w-4 h-4 text-[#a855f7] rounded border-gray-300 focus:ring-purple-500 cursor-pointer accent-[#a855f7]"
                                                        />
                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                                                            isModuleEnabled ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"
                                                        }`}>
                                                            {isModuleEnabled ? "Open" : "Blocked"}
                                                        </span>
                                                    </label>
                                                </td>

                                                {/* Sub-pages Dropdown & Checkboxes */}
                                                <td className="py-3.5 px-4">
                                                    {moduleDef.isStandalone ? (
                                                        <span className="text-[11px] text-gray-400 italic">
                                                            Standalone Module (Direct screen: {moduleDef.path})
                                                        </span>
                                                    ) : (
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => toggleModuleExpand(modKey)}
                                                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                                                                        isExpanded 
                                                                            ? "bg-purple-50 text-[#a855f7] border-purple-200" 
                                                                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                                                    }`}
                                                                >
                                                                    <span>
                                                                        {allowedSubpages.length}/{moduleDef.subpages.length} sub-pages active
                                                                    </span>
                                                                    <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                                                </button>
                                                            </div>

                                                            {/* Dropdown list of inside sub-pages */}
                                                            {isExpanded && (
                                                                <div className="mt-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {moduleDef.subpages.map(sub => {
                                                                        const isChecked = allowedSubpages.includes(sub.path);
                                                                        return (
                                                                            <label
                                                                                key={sub.path}
                                                                                className={`flex items-center gap-2 p-2 rounded-lg border transition-colors select-none cursor-pointer ${
                                                                                    isChecked 
                                                                                        ? "bg-purple-50/50 border-purple-200 text-gray-800 shadow-2xs" 
                                                                                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                                                                                }`}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={() => handleToggleSubpage(activeTab, modKey, sub.path)}
                                                                                    className="w-3.5 h-3.5 text-[#a855f7] rounded border-gray-300 focus:ring-purple-500 accent-[#a855f7] cursor-pointer"
                                                                                />
                                                                                <span className={`text-xs truncate ${isChecked ? "font-medium text-gray-800" : "text-gray-500"}`}>
                                                                                    {sub.label}
                                                                                </span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 px-4 text-right">
                                                    {hasSubpages ? (
                                                        <div className="flex items-center justify-end gap-1.5 text-[11px]">
                                                            <button
                                                                onClick={() => handleSelectAllSubpages(activeTab, modKey)}
                                                                className="text-[#a855f7] hover:underline cursor-pointer font-medium"
                                                            >
                                                                All
                                                            </button>
                                                            <span className="text-gray-300">|</span>
                                                            <button
                                                                onClick={() => handleDeselectAllSubpages(activeTab, modKey)}
                                                                className="text-gray-400 hover:text-gray-600 hover:underline cursor-pointer"
                                                            >
                                                                Clear
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Permissions;
