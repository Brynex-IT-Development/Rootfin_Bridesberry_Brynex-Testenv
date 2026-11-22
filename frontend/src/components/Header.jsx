import { useState, useEffect, useRef } from "react";
import { Bell, MapPin, ChevronDown, Check } from "lucide-react";
import Rootments from '../assets/Rootments.jpg';
import baseUrl from '../api/api';
import { getActiveStores, fetchActiveStores } from "../utils/storeService.js";

const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

// Function to format location names with proper spacing
const formatLocationName = (name) => {
    if (!name) return name;
    
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
                const isAdmin = storedUser.power === 'admin';
                const isClusterManager = (storedUser.role || '').toLowerCase() === 'cluster_manager';

                // For regular store users: NEVER overwrite their store name or locCode!
                if (!isAdmin && !isClusterManager) {
                    setCurrentUser(storedUser);
                    setSelectedValue(storedUser.locCode || "");
                    return;
                }

                // For admin or cluster manager: match their active location or default to Warehouse
                const foundLoc = locations.find(loc => loc.locCode === storedUser.locCode);
                const activeLoc = foundLoc || locations.find(loc => loc.locCode === "858") || locations[0];
                if (activeLoc) {
                    const updatedUser = {
                        ...storedUser,
                        locCode: activeLoc.locCode,
                        username: activeLoc.locName
                    };
                    if (!foundLoc && locations.length > 0) {
                        try {
                            localStorage.setItem("rootfinuser", JSON.stringify(updatedUser));
                        } catch (e) {}
                    }
                    setCurrentUser(updatedUser);
                    setSelectedValue(activeLoc.locCode);
                } else {
                    setCurrentUser(storedUser);
                    setSelectedValue(storedUser.locCode);
                }
            }
        } catch (error) {
            console.error("Error syncing user from storage:", error);
        }
    };

    useEffect(() => {
        const load = async () => {
            const locations = await fetchActiveStores();
            if (locations && locations.length > 0) {
                setAllLoation(locations);
                syncUserFromStorage(locations);
            }
        };
        load();

        const handleStoresUpdated = (e) => {
            if (e.detail && Array.isArray(e.detail)) {
                setAllLoation(e.detail);
                syncUserFromStorage(e.detail);
            }
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

        const updatedUser = {
            ...currentUser,
            locCode: selectedCode,
            username: selectedName,
        };

        localStorage.setItem("rootfinuser", JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
        setIsDropdownOpen(false);
        window.location.reload();
    };

    // Get display name with fallback to localStorage
    const getDisplayName = () => {
        if (currentUser?.username) {
            return currentUser.username;
        }
        // Fallback: try to get from localStorage directly
        try {
            const storedUser = JSON.parse(localStorage.getItem("rootfinuser"));
            if (storedUser?.username) {
                return storedUser.username;
            }
        } catch (error) {
            // Ignore errors
        }
        return "";
    };

    const displayName = getDisplayName();

    const canSwitchLocation = 
        currentUser?.power === 'admin' || 
        currentUser?.power === 'superadmin' || 
        currentUser?.power === 'super_admin' || 
        (currentUser?.role || '').toLowerCase().includes('admin') || 
        (currentUser?.role || '').toLowerCase().includes('cluster') ||
        (currentUser?.allowedLocCodes && currentUser.allowedLocCodes.length > 1);

    const selectableLocations = (currentUser?.power === 'admin' || (currentUser?.role || '').toLowerCase().includes('admin'))
        ? AllLoation
        : AllLoation.filter(item => (currentUser?.allowedLocCodes || []).includes(item.locCode));

    return (
        <nav className="bg-white border-b border-gray-200 shadow-xs relative z-40">
            <div className="max-w-full pl-14 md:pl-16 pr-6 py-3 flex items-center justify-between mx-auto">
                <div className="flex items-center gap-3">
                    {prop.title && (
                        <h1 className="text-xl font-bold text-gray-800">{prop.title}</h1>
                    )}
                </div>

                {/* Right corner: Notification Bell + Store Selection Dropdown Pill */}
                <div className="flex items-center gap-4 relative" ref={dropdownRef}>
                    {/* Notification Bell */}
                    <div className="relative text-gray-500 hover:text-gray-700 cursor-pointer p-1 transition-colors" title="Notifications">
                        <Bell size={20} className="text-gray-600" />
                        <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                            3
                        </span>
                    </div>

                    {/* Store Selection Pill */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => canSwitchLocation && setIsDropdownOpen(prev => !prev)}
                            className={`flex items-center gap-2 px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 shadow-xs transition-all ${
                                canSwitchLocation ? 'cursor-pointer hover:border-gray-300 hover:bg-gray-50' : 'cursor-default'
                            }`}
                        >
                            <MapPin size={16} className="text-gray-500 shrink-0" />
                            <span className="whitespace-nowrap font-medium text-gray-800">
                                {formatLocationName(displayName) || "Warehouse"}
                            </span>
                            {canSwitchLocation && (
                                <ChevronDown size={15} className={`text-gray-400 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && canSwitchLocation && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 z-50 max-h-80 overflow-y-auto">
                                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
                                    Switch Location
                                </div>
                                {selectableLocations.map((item) => {
                                    const isSelected = selectedValue === item.locCode;
                                    return (
                                        <button
                                            key={item.locCode}
                                            type="button"
                                            onClick={() => handleSelectLocation(item.locCode, item.locName)}
                                            className={`w-full flex items-center justify-between px-3.5 py-2 text-sm text-left transition-colors cursor-pointer ${
                                                isSelected 
                                                    ? "bg-purple-50 text-purple-700 font-semibold" 
                                                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                            }`}
                                        >
                                            <span className="truncate">{formatLocationName(item.locName)}</span>
                                            {isSelected && <Check size={16} className="text-purple-600 shrink-0 ml-2" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Header;
