import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
    Bell, MapPin, ChevronDown, Check, SlidersHorizontal, 
    AlertTriangle, Clock, X, CheckCheck, RefreshCw, Inbox, ArrowRight 
} from "lucide-react";
import Rootments from '../assets/Rootments.jpg';
import baseUrl from '../api/api';
import { getActiveStores, fetchActiveStores } from "../utils/storeService.js";
import Breadcrumbs from "./Breadcrumbs.jsx";

const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

// Function to format location names with proper spacing
const formatLocationName = (name) => {
    if (!name || name === "No Stores" || name === "No stores available") return name || "No Stores";
    
    let formatted = name.trim();
    
    // Exact overrides for known stores
    if (/^warehouse$/i.test(formatted)) {
        return "Warehouse";
    }
    if (/^brides\s*berry$/i.test(formatted) || /^bridesberry$/i.test(formatted)) {
        return "Brides Berry";
    }
  
    
    // Pattern: G- or Z- prefix with capital letter
    formatted = formatted.replace(/^([A-Z])-([A-Z][a-z])/g, '$1 $2');
    
    return formatted;
};

const Header = (prop) => {
    const navigate = useNavigate();
    const [AllLoation, setAllLoation] = useState(() => getActiveStores());

    const [Value, setValue] = useState({ locCode: '', locName: '' });

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [selectedValue, setSelectedValue] = useState("");

    // Notification states
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const notificationRef = useRef(null);
    const [notifications, setNotifications] = useState([]);
    const [isFetchingNotifications, setIsFetchingNotifications] = useState(false);
    const [activeNotificationTab, setActiveNotificationTab] = useState("all");
    const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("rootfin_dismissed_notifications") || "[]");
        } catch {
            return [];
        }
    });

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsNotificationOpen(false);
            }
        };
        if (isDropdownOpen || isNotificationOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen, isNotificationOpen]);
    
    // Initialize currentUser from localStorage immediately to prevent blank display
    const getInitialUser = () => {
        try {
            const storedUser = JSON.parse(localStorage.getItem("rootfinuser"));
            return storedUser || {};
        } catch (error) {
            return {};
        }
    };
    const [currentUser, setCurrentUser] = useState(getInitialUser());

    // Function to sync user from localStorage
    const syncUserFromStorage = (locations) => {
        try {
            const storedUser = JSON.parse(localStorage.getItem("rootfinuser"));
            if (storedUser) {
                const role = (storedUser.role || '').toLowerCase();
                const isSuperAdmin = role === 'super_admin' || role === 'superadmin';
                const isGlobal = isSuperAdmin || role === 'admin' || role === 'warehouse_admin' || role === 'financial_admin';
                const isCluster = role.includes('cluster');

                // Super Admin has Brynex Admin username, but can switch locations
                if (isSuperAdmin) {
                    const foundLoc = locations.find(loc => loc.locCode === storedUser.locCode);
                    const activeLoc = foundLoc || locations[0];
                    const activeCode = activeLoc ? activeLoc.locCode : "";
                    const activeStoreName = activeLoc ? activeLoc.locName : null;

                    const cleanUser = {
                        ...storedUser,
                        locCode: activeCode,
                        storeName: activeStoreName,
                        username: "Brynex Admin"
                    };

                    if (storedUser.username !== "Brynex Admin" || (!foundLoc && activeCode && storedUser.locCode !== activeCode)) {
                        try {
                            localStorage.setItem("rootfinuser", JSON.stringify(cleanUser));
                        } catch (e) {}
                    }
                    setCurrentUser(cleanUser);
                    setSelectedValue(activeCode);
                    return;
                }

                // For regular store users: keep their assigned store
                if (!isGlobal && !isCluster) {
                    setCurrentUser(storedUser);
                    setSelectedValue(storedUser.locCode || "");
                    return;
                }

                // For admin or cluster manager: match their active location or default to first available
                const foundLoc = locations.find(loc => loc.locCode === storedUser.locCode);
                const activeLoc = foundLoc || locations[0];
                if (activeLoc) {
                    const actualUsername = (storedUser.username && storedUser.username !== "Warehouse" && storedUser.username !== "SuitorGuy MG Road" && storedUser.username !== "Brides Berry") 
                        ? storedUser.username 
                        : (storedUser.name || "Brynex Admin");

                    const updatedUser = {
                        ...storedUser,
                        locCode: activeLoc.locCode,
                        storeName: activeLoc.locName,
                        username: actualUsername
                    };
                    if (!foundLoc && locations.length > 0 && storedUser.locCode !== activeLoc.locCode) {
                        try {
                            localStorage.setItem("rootfinuser", JSON.stringify(updatedUser));
                        } catch (e) {}
                    }
                    setCurrentUser(updatedUser);
                    setSelectedValue(activeLoc.locCode);
                } else {
                    setCurrentUser(storedUser);
                    setSelectedValue("");
                }
            }
        } catch (error) {
            console.error("Error syncing user from storage:", error);
        }
    };

    useEffect(() => {
        const load = async () => {
            const locations = await fetchActiveStores();
            setAllLoation(locations || []);
            syncUserFromStorage(locations || []);
        };
        load();

        const handleStoresUpdated = (e) => {
            const locs = (e.detail && Array.isArray(e.detail)) ? e.detail : [];
            setAllLoation(locs);
            syncUserFromStorage(locs);
        };

        window.addEventListener("rootfin-stores-updated", handleStoresUpdated);
        return () => window.removeEventListener("rootfin-stores-updated", handleStoresUpdated);
    }, []);

    // Additional useEffect to periodically sync user from localStorage
    // This ensures the location stays visible even if state is lost
    useEffect(() => {
        const syncInterval = setInterval(() => {
            if (AllLoation.length > 0) {
                syncUserFromStorage(AllLoation);
            }
        }, 1000); // Check every second

        // Also listen for storage changes (in case localStorage is updated from another tab/window)
        const handleStorageChange = (e) => {
            if (e.key === 'rootfinuser' && AllLoation.length > 0) {
                syncUserFromStorage(AllLoation);
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            clearInterval(syncInterval);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [AllLoation]);

    const handleSelectLocation = (selectedCode, selectedName) => {
        setSelectedValue(selectedCode);
        setValue({
            locCode: selectedCode,
            locName: selectedName,
        });

        const stored = JSON.parse(localStorage.getItem("rootfinuser") || "{}");
        const role = (stored.role || '').toLowerCase();
        const isSuperAdmin = role === 'super_admin' || role === 'superadmin';

        const updatedUser = {
            ...stored,
            locCode: selectedCode,
            storeName: isSuperAdmin ? null : selectedName,
            username: isSuperAdmin ? "Brynex Admin" : (stored.username || selectedName),
        };

        localStorage.setItem("rootfinuser", JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
        setIsDropdownOpen(false);
        window.location.reload();
    };

    // Get display name with fallback to localStorage
    const getDisplayName = () => {
        if (!AllLoation || AllLoation.length === 0) {
            return "No Stores";
        }
        const matched = AllLoation.find(loc => loc.locCode === currentUser?.locCode);
        if (matched) return matched.locName;
        const role = (currentUser?.role || '').toLowerCase();
        const isSuperAdmin = role === 'super_admin' || role === 'superadmin';
        if (!isSuperAdmin && currentUser?.storeName) return currentUser.storeName;
        return AllLoation[0]?.locName || "Select Store";
    };

    const displayName = getDisplayName();

    const userRole = (currentUser?.role || '').toLowerCase();
    const isGlobalAdmin = userRole === 'super_admin' || userRole === 'superadmin' || userRole === 'admin' || userRole === 'warehouse_admin' || userRole === 'financial_admin';
    const isCluster = userRole.includes('cluster');

    const canSwitchLocation = 
        isGlobalAdmin || 
        isCluster ||
        (currentUser?.allowedLocCodes && currentUser.allowedLocCodes.length > 1);

    const selectableLocations = isGlobalAdmin
        ? AllLoation
        : AllLoation.filter(item => (currentUser?.allowedLocCodes || []).includes(item.locCode));

    // Fetch dynamic notifications from backend
    const fetchNotifications = async () => {
        try {
            setIsFetchingNotifications(true);
            const userObj = currentUser || {};
            const role = userObj.role || "";
            const power = userObj.power || "";
            const locCode = userObj.locCode || "";
            const params = new URLSearchParams();
            if (role) params.append("role", role);
            if (power) params.append("userPower", power);
            if (locCode) params.append("locCode", locCode);

            const res = await fetch(`${API_URL}/api/notifications?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch notifications");
            const data = await res.json();
            if (data?.success && Array.isArray(data?.notifications)) {
                setNotifications(data.notifications);
            }
        } catch (err) {
            console.warn("Notifications fetch warning:", err.message);
        } finally {
            setIsFetchingNotifications(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 30s so super admin sees new requests live
        const timer = setInterval(fetchNotifications, 30000);
        return () => clearInterval(timer);
    }, [currentUser?.role, currentUser?.power, currentUser?.locCode]);

    // Filter out dismissed notification IDs
    const activeNotifications = notifications.filter(
        (n) => !dismissedNotificationIds.includes(n.id)
    );
    const badgeCount = activeNotifications.length;

    const countsByType = {
        all: activeNotifications.length,
        inventory_adjustment: activeNotifications.filter(n => n.type === "inventory_adjustment").length,
        unclosed_yesterday: activeNotifications.filter(n => n.type === "unclosed_yesterday").length,
        closure_request: activeNotifications.filter(n => n.type === "closure_request").length,
    };

    const filteredNotifications = activeNotifications.filter((n) => {
        if (activeNotificationTab === "all") return true;
        return n.type === activeNotificationTab;
    });

    const handleDismissNotification = (e, id) => {
        e.stopPropagation();
        const updated = [...dismissedNotificationIds, id];
        setDismissedNotificationIds(updated);
        try {
            localStorage.setItem("rootfin_dismissed_notifications", JSON.stringify(updated));
        } catch {}
    };

    const handleDismissAllNotifications = () => {
        const allIds = notifications.map(n => n.id);
        const merged = Array.from(new Set([...dismissedNotificationIds, ...allIds]));
        setDismissedNotificationIds(merged);
        try {
            localStorage.setItem("rootfin_dismissed_notifications", JSON.stringify(merged));
        } catch {}
    };

    const handleNotificationClick = (item) => {
        if (!dismissedNotificationIds.includes(item.id)) {
            const updated = [...dismissedNotificationIds, item.id];
            setDismissedNotificationIds(updated);
            try {
                localStorage.setItem("rootfin_dismissed_notifications", JSON.stringify(updated));
            } catch {}
        }
        setIsNotificationOpen(false);
        if (item.link) {
            navigate(item.link);
        }
    };

    const formatTimeAgo = (dateInput) => {
        if (!dateInput) return "";
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return "";
        const now = new Date();
        const diffSec = Math.floor((now - date) / 1000);
        if (diffSec < 60) return "Just now";
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay === 1) return "Yesterday";
        if (diffDay < 7) return `${diffDay}d ago`;
        return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    };

    return (
        <header className="bg-white border-b border-[#E5E5E5] h-[56px] flex items-center relative z-40">
            <div className="w-full pl-14 md:pl-6 pr-6 flex items-center justify-between mx-auto">
                <div className="flex items-center min-w-0 pr-4 overflow-hidden">
                    <Breadcrumbs currentTitle={prop.title} />
                </div>

                {/* Right corner: Notification Bell + Store Selection Dropdown Pill */}
                <div className="flex items-center gap-3 relative">
                    {/* Notification Bell */}
                    <div className="relative" ref={notificationRef}>
                        <button
                            type="button"
                            onClick={() => setIsNotificationOpen(prev => !prev)}
                            className="relative text-[#6A6A6A] hover:text-[#212121] cursor-pointer p-2 rounded-[10px] hover:bg-[#F7F7F7] transition-colors flex items-center justify-center"
                            title="Notifications"
                        >
                            <Bell size={19} className="text-[#6A6A6A]" />
                            {badgeCount > 0 && (
                                <span className="absolute 0 top-0.5 right-0.5 bg-[#DC2626] text-white text-[10px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center leading-none ring-2 ring-white">
                                    {badgeCount > 99 ? "99+" : badgeCount}
                                </span>
                            )}
                        </button>

                        {/* Notification Dropdown Panel */}
                        {isNotificationOpen && (
                            <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[380px] bg-white border border-[#E5E5E5] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                {/* Header */}
                                <div className="px-4 py-3 border-b border-[#F0F0F0] flex items-center justify-between bg-white">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-[14px] font-semibold text-[#212121]">Notifications</h3>
                                        {badgeCount > 0 && (
                                            <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#9D43D6]/10 text-[#9D43D6] rounded-full">
                                                {badgeCount} new
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={fetchNotifications}
                                            disabled={isFetchingNotifications}
                                            className="p-1 text-[#6A6A6A] hover:text-[#212121] hover:bg-[#F5F5F5] rounded transition-colors"
                                            title="Refresh notifications"
                                        >
                                            <RefreshCw size={13} className={isFetchingNotifications ? "animate-spin" : ""} />
                                        </button>
                                        {badgeCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleDismissAllNotifications}
                                                className="text-[11px] font-medium text-[#6A6A6A] hover:text-[#9D43D6] transition-colors"
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Filter Tabs */}
                                {badgeCount > 0 && (
                                    <div className="flex items-center gap-1 px-3 py-2 bg-[#FAFAFA] border-b border-[#F0F0F0] overflow-x-auto text-[11px]">
                                        <button
                                            type="button"
                                            onClick={() => setActiveNotificationTab("all")}
                                            className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                                activeNotificationTab === "all"
                                                    ? "bg-[#9D43D6] text-white"
                                                    : "text-[#6A6A6A] hover:text-[#212121] hover:bg-white"
                                            }`}
                                        >
                                            All ({countsByType.all})
                                        </button>
                                        {countsByType.inventory_adjustment > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveNotificationTab("inventory_adjustment")}
                                                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                                    activeNotificationTab === "inventory_adjustment"
                                                        ? "bg-[#9D43D6] text-white"
                                                        : "text-[#6A6A6A] hover:text-[#212121] hover:bg-white"
                                                }`}
                                            >
                                                Adjustments ({countsByType.inventory_adjustment})
                                            </button>
                                        )}
                                        {countsByType.unclosed_yesterday > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveNotificationTab("unclosed_yesterday")}
                                                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                                    activeNotificationTab === "unclosed_yesterday"
                                                        ? "bg-[#9D43D6] text-white"
                                                        : "text-[#6A6A6A] hover:text-[#212121] hover:bg-white"
                                                }`}
                                            >
                                                Unclosed ({countsByType.unclosed_yesterday})
                                            </button>
                                        )}
                                        {countsByType.closure_request > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveNotificationTab("closure_request")}
                                                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                                    activeNotificationTab === "closure_request"
                                                        ? "bg-[#9D43D6] text-white"
                                                        : "text-[#6A6A6A] hover:text-[#212121] hover:bg-white"
                                                }`}
                                            >
                                                Closures ({countsByType.closure_request})
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Notification items list */}
                                <div className="max-h-[340px] overflow-y-auto divide-y divide-[#F5F5F5]">
                                    {filteredNotifications.length === 0 ? (
                                        <div className="py-10 px-4 text-center">
                                            <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center mx-auto mb-2 text-[#9E9E9E]">
                                                <Inbox size={20} />
                                            </div>
                                            <p className="text-[13px] font-medium text-[#212121]">All caught up!</p>
                                            <p className="text-[11px] text-[#8C8C8C] mt-0.5">
                                                No pending requests or unclosed stores.
                                            </p>
                                        </div>
                                    ) : (
                                        filteredNotifications.map((item) => {
                                            let Icon = SlidersHorizontal;
                                            let iconBg = "bg-amber-50 text-amber-600 border border-amber-200";
                                            let badgeBg = "bg-amber-100 text-amber-800";

                                            if (item.type === "unclosed_yesterday") {
                                                Icon = AlertTriangle;
                                                iconBg = "bg-rose-50 text-rose-600 border border-rose-200";
                                                badgeBg = "bg-rose-100 text-rose-800";
                                            } else if (item.type === "closure_request") {
                                                Icon = Clock;
                                                iconBg = "bg-purple-50 text-purple-600 border border-purple-200";
                                                badgeBg = "bg-purple-100 text-purple-800";
                                            }

                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleNotificationClick(item)}
                                                    className="p-3 hover:bg-[#F9FAFB] transition-colors cursor-pointer flex items-start gap-3 group relative"
                                                >
                                                    <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5 ${iconBg}`}>
                                                        <Icon size={15} />
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-5">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <span className="text-[12px] font-semibold text-[#212121] truncate">
                                                                {item.title}
                                                            </span>
                                                            {item.badge && (
                                                                <span className={`px-1.5 py-0.2 text-[9px] font-semibold rounded ${badgeBg}`}>
                                                                    {item.badge}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-[#555] leading-relaxed line-clamp-2">
                                                            {item.message}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-[#8C8C8C]">
                                                                {formatTimeAgo(item.createdAt)}
                                                            </span>
                                                            <span className="text-[10px] text-[#9D43D6] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                View details <ArrowRight size={10} />
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDismissNotification(e, item.id)}
                                                        className="absolute top-2.5 right-2.5 p-1 text-[#8C8C8C] hover:text-[#212121] hover:bg-[#EEEEEE] rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                        title="Dismiss"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Quick Links Footer */}
                                <div className="p-2 border-t border-[#F0F0F0] bg-[#FAFAFA] flex items-center justify-between text-[11px] text-[#6A6A6A]">
                                    <span className="font-medium text-[#8C8C8C]">Quick Actions</span>
                                    <div className="flex items-center gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => { setIsNotificationOpen(false); navigate("/inventory/adjustments"); }}
                                            className="text-[#9D43D6] hover:underline cursor-pointer"
                                        >
                                            Adjustments
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsNotificationOpen(false); navigate("/pending-closures"); }}
                                            className="text-[#9D43D6] hover:underline cursor-pointer"
                                        >
                                            Late Closures
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsNotificationOpen(false); navigate("/CloseReport"); }}
                                            className="text-[#9D43D6] hover:underline cursor-pointer"
                                        >
                                            Close Report
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Store Selection Pill */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => canSwitchLocation && setIsDropdownOpen(prev => !prev)}
                            className={`flex items-center gap-2 h-[38px] px-3.5 bg-white border border-[#E5E5E5] rounded-[10px] text-[13px] font-medium text-[#212121] shadow-xs transition-colors ${
                                canSwitchLocation ? 'cursor-pointer hover:bg-[#F7F7F7]' : 'cursor-default'
                            }`}
                        >
                            <MapPin size={15} className="text-[#6A6A6A] shrink-0" />
                            <span className="whitespace-nowrap font-medium text-[#212121]">
                                {formatLocationName(displayName) || "No Stores"}
                            </span>
                            {canSwitchLocation && (
                                <ChevronDown size={14} className={`text-[#6A6A6A] shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && canSwitchLocation && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#E5E5E5] rounded-[10px] shadow-xl py-1.5 z-50 max-h-80 overflow-y-auto">
                                <div className="px-3.5 py-1.5 text-[11px] font-medium text-[#6A6A6A] uppercase tracking-wider border-b border-[#E5E5E5] mb-1">
                                    Switch Location
                                </div>
                                {selectableLocations.length === 0 ? (
                                    <div className="px-4 py-3 text-[13px] text-[#6A6A6A] text-center">
                                        No stores available
                                    </div>
                                ) : (
                                    selectableLocations.map((item) => {
                                        const isSelected = selectedValue === item.locCode;
                                        return (
                                            <button
                                                key={item.locCode}
                                                type="button"
                                                onClick={() => handleSelectLocation(item.locCode, item.locName)}
                                                className={`w-full flex items-center justify-between px-3.5 py-2 text-[13px] text-left transition-colors cursor-pointer ${
                                                    isSelected 
                                                        ? "bg-[#9D43D6]/10 text-[#9D43D6] font-medium" 
                                                        : "text-[#212121] hover:bg-[#F7F7F7]"
                                                }`}
                                            >
                                                <span className="truncate">{formatLocationName(item.locName)}</span>
                                                {isSelected && <Check size={16} className="text-[#9D43D6] shrink-0 ml-2" />}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
