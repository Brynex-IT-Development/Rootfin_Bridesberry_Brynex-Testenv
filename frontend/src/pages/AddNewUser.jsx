import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaTimes } from "react-icons/fa";
import { ArrowLeft } from "lucide-react";
import baseUrl from "../api/api";
import { useSidebar } from "../hooks/useSidebar";
import { fetchActiveStores, saveCustomStore } from "../utils/storeService";

const AddNewUser = () => {
    const isSidebarOpen = useSidebar();
    const navigate = useNavigate();

    // Form states
    const [role, setRole] = useState("");
    const [storeName, setStoreName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [gst, setGst] = useState("");
    const [locCode, setLocCode] = useState("");
    const [address, setAddress] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    
    // Cluster manager assigned stores
    const [allowedLocCodes, setAllowedLocCodes] = useState([]);
    const [showStoreDropdown, setShowStoreDropdown] = useState(false);
    const [storeSearchTerm, setStoreSearchTerm] = useState("");
    const [availableStores, setAvailableStores] = useState([
        { locName: "Brides Berry", locCode: "155" },
        { locName: "Warehouse", locCode: "858" },
    ]);
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
        if (newRole !== "store_admin") {
            setStoreName("");
            setLocCode("");
            setGst("");
            setAddress("");
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

        if (role === "store_admin") {
            if (!storeName.trim()) {
                alert("Please enter the Store Name.");
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
        const isCluster = role === "cluster_admin";
        const derivedUsername = isStore ? storeName.trim() : email.split('@')[0];

        const payload = {
            username: derivedUsername,
            storeName: isStore ? storeName.trim() : undefined,
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            gst: isStore ? gst.trim() : "",
            locCode: isStore ? locCode.trim() : "",
            address: isStore ? address.trim() : "",
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
                if (isStore && locCode.trim()) {
                    saveCustomStore({
                        locCode: locCode.trim(),
                        locName: storeName.trim(),
                        address: address.trim(),
                        phone: phone.trim(),
                        email: email.trim().toLowerCase()
                    });
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
    const isClusterAdmin = role === "cluster_admin";

    return (
        <div className={`min-h-screen bg-gray-50/50 transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "ml-0"}`}>
            <div className="p-8 max-w-[1400px] mx-auto">
                
                {/* Header Row with Back Button */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 bg-[#18181b] hover:bg-black text-white rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer"
                        title="Back"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Add New User</h1>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">

                        {/* Store Admin layout: Role & Store Name in first row, then Email & Phone */}
                        {isStoreAdmin ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Role * */}
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-700">
                                            Role <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={role}
                                                onChange={(e) => handleRoleChange(e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm appearance-none cursor-pointer"
                                                required
                                            >
                                                <option value="">Select Role</option>
                                                <option value="super_admin">Super Admin</option>
                                                <option value="admin">Admin</option>
                                                <option value="financial_admin">Financial Admin</option>
                                                <option value="cluster_admin">Cluster Admin</option>
                                                <option value="store_admin">Store Admin</option>
                                                <option value="normal_user">Normal User</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                                                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                                                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Store Name * (Only for Store Admin) */}
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-700">
                                            Store Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={storeName}
                                            onChange={(e) => setStoreName(e.target.value)}
                                            placeholder="Enter store name"
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Email * */}
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-700">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter email address"
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400"
                                            required
                                        />
                                    </div>

                                    {/* Phone Number */}
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-700">
                                            Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="Enter phone number"
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400"
                                        />
                                    </div>
                                </div>

                                {/* Store Details: Loc Code, GST Number, Store Address */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Loc Code * */}
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-700">
                                            Loc Code <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={locCode}
                                            onChange={(e) => setLocCode(e.target.value)}
                                            placeholder="Enter location code"
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400"
                                            required
                                        />
                                    </div>

                                    {/* GST Number */}
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-700">
                                            GST Number
                                        </label>
                                        <input
                                            type="text"
                                            value={gst}
                                            onChange={(e) => setGst(e.target.value)}
                                            placeholder="eg12345565455454"
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400"
                                        />
                                    </div>

                                    {/* Store Address */}
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-700">
                                            Store Address
                                        </label>
                                        <input
                                            type="text"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="Enter store address"
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Non-Store Admin layout (Super Admin, Admin, Financial Admin, Cluster Admin, Normal User) */
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Role * */}
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Role <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={role}
                                            onChange={(e) => handleRoleChange(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm appearance-none cursor-pointer"
                                            required
                                        >
                                            <option value="">Select Role</option>
                                            <option value="super_admin">Super Admin</option>
                                            <option value="admin">Admin</option>
                                            <option value="financial_admin">Financial Admin</option>
                                            <option value="cluster_admin">Cluster Admin</option>
                                            <option value="store_admin">Store Admin</option>
                                            <option value="normal_user">Normal User</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Email * */}
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter email address"
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400"
                                        required
                                    />
                                </div>

                                {/* Phone Number */}
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="Enter phone number"
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Conditional Cluster Admin: Assign Stores Dropdown */}
                        {isClusterAdmin && (
                            <div className="p-6 bg-purple-50/50 rounded-xl border border-purple-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-semibold text-gray-800">
                                        Assign Stores to Cluster Admin <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-3 text-xs">
                                        <button
                                            type="button"
                                            onClick={handleSelectAllStores}
                                            className="text-purple-700 hover:text-purple-900 font-medium cursor-pointer"
                                        >
                                            Select All ({availableStores.length})
                                        </button>
                                        <span className="text-gray-300">|</span>
                                        <button
                                            type="button"
                                            onClick={handleClearAllStores}
                                            className="text-gray-500 hover:text-gray-700 cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>

                                <div className="relative" ref={dropdownRef}>
                                    <div
                                        onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                                        className="w-full min-h-[48px] px-4 py-2 bg-white border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-purple-500 cursor-pointer flex flex-wrap gap-2 items-center justify-between"
                                    >
                                        <div className="flex flex-wrap gap-2 items-center flex-1">
                                            {allowedLocCodes.length === 0 ? (
                                                <span className="text-gray-400 text-sm">Select stores currently available...</span>
                                            ) : (
                                                allowedLocCodes.map((code) => (
                                                    <span
                                                        key={code}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                                                    >
                                                        {getStoreDisplayName(code)} ({code})
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleStore(code);
                                                            }}
                                                            className="hover:text-purple-900"
                                                        >
                                                            <FaTimes size={10} />
                                                        </button>
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                        <span className="text-xs text-purple-600 font-semibold px-2 py-1 bg-purple-50 rounded">
                                            {allowedLocCodes.length} selected
                                        </span>
                                    </div>

                                    {showStoreDropdown && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                            <input
                                                type="text"
                                                value={storeSearchTerm}
                                                onChange={(e) => setStoreSearchTerm(e.target.value)}
                                                placeholder="Search store name or location code..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 outline-none focus:border-purple-500"
                                                autoFocus
                                            />
                                            <div className="max-h-56 overflow-y-auto space-y-1">
                                                {filteredStores.length === 0 ? (
                                                    <p className="text-xs text-gray-400 py-3 text-center">No matching stores found</p>
                                                ) : (
                                                    filteredStores.map(store => {
                                                        const isSelected = allowedLocCodes.includes(store.locCode);
                                                        return (
                                                            <div
                                                                key={store.locCode}
                                                                onClick={() => handleToggleStore(store.locCode)}
                                                                className={`p-2.5 rounded-lg cursor-pointer text-sm flex items-center justify-between transition-colors ${
                                                                    isSelected ? "bg-purple-100/70 text-purple-900 font-semibold" : "hover:bg-purple-50 text-gray-700"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => {}}
                                                                        className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer pointer-events-none"
                                                                    />
                                                                    <span>{store.locName || store.name}</span>
                                                                </div>
                                                                <span className="text-xs text-gray-400">Loc: {store.locCode}</span>
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
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700">
                                    Set Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400 pr-12"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-600 hover:text-purple-700 cursor-pointer"
                                    >
                                        {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password * */}
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700">
                                    Confirm Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm your password"
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-700 text-sm placeholder-gray-400 pr-12"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-600 hover:text-purple-700 cursor-pointer"
                                    >
                                        {showConfirmPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Buttons Row: Save User, Cancel */}
                        <div className="flex items-center gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3 bg-[#a855f7] hover:bg-[#9333ea] text-white font-medium rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50 text-sm"
                            >
                                {loading ? "Saving..." : "Save User"}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors cursor-pointer text-sm"
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
