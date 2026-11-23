import { useState, useEffect, useRef } from "react";
import { Bell, MapPin, ChevronDown, Check } from "lucide-react";
import Rootments from '../assets/Rootments.jpg';
import baseUrl from '../api/api';
import { getActiveStores, fetchActiveStores } from "../utils/storeService.js";

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
    const [AllLoation, setAllLoation] = useState(() => getActiveStores());

    const [Value, setValue] = useState({ locCode: '', locName: '' });

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [selectedValue, setSelectedValue] = useState("");

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);
    
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

                // Super Admin has NO particular store
                if (isSuperAdmin) {
                    const cleanUser = {
                        ...storedUser,
                        locCode: "",
                        storeName: null,
                        storeId: null,
                        username: "Brynex Admin"
                    };
                    if (storedUser.locCode || storedUser.storeName || storedUser.username === "Warehouse" || storedUser.username === "SuitorGuy MG Road" || storedUser.username === "Brides Berry") {
                        try {
                            localStorage.setItem("rootfinuser", JSON.stringify(cleanUser));
                        } catch (e) {}
                    }
                    setCurrentUser(cleanUser);
                    setSelectedValue("");
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
    const isGlobalAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'financial_admin';
    const isCluster = userRole.includes('cluster');

    const canSwitchLocation = 
        isGlobalAdmin || 
        isCluster ||
        (currentUser?.allowedLocCodes && currentUser.allowedLocCodes.length > 1);

    const selectableLocations = isGlobalAdmin
        ? AllLoation
        : AllLoation.filter(item => (currentUser?.allowedLocCodes || []).includes(item.locCode));

    return (
        <header className="bg-white border-b border-[#E5E5E5] h-[56px] flex items-center relative z-40">
            <div className="w-full pl-14 md:pl-6 pr-6 flex items-center justify-between mx-auto">
                <div className="flex items-center gap-3">
                    {prop.title && (
                        <h1 className="text-[20px] md:text-[24px] font-semibold text-[#212121] tracking-tight">{prop.title}</h1>
                    )}
                </div>

                {/* Right corner: Notification Bell + Store Selection Dropdown Pill */}
                <div className="flex items-center gap-4 relative" ref={dropdownRef}>
                    {/* Notification Bell */}
                    <div className="relative text-[#6A6A6A] hover:text-[#212121] cursor-pointer p-1.5 transition-colors" title="Notifications">
                        <Bell size={19} className="text-[#6A6A6A]" />
                        <span className="absolute 0 top-0.5 right-0.5 bg-[#DC2626] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                            3
                        </span>
                    </div>

                    {/* Store Selection Pill */}
                    <div className="relative">
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
