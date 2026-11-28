import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import rootfinLogoText from "../assets/rootfin-logo-text.png";
import rootfinLogoArrow from "../assets/rootfin-logo-arrow.png";
import {
    ChevronDown,
    ChevronLeft,
    LineChart,
    DollarSign,
    FolderClosed,
    Box,
    SlidersHorizontal,
    ArrowLeftRight,
    List,
    Layers,
    ShoppingCart,
    ClipboardList,
    FileText as FileTextIcon,
    Truck,
    RotateCcw,
    ReceiptText,
    Users,
    PackageCheck,
    AlertTriangle,
    ShoppingBasket,
    UserPlus,
    UserCog,
    KeyRound,
    Menu,
    ShieldCheck,
    CreditCard,
    BookOpen,
    LayoutDashboard,
    TrendingUp
} from "lucide-react";
import salesInventoryAccessConfig from "../config/salesInventoryAccess.json";
import { usePermissions } from "../utils/permissionService";
import { useHiddenPages } from "../utils/subscriptionPages";
import { isSuperAdmin, normalizeRole, getRoleLabel, isAdminOrSuperAdmin } from "../utils/roleUtils";
import { findStore, isWarehouseStore } from "../utils/storeService";

const Nav = () => {
    const location = useLocation();
    const currentuser = JSON.parse(localStorage.getItem("rootfinuser")); // Convert back to an object

    // Check user roles and access control
    const userRole = (currentuser?.role || "").toLowerCase().trim();
    const userPower = (currentuser?.power || "").toLowerCase().trim();
    const userEmail = currentuser?.email?.toLowerCase().trim() || "";
    const userLocCode = (currentuser?.locCode || "").toString().trim();


    // Main system administrator - ALWAYS full admin access
    const isAdmin = 
        userRole === 'admin' || 
        userRole === 'warehouse_admin' ||
        userRole === 'super_admin' || 
        userRole === 'superadmin' ||
        userPower === 'admin' ||
        userPower === 'super_admin' ||
        isAdminOrSuperAdmin(currentuser);

    // Warehouse staff (central operations): warehouse role, or a warehouse-type store from the backend
    const isWarehouse = 
        userRole === 'warehouse_admin' ||
        (Boolean(userLocCode) && isWarehouseStore(userLocCode));
    
    // Cluster Admin / Cluster Manager (NEVER if main admin)
    const isClusterAdmin = !isAdmin && (
        userRole === "cluster_manager" || 
        userRole === "cluster_admin" || 
        userRole.includes("cluster")
    );
    const isClusterManager = isClusterAdmin;

    // Store Admin / Store Manager / Store User (NEVER if main admin or warehouse)
    const isStoreAdmin = !isAdmin && !isWarehouse && (
        userRole === "store_manager" || 
        userRole === "store_admin" || 
        userRole === "store_user" ||
        Boolean(currentuser?.storeName) ||
        Boolean(currentuser?.storeId) ||
        Boolean(userLocCode)
    );

    const isStoreOrClusterAdmin = isClusterAdmin || isStoreAdmin;

    // Restricted modules: Inventory Adjustments, Purchase Module, Reorder Alerts, Inactive
    // Must be visible to Admin and Warehouse.
    // NEVER visible to Store Admin or Cluster Admin.
    const canAccessAdminRestrictedModules = (isAdmin || isWarehouse) && !isClusterAdmin;

    const isInAllowedList = salesInventoryAccessConfig.allowedEmails
        .map(email => email.toLowerCase())
        .includes(userEmail);
    // Store and warehouse users of backend stores get Sales/Inventory (subject to module permissions)
    const hasSalesInventoryAccess = isAdmin || isInAllowedList || isStoreAdmin || isWarehouse;

    const activePath = location.pathname;

    const { hasModule, hasSubpage, isSuperAdminUser } = usePermissions(currentuser);
    // Pages hidden by the subscription are hidden for everyone, admins included
    const { isHidden: isHiddenBySubscription } = useHiddenPages();

    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
        };
        if (showUserMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showUserMenu]);

    const handleLogout = () => {
        try {
            localStorage.removeItem("rootfinuser");
            localStorage.removeItem("rootfin_auth_token");
            window.location.reload();
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const isSuper = isSuperAdmin(currentuser);
    // Username is just a store name (from the backend store list), not a person
    const isLocationName = Boolean(findStore(currentuser?.username));
    const userDisplayName = isSuper ? "Brynex Admin" : ((!isLocationName && currentuser?.username) || currentuser?.name || (isAdmin ? "Brynex Admin" : "User"));
    const userEmailDisplay = currentuser?.email || "admin@gmail.com";
    const getUserRoleTitle = () => {
        if (isSuperAdmin(currentuser)) return "Super Administrator";
        if (isAdmin) return "Administrator";
        return getRoleLabel(currentuser?.role);
    };

    // ── Sidebar layout state ──
    // Desktop (lg+): a 76px icon rail that expands to 256px on hover, overlaying the page.
    // Mobile/tablet: an off-canvas drawer opened from a floating menu button.
    const DESKTOP_QUERY = "(min-width: 1024px)";
    const [isDesktop, setIsDesktop] = useState(() =>
        typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches
    );
    const [isHovered, setIsHovered] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia(DESKTOP_QUERY);
        const handleChange = (e) => {
            setIsDesktop(e.matches);
            if (e.matches) setMobileOpen(false);
            else setIsHovered(false);
        };
        mq.addEventListener("change", handleChange);
        return () => mq.removeEventListener("change", handleChange);
    }, []);

    // Pages size themselves from the `sidebar-open` body class (they render ml-[240px]);
    // index.css remaps that offset to the 76px rail on desktop and 0 on mobile.
    useEffect(() => {
        document.body.classList.add("sidebar-open");
        document.body.classList.remove("sidebar-closed");
        window.dispatchEvent(new CustomEvent("sidebar-changed", { detail: { isOpen: true } }));
    }, []);

    // Close the drawer after navigating.
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    // Lock body scroll and allow Escape while the drawer is open.
    useEffect(() => {
        if (!mobileOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const handleKey = (e) => { if (e.key === "Escape") setMobileOpen(false); };
        document.addEventListener("keydown", handleKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener("keydown", handleKey);
        };
    }, [mobileOpen]);

    // The drawer is always full width; the desktop rail expands on hover
    // (and stays expanded while the profile popover is open).
    const expanded = isDesktop ? (isHovered || showUserMenu) : true;

    const getInitialSection = useMemo(() => {
        if (activePath === "/reports/sales" || activePath === "/reports/sales-by-invoice" || activePath === "/reports/inventory" || activePath === "/reports/income-expense" || activePath === "/reports/sales-by-group") {
            return "reports";
        }
        if (activePath.startsWith("/inventory") ||
            activePath.startsWith("/shoe-sales/items") ||
            activePath.startsWith("/shoe-sales/item-groups") ||
            activePath.startsWith("/shoe-sales/inactive")) {
            return "inventory";
        }
        if (activePath.startsWith("/sales")) {
            return "sales";
        }
        if (activePath.startsWith("/purchase")) {
            return "purchase";
        }
        if (activePath.startsWith("/manage-users")) {
            return "manageUsers";
        }
        return null;
    }, [activePath]);

    const [openSection, setOpenSection] = useState(getInitialSection);

    useEffect(() => {
        setOpenSection(getInitialSection);
    }, [getInitialSection]);

    const isReportsOpen = openSection === "reports";
    const allowAllSubpages = isAdmin || isSuper;
    const checkSubpage = (path) => !isHiddenBySubscription(path) && (allowAllSubpages || hasSubpage(path));

    const isInventoryOpen = openSection === "inventory";
    const isSalesOpen = openSection === "sales";
    const isPurchaseOpen = openSection === "purchase";
    const isManageUsersOpen = openSection === "manageUsers";

    const inventoryLinks = [
        { to: "/shoe-sales/items", label: "Items", Icon: List },
        { to: "/shoe-sales/item-groups", label: "Item Groups", Icon: Layers },
        // Inventory Adjustments: NEVER visible to Store Admin or Cluster Admin
        ...(canAccessAdminRestrictedModules ? [
            { to: "/inventory/adjustments", label: "Inventory Adjustments", Icon: SlidersHorizontal },
        ] : []),
        { to: "/inventory/transfer-orders", label: "Transfer Orders", Icon: ArrowLeftRight },
        { to: "/inventory/store-orders", label: "Store Orders", Icon: ShoppingBasket },
        // Reorder Alerts and Inactive: NEVER visible to Store Admin or Cluster Admin
        ...(canAccessAdminRestrictedModules ? [
            { to: "/inventory/reorder-alerts", label: "Reorder Alerts", Icon: AlertTriangle },
            { to: "/shoe-sales/inactive", label: "Inactive", Icon: FolderClosed }
        ] : [])
    ].filter(link => checkSubpage(link.to));

    const salesLinks = [
        { to: "/sales/invoices", label: "Invoices", Icon: FileTextIcon },
        { to: "/sales/returns", label: "Invoice Return", Icon: RotateCcw }
    ].filter(link => checkSubpage(link.to));

    const isInventoryActive = inventoryLinks.some((link) => link.to === activePath) ||
                               activePath.startsWith("/shoe-sales/items") ||
                               activePath.startsWith("/shoe-sales/item-groups") ||
                               (canAccessAdminRestrictedModules && activePath.startsWith("/shoe-sales/inactive")) ||
                               activePath.startsWith("/inventory/store-orders") ||
                               activePath.startsWith("/inventory/transfer-orders");
    const isSalesActive = salesLinks.some((link) => link.to === activePath);
    const purchaseLinks = [
        { to: "/purchase/orders", label: "Purchase Orders", Icon: ClipboardList },
        { to: "/purchase/receives", label: "Purchase Receives", Icon: PackageCheck },
        { to: "/purchase/bills", label: "Bills", Icon: ReceiptText },
        { to: "/purchase/vendor-credits", label: "Purchase Return", Icon: ReceiptText },
        { to: "/purchase/vendors", label: "Vendors", Icon: Users },
    ].filter(link => checkSubpage(link.to));
    const isPurchaseActive = purchaseLinks.some((link) => link.to === activePath);
    
    const manageUsersLinks = [
        ...(isSuperAdminUser ? [
            { to: "/manage-users/permissions", label: "Permissions", Icon: ShieldCheck },
            { to: "/manage-users/subscription", label: "Subscription", Icon: CreditCard },
        ] : []),
        { to: "/manage-users/add-user", label: "Add New User", Icon: UserPlus },
        { to: "/manage-users/existing-users", label: "Existing Users", Icon: UserCog },
        { to: "/manage-users/reset-password", label: "Reset Password", Icon: KeyRound },
    ].filter(link => checkSubpage(link.to));
    const isManageUsersActive = manageUsersLinks.some((link) => link.to === activePath);

    const reportsLinks = [
        ...(hasSalesInventoryAccess ? [
            { to: "/reports/sales-by-invoice", label: "Sales by Invoice" },
            { to: "/reports/sales", label: "Sales Report" },
            { to: "/reports/sales-by-group", label: "Sales by Group" },
            { to: "/reports/inventory", label: "Inventory Report" },
            { to: "/reports/aging", label: "Aging Report" },
        ] : []),
        { to: "/reports/income-expense", label: "Income & Expense" }
    ].filter(link => checkSubpage(link.to));
    const isReportsActive = reportsLinks.some((link) => link.to === activePath);

    const isLinkActive = (path) => {
        if (path === "/") return activePath === "/" || activePath === "";
        if (path === "/record-expense") {
            return ["/record-expense", "/record-expenses", "/record-expense/new", "/direct-expenses", "/indirect-expenses"].includes(activePath);
        }
        return activePath === path;
    };

    // ── Row styles ──
    const rowLayout = expanded
        ? "w-full px-4 py-2.5 gap-3.5"
        : "w-[52px] h-[52px] mx-auto justify-center";
    const rowState = (active) => active
        ? "bg-[#F2572B] text-black font-semibold shadow-sm shadow-[#F2572B]/25"
        : "text-zinc-400 font-medium hover:text-white hover:bg-[#27272a]/70";

    const renderSingleItem = (to, label, IconComponent) => {
        if (isHiddenBySubscription(to)) return null;
        const isActive = isLinkActive(to);
        return (
            <Link
                key={to}
                to={to}
                aria-label={expanded ? undefined : label}
                aria-current={isActive ? "page" : undefined}
                className={`rf-nav-press flex items-center rounded-[16px] text-[14px] whitespace-nowrap ${rowLayout} ${rowState(isActive)}`}
            >
                <IconComponent size={18} className="shrink-0" />
                {expanded && <span className="truncate">{label}</span>}
            </Link>
        );
    };

    const renderDropdownItem = (label, IconComponent, links, isActiveGroup, isOpenGroup, onToggle) => {
        return (
            <div>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={isOpenGroup}
                    aria-label={expanded ? undefined : label}
                    className={`sidebar-button rf-nav-press flex items-center rounded-[16px] text-[14px] text-left whitespace-nowrap cursor-pointer ${rowLayout} ${rowState(isActiveGroup)}`}
                >
                    <IconComponent size={18} className="shrink-0" />
                    {expanded && (
                        <>
                            <span className="flex-1 min-w-0 truncate">{label}</span>
                            <ChevronDown
                                size={16}
                                className={`rf-nav-chevron shrink-0 ${isOpenGroup ? "rotate-180" : "rotate-0"}`}
                            />
                        </>
                    )}
                </button>
                {expanded && isOpenGroup && (
                    <div className="rf-nav-sub mt-1 space-y-0.5 ml-[25px] border-l border-[#27272a]">
                        {links.map(({ to, label: itemLabel }) => {
                            const isSubActive = activePath === to;
                            return (
                                <Link
                                    key={to}
                                    to={to}
                                    aria-current={isSubActive ? "page" : undefined}
                                    className={`rf-nav-press block pl-6 pr-4 py-2.5 text-[13px] rounded-full truncate ${
                                        isSubActive
                                            ? "bg-[#F2572B] text-black font-semibold"
                                            : "text-zinc-400 hover:text-white hover:bg-[#27272a]/40"
                                    }`}
                                >
                                    {itemLabel}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    if (location.pathname === "/login") return null;

    const userInitial = (userDisplayName || "A").charAt(0).toUpperCase();

    return (
        <div className="rf-sidebar-root print:hidden">
            {/* Mobile menu button */}
            {!mobileOpen && (
                <div className="lg:hidden fixed top-3 left-3 z-[99998]">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open menu"
                        className="sidebar-button rf-nav-press w-10 h-10 rounded-xl bg-[#15171D] text-[#F2572B] flex items-center justify-center shadow-lg cursor-pointer"
                    >
                        <Menu size={20} />
                    </button>
                </div>
            )}

            {/* Mobile backdrop */}
            <div
                onClick={() => setMobileOpen(false)}
                aria-hidden="true"
                className={`rf-nav-backdrop lg:hidden fixed inset-0 z-[99998] bg-black/50 backdrop-blur-[1px] ${
                    mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
            />

            {/* Sidebar */}
            <aside
                aria-label="Main navigation"
                onMouseEnter={() => isDesktop && setIsHovered(true)}
                onMouseLeave={() => isDesktop && setIsHovered(false)}
                className={`rf-sidebar rf-nav fixed top-0 left-0 h-full z-[99999] flex flex-col overflow-hidden bg-[#0E0E10] text-white shadow-2xl border-r border-white/[0.06] w-64 max-w-[85vw] lg:max-w-none ${
                    expanded ? "lg:w-64" : "lg:w-[76px]"
                } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
            >
                {/* Logo */}
                <div className={`shrink-0 pt-6 pb-8 flex items-center ${expanded ? "pl-6 pr-5 justify-between" : "justify-center"}`}>
                    <Link to="/" aria-label="RootFin Home" className="rf-nav-logo inline-flex items-center select-none">
                        {expanded ? (
                            <span className="relative inline-flex items-center h-[22px]">
                                <img
                                    src={rootfinLogoText}
                                    alt="ROOTFIN"
                                    className="h-[22px] w-auto object-contain block pointer-events-none"
                                    draggable={false}
                                />
                                <img
                                    src={rootfinLogoArrow}
                                    alt=""
                                    aria-hidden="true"
                                    className="rf-logo-arrow absolute inset-0 h-[22px] w-auto object-contain pointer-events-none"
                                    draggable={false}
                                />
                            </span>
                        ) : (
                            <span className="w-11 h-11 rounded-[14px] bg-[#F2572B] text-black inline-flex items-center justify-center shadow-sm shadow-[#F2572B]/25">
                                <TrendingUp size={22} strokeWidth={2.5} />
                            </span>
                        )}
                    </Link>
                    {!isDesktop && (
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            aria-label="Close menu"
                            className="sidebar-button rf-nav-press w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-[#27272a]/70 flex items-center justify-center cursor-pointer"
                        >
                            <ChevronLeft size={18} />
                        </button>
                    )}
                </div>

                {/* Menu */}
                <nav className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1.5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${expanded ? "px-3" : "px-2"}`}>
                    {/* ── CLUSTER MANAGER: Dashboard + Financial Summary + Reports ── */}
                    {isClusterManager ? (
                        <>
                            {hasModule("dashboard") && renderSingleItem("/", "Dashboard", LayoutDashboard)}

                            {hasModule("financial_summary") && renderSingleItem("/datewisedaybook", "Financial Summary", LineChart)}

                            {hasModule("reports") && reportsLinks.length > 0 && renderDropdownItem(
                                "Reports",
                                LineChart,
                                reportsLinks,
                                isReportsActive,
                                isReportsOpen,
                                () => setOpenSection(isReportsOpen ? null : "reports")
                            )}
                        </>
                    ) : (
                        <>
                            {/* Dashboard - Home */}
                            {hasModule("dashboard") && renderSingleItem("/", "Dashboard", LayoutDashboard)}

                            {/* Day Book - Standalone */}
                            {hasModule("daybook") && renderSingleItem("/daybook", "Day Book", BookOpen)}

                            {/* Financial Summary - Standalone */}
                            {hasModule("financial_summary") && renderSingleItem("/datewisedaybook", "Financial Summary", LineChart)}

                            {/* Sales */}
                            {hasSalesInventoryAccess && hasModule("sales") && salesLinks.length > 0 && renderDropdownItem(
                                "Sales",
                                ShoppingCart,
                                salesLinks,
                                isSalesActive,
                                isSalesOpen,
                                () => setOpenSection(isSalesOpen ? null : "sales")
                            )}

                            {/* Inventory */}
                            {hasSalesInventoryAccess && hasModule("inventory") && inventoryLinks.length > 0 && renderDropdownItem(
                                "Inventory",
                                Box,
                                inventoryLinks,
                                isInventoryActive,
                                isInventoryOpen,
                                () => setOpenSection(isInventoryOpen ? null : "inventory")
                            )}

                            {/* Purchase - NEVER visible to Store Admin or Cluster Admin */}
                            {canAccessAdminRestrictedModules && hasModule("purchase") && purchaseLinks.length > 0 && renderDropdownItem(
                                "Purchase",
                                Truck,
                                purchaseLinks,
                                isPurchaseActive,
                                isPurchaseOpen,
                                () => setOpenSection(isPurchaseOpen ? null : "purchase")
                            )}

                            {/* Reports */}
                            {hasModule("reports") && reportsLinks.length > 0 && renderDropdownItem(
                                "Reports",
                                LineChart,
                                reportsLinks,
                                isReportsActive,
                                isReportsOpen,
                                () => setOpenSection(isReportsOpen ? null : "reports")
                            )}

                            {/* Standalone Modules: Income, Expenses, Late Closures */}
                            {hasModule("income") && renderSingleItem("/income", "Income", DollarSign)}

                            {hasModule("record_expense") && !isStoreAdmin && renderSingleItem("/record-expense", "Record Expense", DollarSign)}

                            {hasModule("expenses") && renderSingleItem("/expenses", "Expenses", DollarSign)}

                            {hasModule("late_closures") && (isAdmin || userRole === "financial_head" || userRole === "financial_admin" || isSuperAdminUser) && renderSingleItem(
                                "/pending-closures",
                                "Late Closures",
                                FolderClosed
                            )}

                            {/* Close Report */}
                            {hasModule("close_report") && (isAdmin || isSuperAdminUser) && renderSingleItem("/CloseReport", "Close Report", FolderClosed)}

                            {/* Admin Close */}
                            {hasModule("admin_close") && (isAdmin || isSuperAdminUser) && renderSingleItem(
                                "/AdminClose",
                                "Admin Close",
                                ShieldCheck
                            )}

                            {/* Manage Users — admin only */}
                            {(isAdmin || isSuperAdminUser) && (hasModule("manage_users") || hasModule("manageUsers")) && manageUsersLinks.length > 0 && renderDropdownItem(
                                "Manage Users",
                                Users,
                                manageUsersLinks,
                                isManageUsersActive,
                                isManageUsersOpen,
                                () => setOpenSection(isManageUsersOpen ? null : "manageUsers")
                            )}
                        </>
                    )}
                </nav>

                {/* Profile */}
                <div ref={userMenuRef} className={`relative shrink-0 bg-[#0E0E10] ${expanded ? "p-4" : "p-2.5"}`}>
                    {showUserMenu && expanded && (
                        <div className="rf-nav-sub absolute bottom-full left-4 right-4 mb-2 p-4 bg-[#18181b] border border-zinc-700 rounded-2xl shadow-2xl z-50 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F2572B] to-[#D9431A] flex items-center justify-center shrink-0">
                                    <span className="text-black font-bold text-base">{userInitial}</span>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[13px] font-semibold text-white truncate">{userDisplayName}</span>
                                    <span className="text-[11px] font-medium text-purple-400 truncate">{getUserRoleTitle()}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="sidebar-button rf-nav-press mt-4 w-full flex items-center justify-center py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                            >
                                Logout
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowUserMenu((prev) => !prev)}
                        aria-expanded={showUserMenu}
                        aria-label={expanded ? undefined : `Account: ${userDisplayName}`}
                        className={`sidebar-button rf-nav-press flex items-center gap-3 rounded-full border cursor-pointer text-left ${
                            showUserMenu ? "border-[#F2572B]/50" : "border-transparent"
                        } ${expanded ? "w-full p-1.5 pr-4 bg-[#27272a] hover:bg-[#3f3f46]" : "mx-auto p-0 bg-transparent"}`}
                    >
                        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F2572B] to-[#D9431A] flex items-center justify-center shrink-0">
                            <span className="text-black font-bold text-sm">{userInitial}</span>
                        </span>
                        {expanded && (
                            <span className="flex flex-col min-w-0">
                                <span className="text-[13px] font-semibold text-white truncate leading-snug">{userDisplayName}</span>
                                <span className="text-[11px] text-zinc-400 truncate leading-tight">{userEmailDisplay}</span>
                            </span>
                        )}
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default Nav;
