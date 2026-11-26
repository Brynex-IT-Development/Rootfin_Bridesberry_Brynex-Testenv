import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaTimes } from "react-icons/fa";
import { ChevronDown } from "lucide-react";
import baseUrl from "../api/api";
import { useSidebar } from "../hooks/useSidebar";
import { fetchActiveStores, saveCustomStore } from "../utils/storeService";
import Header from "../components/Header.jsx";

import AppSelect from "../components/AppSelect.jsx";
const AddNewUser = () => {
    const isSidebarOpen = useSidebar();
    const navigate = useNavigate();

    // Form states (preserving all original fields & role options)
    const [role, setRole] = useState("");
    const [storeName, setStoreName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [gst, setGst] = useState("");
    const [locCode, setLocCode] = useState("");
    const [address, setAddress] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Cluster admin assigned stores
    const [allowedLocCodes, setAllowedLocCodes] = useState([]);
    const [showStoreDropdown, setShowStoreDropdown] = useState(false);
    const [storeSearchTerm, setStoreSearchTerm] = useState("");
    const [availableStores, setAvailableStores] = useState([]);
    const dropdownRef = useRef(null);

    // Password visibility toggles
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadStores = async () => {
            try {
                const stores = await fetchActiveStores();
                if (stores && stores.length > 0) {
                    setAvailableStores(stores);
                }
            } catch (err) {
                console.error("Error loading stores:", err);
            }
        };
        loadStores();
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowStoreDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredStores = availableStores.filter(store =>
        (store.locName || store.name || "").toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
        (store.locCode || "").toLowerCase().includes(storeSearchTerm.toLowerCase())
    );

    const handleToggleStore = (code) => {
        if (allowedLocCodes.includes(code)) {
            setAllowedLocCodes(allowedLocCodes.filter(c => c !== code));
        } else {
            setAllowedLocCodes([...allowedLocCodes, code]);
        }
    };

    const handleSelectAllStores = () => {
        const allCodes = availableStores.map(s => s.locCode);
        setAllowedLocCodes(allCodes);
    };

    const handleClearAllStores = () => {
        setAllowedLocCodes([]);
    };

    const getStoreDisplayName = (code) => {
        const store = availableStores.find(s => s.locCode === code);
        return store ? (store.locName || store.name) : code;
    };

    const handleRoleChange = (newRole) => {
        setRole(newRole);
        if (newRole !== "store_admin" && newRole !== "warehouse_admin") {
            setStoreName("");
            setLocCode("");
            setGst("");
            setAddress("");
        } else if (newRole === "warehouse_admin") {
            if (!storeName) setStoreName("Warehouse");
            if (!locCode) setLocCode("858");
        }
        if (newRole !== "cluster_admin") {
            setAllowedLocCodes([]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!role) {
            alert("Please select a User Role.");
            return;
        }

        if (!email) {
            alert("Please enter a valid Email.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert("Please enter a valid email address format.");
            return;
        }

        if (role === "store_admin" || role === "warehouse_admin") {
            if (!storeName.trim()) {
                alert(`Please enter the ${role === "warehouse_admin" ? "Warehouse" : "Store"} Name.`);
                return;
            }
            if (!locCode.trim()) {
                alert("Please enter the Location Code.");
                return;
            }
        }

        if (role === "cluster_admin" && allowedLocCodes.length === 0) {
            alert("Please assign at least one store for Cluster Admin role.");
            return;
        }

        if (!password) {
            alert("Password is required.");
            return;
        }

        if (password.length < 6) {
            alert("Password must be at least 6 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        const isStore = role === "store_admin";
        const isWarehouse = role === "warehouse_admin";
        const isStoreOrWarehouse = isStore || isWarehouse;
        const isCluster = role === "cluster_admin";
        const derivedUsername = isStoreOrWarehouse ? storeName.trim() : email.split('@')[0];

        const payload = {
            username: derivedUsername,
            storeName: isStoreOrWarehouse ? storeName.trim() : undefined,
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            gst: isStoreOrWarehouse ? gst.trim() : "",
            locCode: isStoreOrWarehouse ? locCode.trim() : "",
            address: isStoreOrWarehouse ? address.trim() : "",
            role: role || undefined,
            allowedLocCodes: isCluster ? allowedLocCodes : [],
            password,
        };

        try {
            setLoading(true);

            const response = await fetch(`${baseUrl.baseUrl}user/signin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                if (isStore || isWarehouse) {
                    const code = isStore ? locCode.trim() : (locCode.trim() || "858");
                    const name = isStore ? storeName.trim() : (storeName.trim() || "Warehouse");
                    if (code) {
                        saveCustomStore({
                            locCode: code,
                            locName: name,
                            address: address.trim(),
                            phone: phone.trim(),
                            email: email.trim().toLowerCase()
                        });
                        fetchActiveStores().catch(() => {});
                    }
                }

                alert(data.message || "User created successfully!");
                navigate("/manage-users/existing-users");
            } else {
                alert(data.message || "Error creating user.");
            }
        } catch (error) {
            console.error("Error creating user:", error);
            alert("An error occurred while creating the user.");
        } finally {
            setLoading(false);
        }
    };

    const isStoreAdmin = role === "store_admin";
    const isWarehouseAdmin = role === "warehouse_admin";
    const isStoreOrWarehouse = isStoreAdmin || isWarehouseAdmin;
    const isClusterAdmin = role === "cluster_admin";

    const roleSelectField = (
        <div className="rf-form-field !mb-0">
            <label className="rf-field-label">
                Role <span className="required">*</span>
            </label>
            <div className="relative">
                <AppSelect
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className={`rf-input appearance-none !pr-11 cursor-pointer ${!role ? "!text-[#A3A3A3] !font-normal" : ""}`}
                    required
                >
                    <option value="">Select Role</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="warehouse_admin">Warehouse Admin</option>
                    <option value="financial_admin">Financial Admin</option>
                    <option value="cluster_admin">Cluster Admin</option>
                    <option value="store_admin">Store Admin</option>
                    <option value="normal_user">Normal User</option>
                </AppSelect>
                
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#FFFFFF]">
            <Header title="Add New User" />

            <div className={`transition-all duration-300 ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
                {/* Clean Page Title Header */}
                <div className="bg-white px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
                    <h1 className="text-[18px] font-semibold text-[#212121]">Add New User</h1>
                </div>

                {/* Form Section */}
                <div className="bg-white px-8 py-7 max-w-[1400px]">
                    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

                        {/* Store / Warehouse Admin layout */}
                        {isStoreOrWarehouse ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {roleSelectField}

                                    {/* Store Name / Warehouse Name * */}
                                    <div className="rf-form-field !mb-0">
                                        <label className="rf-field-label">
                                            {isWarehouseAdmin ? "Warehouse Name" : "Store Name"} <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={storeName}
                                            onChange={(e) => setStoreName(e.target.value)}
                                            placeholder={isWarehouseAdmin ? "Enter warehouse name" : "Enter store name"}
                                            className="rf-input"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Email * */}
                                    <div className="rf-form-field !mb-0">
                                        <label className="rf-field-label">
                                            Email <span className="required">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter email address"
                                            className="rf-input"
                                            required
                                        />
                                    </div>

                                    {/* Phone Number */}
                                    <div className="rf-form-field !mb-0">
                                        <label className="rf-field-label">
                                            Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="Enter phone number"
                                            className="rf-input"
                                        />
                                    </div>
                                </div>

                                {/* Store Details: Loc Code, GST Number, Store/Warehouse Address */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Loc Code * */}
                                    <div className="rf-form-field !mb-0">
                                        <label className="rf-field-label">
                                            Loc Code <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={locCode}
                                            onChange={(e) => setLocCode(e.target.value)}
                                            placeholder={isWarehouseAdmin ? "e.g., 858" : "Enter location code"}
                                            className="rf-input"
                                            required
                                        />
                                    </div>

                                    {/* GST Number */}
                                    <div className="rf-form-field !mb-0">
                                        <label className="rf-field-label">
                                            GST Number
                                        </label>
                                        <input
                                            type="text"
                                            value={gst}
                                            onChange={(e) => setGst(e.target.value)}
                                            placeholder="eg12345565455454"
                                            className="rf-input"
                                        />
                                    </div>

                                    {/* Store / Warehouse Address */}
                                    <div className="rf-form-field !mb-0">
                                        <label className="rf-field-label">
                                            {isWarehouseAdmin ? "Warehouse Address" : "Store Address"}
                                        </label>
                                        <input
                                            type="text"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder={isWarehouseAdmin ? "Enter warehouse address" : "Enter store address"}
                                            className="rf-input"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Default / Non-Store Admin layout: Role *, Email *, Phone Number */
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {roleSelectField}

                                {/* Email * */}
                                <div className="rf-form-field !mb-0">
                                    <label className="rf-field-label">
                                        Email <span className="required">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter email address"
                                        className="rf-input"
                                        required
                                    />
                                </div>

                                {/* Phone Number */}
                                <div className="rf-form-field !mb-0">
                                    <label className="rf-field-label">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="Enter phone number"
                                        className="rf-input"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Conditional Cluster Admin: Assign Stores Dropdown */}
                        {isClusterAdmin && (
                            <div className="p-5 bg-[#FBF5FC] rounded-xl border border-[#E5E5E5] space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="rf-field-label !mb-0">
                                        Assign Stores to Cluster Admin <span className="required">*</span>
                                    </label>
                                    <div className="flex items-center gap-3 text-xs">
                                        <button
                                            type="button"
                                            onClick={handleSelectAllStores}
                                            className="text-[#9D43D6] hover:text-[#8B3CBD] font-medium cursor-pointer"
                                        >
                                            Select All ({availableStores.length})
                                        </button>
                                        <span className="text-[#E5E5E5]">|</span>
                                        <button
                                            type="button"
                                            onClick={handleClearAllStores}
                                            className="text-[#6A6A6A] hover:text-[#212121] cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>

                                <div className="relative" ref={dropdownRef}>
                                    <div
                                        onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                                        className="w-full min-h-[40px] px-3.5 py-1.5 bg-white border border-[#E5E5E5] rounded-[10px] focus-within:border-[#9B48D7] focus-within:ring-1 focus-within:ring-[#9B48D7] cursor-pointer flex flex-wrap gap-2 items-center justify-between"
                                    >
                                        <div className="flex flex-wrap gap-1.5 items-center flex-1">
                                            {allowedLocCodes.length === 0 ? (
                                                <span className="text-[#A3A3A3] text-[13px]">Select stores currently available...</span>
                                            ) : (
                                                allowedLocCodes.map((code) => (
                                                    <span
                                                        key={code}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#9D43D6]/10 text-[#9D43D6] rounded-full text-xs font-medium"
                                                    >
                                                        {getStoreDisplayName(code)} ({code})
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleStore(code);
                                                            }}
                                                            className="hover:text-[#8B3CBD] cursor-pointer"
                                                        >
                                                            <FaTimes size={10} />
                                                        </button>
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                        <span className="text-xs text-[#9D43D6] font-semibold px-2 py-0.5 bg-[#9D43D6]/10 rounded">
                                            {allowedLocCodes.length} selected
                                        </span>
                                    </div>

                                    {showStoreDropdown && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-[#E5E5E5] rounded-[10px] shadow-lg p-3">
                                            <input
                                                type="text"
                                                value={storeSearchTerm}
                                                onChange={(e) => setStoreSearchTerm(e.target.value)}
                                                placeholder="Search store name or location code..."
                                                className="rf-input mb-2"
                                                autoFocus
                                            />
                                            <div className="max-h-56 overflow-y-auto space-y-1">
                                                {filteredStores.length === 0 ? (
                                                    <p className="text-xs text-[#A3A3A3] py-3 text-center">No matching stores found</p>
                                                ) : (
                                                    filteredStores.map(store => {
                                                        const isSelected = allowedLocCodes.includes(store.locCode);
                                                        return (
                                                            <div
                                                                key={store.locCode}
                                                                onClick={() => handleToggleStore(store.locCode)}
                                                                className={`p-2 rounded-lg cursor-pointer text-[13px] flex items-center justify-between transition-colors ${
                                                                    isSelected ? "bg-[#FBF5FC] text-[#9D43D6] font-medium" : "hover:bg-[#F7F7F7] text-[#212121]"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => {}}
                                                                        className="rounded accent-[#9D43D6] cursor-pointer pointer-events-none"
                                                                    />
                                                                    <span>{store.locName || store.name}</span>
                                                                </div>
                                                                <span className="text-xs text-[#6A6A6A]">Loc: {store.locCode}</span>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Passwords: Set Password, Confirm Password */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Set Password * */}
                            <div className="rf-form-field !mb-0">
                                <label className="rf-field-label">
                                    Set Password <span className="required">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="rf-input !pr-12"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3.5 pl-2.5 flex items-center text-[#9D43D6] hover:text-[#8B3CBD] cursor-pointer"
                                    >
                                        <span className="h-4 w-[1px] bg-[#E5E5E5] mr-2.5" />
                                        {showPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password * */}
                            <div className="rf-form-field !mb-0">
                                <label className="rf-field-label">
                                    Confirm Password <span className="required">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm your password"
                                        className="rf-input !pr-12"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-3.5 pl-2.5 flex items-center text-[#9D43D6] hover:text-[#8B3CBD] cursor-pointer"
                                    >
                                        <span className="h-4 w-[1px] bg-[#E5E5E5] mr-2.5" />
                                        {showConfirmPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Buttons Row: Save User, Cancel */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className={loading ? "rf-btn-disabled" : "rf-btn-primary cursor-pointer !px-6"}
                            >
                                {loading ? "Saving..." : "Save User"}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="rf-btn-cancel cursor-pointer !px-6"
                            >
                                Cancel
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddNewUser;
