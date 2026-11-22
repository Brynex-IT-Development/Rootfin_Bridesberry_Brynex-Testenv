import { useState, useEffect } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";
import { normalizeRole } from "../utils/roleUtils";
import { fetchActiveStores, saveCustomStore, removeCustomStore } from "../utils/storeService";

const EditUser = () => {
    const isSidebarOpen = useSidebar();
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const storeFromState = location.state?.store;

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [locCode, setLocCode] = useState("");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [gst, setGst] = useState("");
    const [role, setRole] = useState("");
    const [allowedLocCodes, setAllowedLocCodes] = useState([]);
    const [availableStores, setAvailableStores] = useState([
        { locName: "Brides Berry", locCode: "155" },
        { locName: "Warehouse", locCode: "858" },
    ]);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadStores = async () => {
            try {
                const list = await fetchActiveStores();
                if (list && list.length > 0) {
                    setAvailableStores(list);
                }
            } catch (e) {
                console.error("Error loading stores:", e);
            }
        };
        loadStores();
    }, []);

    useEffect(() => {
        if (storeFromState) {
            setUsername(storeFromState.storeName || storeFromState.username || "");
            setEmail(storeFromState.email || "");
            setLocCode(storeFromState.locCode || "");
            setAddress(storeFromState.address || "");
            setPhone(storeFromState.phone || "");
            setGst(storeFromState.gst || "");
            setRole(normalizeRole(storeFromState.role) || "");
            setAllowedLocCodes(storeFromState.allowedLocCodes || []);
        }
    }, [storeFromState]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email) {
            alert("Email is required.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert("Please enter a valid email address.");
            return;
        }

        const isStore = role === "store_admin";
        const isCluster = role === "cluster_admin";

        if (isStore) {
            if (!username.trim()) {
                alert("Store Name is required for Store Admin.");
                return;
            }
            if (!locCode.trim()) {
                alert("Location Code is required for Store Admin.");
                return;
            }
        }

        if (isCluster && allowedLocCodes.length === 0) {
            alert("Please assign at least one store for Cluster Admin role.");
            return;
        }

        const payload = {
            username: isStore ? (username.trim() || email.split('@')[0]) : email.split('@')[0],
            storeName: isStore ? username.trim() : undefined,
            email: email.trim().toLowerCase(),
            locCode: isStore ? locCode.trim() : "",
            address: isStore ? address.trim() : "",
            phone: phone.trim(),
            gst: isStore ? gst.trim() : "",
            role: role || undefined,
            allowedLocCodes: isCluster ? allowedLocCodes : [],
        };

        if (password) {
            payload.password = password;
        }

        try {
            setLoading(true);
            
            const response = await fetch(`${baseUrl.baseUrl}user/updateUser/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                const oldLocCode = (storeFromState?.locCode || "").toString().trim();
                const newLocCode = isStore ? locCode.trim() : "";
                if (oldLocCode && oldLocCode !== newLocCode) {
                    removeCustomStore(oldLocCode);
                }

                if (isStore && locCode.trim()) {
                    saveCustomStore({
                        locCode: locCode.trim(),
                        locName: username.trim(),
                        address: address.trim(),
                        phone: phone.trim(),
                        email: email.trim().toLowerCase(),
                        gst: gst.trim()
                    });
                    fetchActiveStores().catch(() => {});
                }
                alert(data.message || "User updated successfully!");
                navigate("/manage-users/existing-users");
            } else {
                alert(data.message || "Failed to update user. Please try again.");
            }
        } catch (error) {
            console.error("Error updating user:", error);
            alert("An error occurred while updating the user. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const isStoreAdmin = role === "store_admin";
    const isClusterAdmin = role === "cluster_admin";

    return (
        <>
            <Header title="Edit User" />
            <div className={`p-6 transition-all duration-300 ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
                <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-2xl p-8 border border-gray-100">
                    <h2 className="text-2xl font-bold text-center mb-6 text-gray-900">
                        Edit User
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Role selection */}
                        <div>
                            <label className="block mb-2 text-sm font-semibold text-gray-700">
                                User Role *
                            </label>
                            <select
                                value={role}
                                onChange={(e) => {
                                    setRole(e.target.value);
                                    if (e.target.value !== "store_admin") {
                                        setLocCode("");
                                        setGst("");
                                        setAddress("");
                                    }
                                    if (e.target.value !== "cluster_admin") {
                                        setAllowedLocCodes([]);
                                    }
                                }}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-gray-700 text-sm"
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
                            </select>
                        </div>

                        {/* Store Admin: Store Name, Loc Code, GST, Address */}
                        {isStoreAdmin && (
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Store Name *
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="e.g., Brides Berry"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block mb-2 text-sm font-semibold text-gray-700">
                                Email Address *
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="e.g., user@example.com"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label className="block mb-2 text-sm font-semibold text-gray-700">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="e.g., +91 9876543210"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                            />
                        </div>

                        {/* Store Admin specific details */}
                        {isStoreAdmin && (
                            <>
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                                        Location Code *
                                    </label>
                                    <input
                                        type="text"
                                        value={locCode}
                                        onChange={(e) => setLocCode(e.target.value)}
                                        placeholder="e.g., 155"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                                        GST Number
                                    </label>
                                    <input
                                        type="text"
                                        value={gst}
                                        onChange={(e) => setGst(e.target.value)}
                                        placeholder="e.g., 29ABCDE1234F1Z5"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                                        Store Address
                                    </label>
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="e.g., MG Road, Kochi, Kerala - 682016"
                                        rows="3"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none text-sm"
                                    />
                                </div>
                            </>
                        )}

                        {/* Cluster Admin: Assign Stores */}
                        {isClusterAdmin && (
                            <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Assign Stores to Cluster Admin <span className="text-red-500">*</span>
                                </label>
                                <div className="border border-gray-200 bg-white rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                                    {availableStores.map(s => (
                                        <label key={s.locCode} className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700 hover:text-purple-700">
                                            <input
                                                type="checkbox"
                                                checked={allowedLocCodes.includes(s.locCode)}
                                                onChange={(e) => {
                                                    setAllowedLocCodes(prev =>
                                                        e.target.checked
                                                            ? [...prev, s.locCode]
                                                            : prev.filter(c => c !== s.locCode)
                                                    );
                                                }}
                                                className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                                            />
                                            <span>{s.locName || s.name} ({s.locCode})</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-purple-600 font-medium mt-2">{allowedLocCodes.length} store(s) selected</p>
                            </div>
                        )}

                        {/* Optional password update */}
                        <div>
                            <label className="block mb-2 text-sm font-semibold text-gray-700">
                                Password (Leave blank to keep current)
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter new password (optional)"
                                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                                />
                                <span
                                    className="absolute right-4 top-3.5 text-purple-600 cursor-pointer"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-center gap-4 pt-4">
                            <button
                                type="button"
                                onClick={() => navigate("/manage-users/existing-users")}
                                className="w-[40%] py-3 rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium text-sm transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={`w-[40%] py-3 rounded-xl text-white font-medium text-sm transition-colors cursor-pointer ${
                                    loading
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-[#a855f7] hover:bg-[#9333ea]"
                                }`}
                                disabled={loading}
                            >
                                {loading ? "Updating..." : "Update User"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default EditUser;
