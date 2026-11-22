import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
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
    ShieldCheck
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
        "brynex@gmail.com",
        "operationsrootments@gmail.com",
        "headoffice01@gmail.com"
    ];

    // Main system administrator - ALWAYS full admin access
    const isAdmin = 
        userRole === 'admin' || 
        userRole === 'super_admin' || 
        userRole === 'superadmin' ||
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

    const userDisplayName = currentuser?.name || currentuser?.username || (isAdmin ? "Admin" : "User");
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
    ].filter(link => hasSubpage(link.to));

    const salesLinks = [
        { to: "/sales/invoices", label: "Invoices", Icon: FileTextIcon },
        { to: "/sales/returns", label: "Invoice Return", Icon: RotateCcw }
    ].filter(link => hasSubpage(link.to));

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
    ].filter(link => hasSubpage(link.to));
    const isPurchaseActive = purchaseLinks.some((link) => link.to === activePath);
    
    const manageUsersLinks = [
        ...(isSuperAdminUser ? [{ to: "/manage-users/permissions", label: "Permissions", Icon: ShieldCheck }] : []),
        { to: "/manage-users/add-user", label: "Add New User", Icon: UserPlus },
        { to: "/manage-users/existing-users", label: "Existing Users", Icon: UserCog },
        { to: "/manage-users/reset-password", label: "Reset Password", Icon: KeyRound },
    ].filter(link => hasSubpage(link.to));
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
    ].filter(link => hasSubpage(link.to));
    const isReportsActive = reportsLinks.some((link) => link.to === activePath);

    const groupButtonClasses = (isActive) =>
        `sidebar-button flex items-center justify-between w-full px-4 py-2.5 text-[12px] font-normal transition-all text-[#a1a1aa] hover:text-white`;

    const subLinkClasses = (path) =>
        `block w-full pl-[24px] pr-4 py-2.5 text-[11px] whitespace-nowrap truncate transition-colors ${
            activePath === path
                ? "bg-[#a855f7] text-white font-medium"
                : "text-[#a1a1aa] font-normal hover:text-white"
        }`;

    const singleLinkClasses = (path) =>
        `flex items-center gap-3 px-4 py-2.5 text-[12px] whitespace-nowrap truncate transition-colors ${
            (path === "/record-expense"
                ? ["/record-expense", "/record-expenses", "/record-expense/new", "/direct-expenses", "/indirect-expenses"].includes(activePath)
                : activePath === path)
                ? "text-white font-medium"
                : "text-[#a1a1aa] font-normal hover:text-white"
        }`;

    // alert(location.pathname)
    const isInvoiceCreatePage = activePath === "/sales/invoices/new" || activePath.startsWith("/sales/invoices/edit");
    const sidebarWidth = isInvoiceCreatePage ? "w-56" : "w-64";
    const sidebarTranslate = isInvoiceCreatePage ? "-translate-x-56" : "-translate-x-64";

    return (
        <div className={`flex ${location.pathname === "/login" ? "hidden" : "block"}`}>
            {/* Floating button to open sidebar when closed */}
            {!isOpen && (
                <button
                    onClick={() => {
                        setIsOpen(true);
                        window.dispatchEvent(new CustomEvent("sidebar-changed", { detail: { isOpen: true } }));
                    }}
                    title="Open Sidebar Menu"
                    className="fixed top-3 left-3 z-[99999] p-2 rounded-xl bg-white text-[#1e293b] border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-md flex items-center justify-center cursor-pointer active:scale-95 no-print"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#1e293b]">
                        <line x1="5" y1="4" x2="5" y2="20"/>
                        <line x1="10" y1="4" x2="10" y2="20"/>
                        <path d="M15 8l4 4-4 4"/>
                    </svg>
                </button>
            )}


            {/* Sidebar */}
            <div
                className={`fixed top-0 left-0 h-full ${sidebarWidth} z-[99999] transform flex flex-col justify-between bg-[#18181b] text-white transition-transform duration-300 shadow-2xl ${
                    isOpen ? "translate-x-0" : sidebarTranslate
                }`}
            >
                <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="px-6 pt-6 pb-8 flex items-center justify-between">
                        <span className="text-white font-bold text-[22px] tracking-wide flex items-center">
                            ROOT<span className="text-[#a855f7] flex items-center"><LineChart size={20} className="mx-0.5" strokeWidth={3} />FIN</span>
                        </span>
                        <button
                            onClick={() => setIsOpen(false)}
                            title="Close Sidebar"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <ChevronLeft size={18} />
                        </button>
                    </div>
                    <nav className="space-y-5 px-3 overflow-y-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">

                    {/* ── CLUSTER MANAGER: only Financial Summary + Reports ── */}
                    {isClusterManager ? (
                        <>
                            {hasModule("financial_summary") && (
                                <Link to="/datewisedaybook" className={singleLinkClasses("/datewisedaybook")}>
                                    <FileTextIcon size={18} />
                                    <span>Financial Summary</span>
                                </Link>
                            )}

                            {hasModule("reports") && reportsLinks.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setOpenSection(isReportsOpen ? null : "reports")}
                                        className={groupButtonClasses(isReportsActive || isReportsOpen)}
                                    >
                                        <div className="flex w-full items-center gap-4">
                                            <LineChart size={18} className="shrink-0" />
                                            <span className="flex-1 text-left">Reports</span>
                                            <ChevronDown size={16} className={`shrink-0 transition-transform ${isReportsOpen ? "rotate-180" : "rotate-0"}`} />
                                        </div>
                                    </button>
                                    {isReportsOpen && (
                                        <div className="mt-1 space-y-0.5 border-l border-[#27272a] ml-[25px]">
                                            {reportsLinks.map(({ to, label }) => (
                                                <Link key={to} to={to} className={subLinkClasses(to)}><span>{label}</span></Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Day Book - Standalone */}
                            {hasModule("daybook") && (
                                <Link to="/" className={singleLinkClasses("/")}>
                                    <FileText size={16} />
                                    <span>Day Book</span>
                                </Link>
                            )}

                            {/* Financial Summary - Standalone */}
                            {hasModule("financial_summary") && (
                                <Link to="/datewisedaybook" className={singleLinkClasses("/datewisedaybook")}>
                                    <FileTextIcon size={16} />
                                    <span>Financial Summary</span>
                                </Link>
                            )}

                            {/* Sales */}
                            {hasSalesInventoryAccess && hasModule("sales") && salesLinks.length > 0 && (
                                <div>
                                    <button onClick={() => setOpenSection(isSalesOpen ? null : "sales")} className={groupButtonClasses(isSalesActive || isSalesOpen)}>
                                        <div className="flex w-full items-center gap-3">
                                            <ShoppingCart size={16} className="shrink-0" />
                                            <span className="flex-1 text-left whitespace-nowrap truncate">Sales</span>
                                            <ChevronDown size={14} className={`shrink-0 transition-transform ${isSalesOpen ? "rotate-180" : "rotate-0"}`} />
                                        </div>
                                    </button>
                                    {isSalesOpen && (
                                        <div className="mt-1 space-y-0.5 border-l border-[#27272a] ml-[25px]">
                                            {salesLinks.map(({ to, label }) => (
                                                <Link key={to} to={to} className={subLinkClasses(to)}><span>{label}</span></Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Inventory */}
                            {hasSalesInventoryAccess && hasModule("inventory") && inventoryLinks.length > 0 && (
                                <div>
                                    <button onClick={() => setOpenSection(isInventoryOpen ? null : "inventory")} className={groupButtonClasses(isInventoryActive || isInventoryOpen)}>
                                        <div className="flex w-full items-center gap-3">
                                            <Box size={16} className="shrink-0" />
                                            <span className="flex-1 text-left whitespace-nowrap truncate">Inventory</span>
                                            <ChevronDown size={14} className={`shrink-0 transition-transform ${isInventoryOpen ? "rotate-180" : "rotate-0"}`} />
                                        </div>
                                    </button>
                                    {isInventoryOpen && (
                                        <div className="mt-1 space-y-0.5 border-l border-[#27272a] ml-[25px]">
                                            {inventoryLinks.map(({ to, label }) => (
                                                <Link key={to} to={to} className={subLinkClasses(to)}><span>{label}</span></Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Purchase - NEVER visible to Store Admin or Cluster Admin */}
                            {canAccessAdminRestrictedModules && hasModule("purchase") && purchaseLinks.length > 0 && (
                                <div>
                                    <button onClick={() => setOpenSection(isPurchaseOpen ? null : "purchase")} className={groupButtonClasses(isPurchaseActive || isPurchaseOpen)}>
                                        <div className="flex w-full items-center gap-3">
                                            <Truck size={16} className="shrink-0" />
                                            <span className="flex-1 text-left whitespace-nowrap truncate">Purchase</span>
                                            <ChevronDown size={14} className={`shrink-0 transition-transform ${isPurchaseOpen ? "rotate-180" : "rotate-0"}`} />
                                        </div>
                                    </button>
                                    {isPurchaseOpen && (
                                        <div className="mt-1 space-y-0.5 border-l border-[#27272a] ml-[25px]">
                                            {purchaseLinks.map(({ to, label }) => (
                                                <Link key={to} to={to} className={subLinkClasses(to)}><span>{label}</span></Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Reports */}
                            {hasModule("reports") && reportsLinks.length > 0 && (
                                <div>
                                    <button onClick={() => setOpenSection(isReportsOpen ? null : "reports")} className={groupButtonClasses(isReportsActive || isReportsOpen)}>
                                        <div className="flex w-full items-center gap-3">
                                            <LineChart size={16} className="shrink-0" />
                                            <span className="flex-1 text-left whitespace-nowrap truncate">Reports</span>
                                            <ChevronDown size={14} className={`shrink-0 transition-transform ${isReportsOpen ? "rotate-180" : "rotate-0"}`} />
                                        </div>
                                    </button>
                                    {isReportsOpen && (
                                        <div className="mt-1 space-y-0.5 border-l border-[#27272a] ml-[25px]">
                                            {reportsLinks.map(({ to, label }) => (
                                                <Link key={to} to={to} className={subLinkClasses(to)}><span>{label}</span></Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Standalone Modules: Income, Expenses, Late Closures, Close Report, Admin Close */}
                            {hasModule("income") && (
                                <Link to="/income" className={singleLinkClasses("/income")}>
                                    <DollarSign size={16} />
                                    <span>Income</span>
                                </Link>
                            )}

                            {hasModule("record_expense") && !isStoreAdmin && (
                                <Link to="/record-expense" className={singleLinkClasses("/record-expense")}>
                                    <DollarSign size={16} />
                                    <span>Record Expense</span>
                                </Link>
                            )}

                            {hasModule("expenses") && (
                                <Link to="/expenses" className={singleLinkClasses("/expenses")}>
                                    <DollarSign size={16} />
                                    <span>Expenses</span>
                                </Link>
                            )}

                            {hasModule("late_closures") && (isAdmin || userRole === "financial_head" || userRole === "financial_admin" || isSuperAdminUser) && (
                                <Link to="/pending-closures" className={singleLinkClasses("/pending-closures")}>
                                    <FolderClosed size={16} />
                                    <span>Late Closures</span>
                                </Link>
                            )}

                            {hasModule("close_report") && (isAdmin || isSuperAdminUser) && (
                                <Link to="/CloseReport" className={singleLinkClasses("/CloseReport")}>
                                    <FolderClosed size={16} />
                                    <span>Close Report</span>
                                </Link>
                            )}

                            {hasModule("admin_close") && (isAdmin || isSuperAdminUser || currentuser.locCode === '102') && (
                                <Link to="/AdminClose" className={singleLinkClasses("/AdminClose")}>
                                    <Notebook size={16} />
                                    <span>Admin Close</span>
                                </Link>
                            )}

                            {/* Manage Users — admin only */}
                            {(isAdmin || isSuperAdminUser) && (hasModule("manage_users") || hasModule("manageUsers")) && manageUsersLinks.length > 0 && (
                                <div>
                                    <button onClick={() => setOpenSection(isManageUsersOpen ? null : "manageUsers")} className={groupButtonClasses(isManageUsersActive || isManageUsersOpen)}>
                                        <div className="flex w-full items-center gap-3">
                                            <Users size={16} className="shrink-0" />
                                            <span className="flex-1 text-left whitespace-nowrap truncate">Manage Users</span>
                                            <ChevronDown size={14} className={`shrink-0 transition-transform ${isManageUsersOpen ? "rotate-180" : "rotate-0"}`} />
                                        </div>
                                    </button>
                                    {isManageUsersOpen && (
                                        <div className="mt-1 space-y-0.5 border-l border-[#27272a] ml-[25px]">
                                            {manageUsersLinks.map(({ to, label }) => (
                                                <Link key={to} to={to} className={subLinkClasses(to)}><span>{label}</span></Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                    </nav>
                </div>
                
                {/* Fixed User Profile at bottom */}
                <div className="p-4 relative" ref={userMenuRef}>
                    {/* Floating Logout Popup Card */}
                    {showUserMenu && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 p-4 bg-[#1f1f23] border border-[#2e2e34] rounded-2xl shadow-2xl z-50 text-white animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#c77dff] flex items-center justify-center shrink-0 shadow-inner">
                                    <span className="text-white font-bold text-lg">
                                        {(userDisplayName || "A").charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-bold text-white truncate">
                                        {userDisplayName}
                                    </span>
                                    <span className="text-xs font-semibold text-purple-400">
                                        {getUserRoleTitle()}
                                    </span>
                                </div>
                            </div>

                            <div className="my-3.5 border-b border-[#2e2e34]" />

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full py-2.5 px-4 bg-[#ef4444] hover:bg-[#dc2626] active:bg-[#b91c1c] text-white font-semibold rounded-xl text-sm transition-colors text-center cursor-pointer shadow-md"
                            >
                                Logout
                            </button>
                        </div>
                    )}

                    {/* Bottom Profile Pill */}
                    <div 
                        onClick={() => setShowUserMenu(prev => !prev)}
                        className={`flex items-center gap-3 bg-[#27272a]/50 hover:bg-[#27272a] transition-all p-2.5 rounded-[20px] cursor-pointer ${
                            showUserMenu ? 'border border-[#9d4edd] bg-[#27272a]/80 shadow-md ring-1 ring-[#9d4edd]/50' : 'border border-transparent'
                        }`}
                    >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#c77dff] flex items-center justify-center shrink-0 shadow-inner">
                            <span className="text-white font-bold text-sm">
                                {(userDisplayName || "A").charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[13px] font-semibold text-white truncate">
                                {userDisplayName}
                            </span>
                            <span className="text-[11px] text-[#a1a1aa] truncate">
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









