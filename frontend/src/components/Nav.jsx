import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import rootfinLogoText from "../assets/rootfin-logo-text.png";
import rootfinLogoArrow from "../assets/rootfin-logo-arrow.png";
import {
    FileText,
    ChevronDown,
    ShoppingBag,
    LineChart,
    DollarSign,
    FolderClosed,
    Notebook,
    Store,
    Package,
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
    ChevronLeft,
    ShieldCheck,
    BookOpen,
    ArrowLeft,
    LayoutDashboard
} from "lucide-react";
import salesInventoryAccessConfig from "../config/salesInventoryAccess.json";
import { usePermissions } from "../utils/permissionService";
import { isSuperAdmin, normalizeRole, getRoleLabel } from "../utils/roleUtils";

const Nav = () => {
    const location = useLocation();
    const currentuser = JSON.parse(localStorage.getItem("rootfinuser")); // Convert back to an object

    // Check user roles and access control
    const userRole = (currentuser?.role || "").toLowerCase().trim();
    const userPower = (currentuser?.power || "").toLowerCase().trim();
    const userEmail = currentuser?.email?.toLowerCase().trim() || "";
    const userLocCode = (currentuser?.locCode || "").toString().trim();

    const adminEmails = [
        "officerootments@gmail.com",
        "operationsrootments@gmail.com",
        "headoffice01@gmail.com"
    ];

    // Main system administrator - ALWAYS full admin access
    const isAdmin = 
        userRole === 'admin' || 
        userRole === 'warehouse_admin' ||
        userRole === 'super_admin' || 
        userRole === 'superadmin' ||
        userPower === 'admin' ||
        userPower === 'super_admin' ||
        adminEmails.includes(userEmail);

    // Warehouse staff (central operations)
    const isWarehouse = 
        userLocCode === '858' || 
        userLocCode === '103';

    // BridesBerry store user check
    const isBridesBerry = 
        userLocCode === '155' || 
        userEmail.includes('bridesberry') || 
        (currentuser?.username || "").toLowerCase().includes('bridesberry');
    
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
        (userLocCode && !['858', '103', '759', '101', '102'].includes(userLocCode)) ||
        isBridesBerry
    );

    const isStoreOrClusterAdmin = isClusterAdmin || isStoreAdmin;

    // Restricted modules: Inventory Adjustments, Purchase Module, Reorder Alerts, Inactive
    // Must be visible to Admin and Warehouse.
    // NEVER visible to Store Admin or Cluster Admin.
    const canAccessAdminRestrictedModules = (isAdmin || isWarehouse) && !isClusterAdmin;

    const isInAllowedList = salesInventoryAccessConfig.allowedEmails
        .map(email => email.toLowerCase())
        .includes(userEmail);
    const hasSalesInventoryAccess = isAdmin || isInAllowedList || isBridesBerry;

    const activePath = location.pathname;

    const { hasModule, hasSubpage, isSuperAdminUser } = usePermissions(currentuser);

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
    const isLocationName = currentuser?.username === "Warehouse" || currentuser?.username === "SuitorGuy MG Road" || currentuser?.username === "Brides Berry";
    const userDisplayName = isSuper ? "Brynex Admin" : ((!isLocationName && currentuser?.username) || currentuser?.name || (isAdmin ? "Brynex Admin" : "User"));
    const userEmailDisplay = currentuser?.email || "admin@gmail.com";
    const getUserRoleTitle = () => {
        if (isSuperAdmin(currentuser)) return "Super Administrator";
        if (isAdmin) return "Administrator";
        return getRoleLabel(currentuser?.role);
    };

    const [isOpen, setIsOpen] = useState(true);

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add("sidebar-open");
            document.body.classList.remove("sidebar-closed");
        } else {
            document.body.classList.add("sidebar-closed");
            document.body.classList.remove("sidebar-open");
        }
        window.dispatchEvent(new CustomEvent("sidebar-changed", { detail: { isOpen } }));
    }, [isOpen]);

    useEffect(() => {
        const handleToggle = () => setIsOpen((prev) => !prev);
        window.addEventListener("toggle-sidebar", handleToggle);
        return () => window.removeEventListener("toggle-sidebar", handleToggle);
    }, []);

    // Auto-open sidebar whenever the pointer reaches the left side of the screen
    useEffect(() => {
        if (isOpen) return;
        const handleMouseMove = (e) => {
            if (e.clientX <= 20) {
                setIsOpen(true);
            }
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [isOpen]);

    const [isHovered, setIsHovered] = useState(false);
    const [isPinned, setIsPinned] = useState(() => localStorage.getItem("rootfin_sidebar_pinned") !== "false");

    const showSidebar = isPinned || isHovered;

    const getInitialSection = useMemo(() => {
        if (activePath === "/reports/sales" || activePath === "/reports/sales-by-invoice" || activePath === "/reports/inventory" || activePath === "/reports/income-expense" || activePath === "/securityReport" || activePath === "/Revenuereport" || activePath === "/BookingReport" || activePath === "/RentOutReport" || activePath === "/reports/sales-by-group") {
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
    const checkSubpage = (path) => allowAllSubpages || hasSubpage(path);

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
        ...(isSuperAdminUser ? [{ to: "/manage-users/permissions", label: "Permissions", Icon: ShieldCheck }] : []),
        { to: "/manage-users/add-user", label: "Add New User", Icon: UserPlus },
        { to: "/manage-users/existing-users", label: "Existing Users", Icon: UserCog },
        { to: "/manage-users/reset-password", label: "Reset Password", Icon: KeyRound },
    ].filter(link => checkSubpage(link.to));
    const isManageUsersActive = manageUsersLinks.some((link) => link.to === activePath);

    const reportsLinks = [
        { to: "/BookingReport", label: "Booking Report" },
        { to: "/RentOutReport", label: "Rent Out Report" },
        { to: "/securityReport", label: "Security Report" },
        { to: "/Revenuereport", label: "Revenue Report" },
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

    const renderSingleItem = (to, label, IconComponent) => {
        const isActive = isLinkActive(to);
        return (
            <Link
                key={to}
                to={to}
                style={{
                    backgroundColor: isActive ? '#9D43D6' : 'transparent',
                    color: isActive ? '#ffffff' : '#A1A1AA'
                }}
                className={`rf-sidebar-item ${isActive ? 'active' : ''} h-[40px] px-[14px] rounded-[10px] flex items-center gap-3 transition-colors hover:text-white hover:bg-white/[0.04] group`}
            >
                <IconComponent size={16} className={`shrink-0 transition-colors ${isActive ? "text-white" : "text-zinc-400 group-hover:text-white"}`} />
                <span className={`text-[13px] truncate ${isActive ? "text-white font-medium" : "text-zinc-300 group-hover:text-white font-normal"}`}>
                    {label}
                </span>
            </Link>
        );
    };

    const renderDropdownItem = (label, IconComponent, links, isActiveGroup, isOpenGroup, onToggle) => {
        return (
            <div>
                <button
                    type="button"
                    onClick={onToggle}
                    style={{
                        backgroundColor: isActiveGroup ? '#9D43D6' : 'transparent',
                        color: isActiveGroup ? '#ffffff' : '#A1A1AA'
                    }}
                    className={`rf-sidebar-item ${isActiveGroup ? 'active' : ''} sidebar-button w-full h-[40px] px-[14px] rounded-[10px] flex items-center justify-between transition-colors cursor-pointer group hover:text-white hover:bg-white/[0.04]`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <IconComponent size={16} className={`shrink-0 transition-colors ${isActiveGroup ? "text-white" : "text-zinc-400 group-hover:text-white"}`} />
                        <span className={`text-[13px] truncate ${isActiveGroup ? "text-white font-medium" : "text-zinc-300 group-hover:text-white font-normal"}`}>
                            {label}
                        </span>
                    </div>
                    <ChevronDown
                        size={14}
                        className={`shrink-0 transition-transform duration-200 ${
                            isActiveGroup ? "text-white" : "text-zinc-400 group-hover:text-white"
                        } ${isOpenGroup ? "rotate-180" : "rotate-0"}`}
                    />
                </button>
                {isOpenGroup && (
                    <div 
                        className="rf-sidebar-subgroup mt-1 mb-1 pl-3 space-y-1"
                        style={{ borderColor: '#3F3F46', borderLeft: '2px solid #3F3F46', marginLeft: '16px' }}
                    >
                        {links.map(({ to, label: itemLabel }) => {
                            const isSubActive = activePath === to;
                            return (
                                <Link
                                    key={to}
                                    to={to}
                                    style={{
                                        color: isSubActive ? '#ffffff' : '#E4E4E7',
                                        backgroundColor: isSubActive ? '#9D43D6' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        visibility: 'visible',
                                        opacity: 1
                                    }}
                                    className={`rf-sidebar-subitem ${isSubActive ? 'active' : ''} h-[34px] px-3 flex items-center text-[12px] font-medium truncate rounded-[8px] transition-colors hover:text-white hover:bg-white/[0.08]`}
                                >
                                    <span style={{ color: isSubActive ? '#ffffff' : '#E4E4E7', visibility: 'visible', opacity: 1 }}>{itemLabel}</span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const isInvoiceCreatePage = activePath === "/sales/invoices/new" || activePath.startsWith("/sales/invoices/edit");
    const sidebarWidth = "w-[240px]";
    const sidebarTranslate = "-translate-x-[240px]";

    return (
        <div className={`flex ${location.pathname === "/login" ? "hidden" : "block"}`}>
            {/* Invisible hover strip to auto-open sidebar when mouse reaches the left edge */}
            {!isOpen && (
                <div
                    onMouseEnter={() => setIsOpen(true)}
                    className="fixed top-0 left-0 w-3 h-full z-[99998] bg-transparent cursor-pointer"
                    title="Move pointer here to open sidebar"
                />
            )}

            {/* Sidebar */}
            <div
                className={`fixed top-0 left-0 h-full ${sidebarWidth} z-[99999] transform flex flex-col justify-between bg-[#1B1B1B] text-white transition-transform duration-300 shadow-2xl ${
                    isOpen ? "translate-x-0" : sidebarTranslate
                }`}
            >
                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Sidebar Header with Logo and Collapse Arrow (Height: 56px) */}
                    <div className="h-[56px] pl-6 pr-4 flex items-center justify-between border-b border-[#242424]/60 shrink-0">
                        <Link to="/" className="relative inline-flex items-center select-none h-[19px] shrink-0" aria-label="RootFin Home">
                            <img
                                src={rootfinLogoText}
                                alt="ROOTFIN"
                                className="h-[19px] w-auto object-contain block pointer-events-none"
                                draggable={false}
                            />
                            <img
                                src={rootfinLogoArrow}
                                alt=""
                                aria-hidden="true"
                                className="rf-logo-arrow absolute inset-0 h-[19px] w-auto object-contain pointer-events-none"
                                draggable={false}
                            />
                        </Link>
                        <button
                            onClick={() => setIsOpen(false)}
                            title="Collapse Sidebar"
                            className="w-7 h-7 rounded-lg bg-[#27272a] hover:bg-[#323236] text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <ArrowLeft size={14} />
                        </button>
                    </div>

                    {/* Navigation Items */}
                    <nav className="space-y-1 p-2.5 overflow-y-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">

                    {/* ── CLUSTER MANAGER: Dashboard + Financial Summary + Reports ── */}
                    {isClusterManager ? (
                        <>
                            {renderSingleItem("/", "Dashboard", LayoutDashboard)}

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
                            {renderSingleItem("/", "Dashboard", LayoutDashboard)}

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
                            {hasModule("admin_close") && (isAdmin || isSuperAdminUser || currentuser?.locCode === '102') && renderSingleItem(
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
                </div>
                
                {/* Fixed User Profile at bottom */}
                <div className="p-3 relative" ref={userMenuRef}>
                    {/* Floating Logout Popup Card */}
                    {showUserMenu && (
                        <div className="absolute bottom-full left-3 right-3 mb-2 p-4 bg-[#1B1B1B] border border-[#2e2e34] rounded-2xl shadow-2xl z-50 text-white animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#27272a] border border-[#323236] flex items-center justify-center shrink-0 shadow-inner">
                                    <span className="text-white font-bold text-base">
                                        {(userDisplayName || "A").charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex flex-col overflow-hidden min-w-0">
                                    <span className="text-[13px] font-semibold text-white truncate">
                                        {userDisplayName}
                                    </span>
                                    <span className="text-[11px] font-medium text-[#9D43D6] truncate">
                                        {getUserRoleTitle()}
                                    </span>
                                </div>
                            </div>

                            <div className="my-3 border-b border-[#2e2e34]" />

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full py-2 px-4 bg-[#DC2626] hover:bg-[#b91c1c] text-white font-medium rounded-xl text-[13px] transition-colors text-center cursor-pointer shadow-sm"
                            >
                                Logout
                            </button>
                        </div>
                    )}

                    {/* Bottom Profile Row */}
                    <div 
                        onClick={() => setShowUserMenu(prev => !prev)}
                        className={`flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer select-none ${
                            showUserMenu ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                        }`}
                    >
                        <div className="w-9 h-9 rounded-full bg-[#27272a] border border-[#323236] flex items-center justify-center shrink-0 shadow-inner">
                            <span className="text-white font-bold text-sm">
                                {(userDisplayName || "A").charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex flex-col overflow-hidden min-w-0">
                            <span className="text-[13px] font-semibold text-white truncate leading-snug">
                                {userDisplayName}
                            </span>
                            <span className="text-[11px] font-medium text-[#6A6A6A] truncate leading-tight">
                                {userEmailDisplay}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Nav





// import { IoPersonCircleOutline } from "react-icons/io5";









