import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, ChevronRight, ChevronDown, ChevronLeft, Pencil, Trash2, Mail, Phone, MapPin, ShieldCheck, Eye, Search } from "lucide-react";
import baseUrl from "../api/api";
import { useSidebar } from "../hooks/useSidebar.js";
import { SYSTEM_ROLES, normalizeRole, getRoleLabel } from "../utils/roleUtils";
import { fetchActiveStores, saveCustomStore, removeCustomStore } from "../utils/storeService";
import Header from "../components/Header.jsx";

import AppSelect from "../components/AppSelect.jsx";
const ROLE_GROUPS = [
    { key: "super_admin", label: "SUPER ADMIN" },
    { key: "admin", label: "ADMIN" },
    { key: "warehouse_admin", label: "WAREHOUSE ADMIN" },
    { key: "financial_admin", label: "FINANCIAL ADMIN" },
    { key: "cluster_admin", label: "CLUSTER ADMIN" },
    { key: "store_admin", label: "STORE ADMIN" },
    { key: "normal_user", label: "NORMAL USER" },
];

const ExistingUsers = () => {
    const isSidebarOpen = useSidebar();
    const [stores, setStores] = useState([]);
    const [loadingStores, setLoadingStores] = useState(false);
    const [openGroups, setOpenGroups] = useState({});
    const [searchQuery, setSearchQuery] = useState("");

    // Dynamic available stores for cluster admin selection
    const [availableStores, setAvailableStores] = useState([]);

    // View panel state
    const [viewUser, setViewUser] = useState(null);

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editUsername, setEditUsername] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editGst, setEditGst] = useState("");
    const [editLocCode, setEditLocCode] = useState("");
    const [editAddress, setEditAddress] = useState("");
    const [editRole, setEditRole] = useState("");
    const [editAllowedLocCodes, setEditAllowedLocCodes] = useState([]);
    const [editLoading, setEditLoading] = useState(false);
    const [editStoreSearch, setEditStoreSearch] = useState("");
    const [showEditStoreDropdown, setShowEditStoreDropdown] = useState(false);

    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        fetchStores();
        loadAvailableStores();
    }, []);

    const loadAvailableStores = async () => {
        try {
            const list = await fetchActiveStores();
            if (list && list.length > 0) {
                setAvailableStores(list);
            }
        } catch (e) {
            console.error("Error loading available stores:", e);
        }
    };

    const getStoreName = (code) => {
        const s = availableStores.find(s => s.locCode === code);
        return s ? (s.locName || s.name) : code;
    };

    const fetchStores = async () => {
        try {
            setLoadingStores(true);
            const response = await fetch(`${baseUrl.baseUrl}user/getAllUsers`);
            const data = await response.json();
            if (response.ok) setStores(data.users || []);
        } catch (error) {
            console.error("Error fetching stores:", error);
        } finally {
            setLoadingStores(false);
        }
    };

    const toggleGroup = (key) => {
        setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const getUsersForRole = (roleKey) => {
        const q = searchQuery.trim().toLowerCase();
        return stores.filter(u => {
            const role = normalizeRole(u.role);
            let matchesRole = false;
            if (roleKey === "super_admin") matchesRole = role === "super_admin";
            else if (roleKey === "admin") matchesRole = role === "admin";
            else if (roleKey === "warehouse_admin") matchesRole = role === "warehouse_admin";
            else if (roleKey === "financial_admin") matchesRole = role === "financial_admin";
            else if (roleKey === "cluster_admin") matchesRole = role === "cluster_admin";
            else if (roleKey === "store_admin") matchesRole = role === "store_admin";
            else if (roleKey === "normal_user") matchesRole = role === "normal_user" || !u.role;

            if (!matchesRole) return false;
            if (!q) return true;

            const name = (u.storeName || u.username || "").toLowerCase();
            const email = (u.email || "").toLowerCase();
            const phone = (u.phone || "").toLowerCase();
            const loc = (u.locCode || "").toLowerCase();
            const roleLbl = getRoleLabel(u.role || "normal_user").toLowerCase();
            return name.includes(q) || email.includes(q) || phone.includes(q) || loc.includes(q) || roleLbl.includes(q);
        });
    };

    const openEditModal = (user) => {
        const normRole = normalizeRole(user.role) || "";
        setSelectedUser(user);
        setEditUsername(user.storeName || user.username || "");
        setEditEmail(user.email || "");
        setEditPhone(user.phone || "");
        setEditGst(user.gst || "");
        setEditLocCode(user.locCode || "");
        setEditAddress(user.address || "");
        setEditRole(normRole);
        setEditAllowedLocCodes(user.allowedLocCodes || []);
        setShowEditModal(true);
    };

    const openDeleteModal = (user) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
    };

    const handleEditSave = async () => {
        try {
            setEditLoading(true);
            const isStore = editRole === "store_admin";
            const isWarehouse = editRole === "warehouse_admin";
            const isCluster = editRole === "cluster_admin";

            if (!editEmail) {
                alert("Email address is required.");
                setEditLoading(false);
                return;
            }

            if (isStore) {
                if (!editUsername.trim()) {
                    alert("Store Name is required for Store Admin.");
                    setEditLoading(false);
                    return;
                }
                if (!editLocCode.trim()) {
                    alert("Location Code is required for Store Admin.");
                    setEditLoading(false);
                    return;
                }
            }

            if (isCluster && editAllowedLocCodes.length === 0) {
                alert("Please assign at least one store for Cluster Admin role.");
                setEditLoading(false);
                return;
            }

            const derivedLocCode = isStore ? editLocCode.trim() : (isWarehouse ? (editLocCode.trim() || "858") : "");
            const derivedStoreName = isStore ? editUsername.trim() : (isWarehouse ? (editUsername.trim() || "Warehouse") : undefined);

            const payload = {
                username: (isStore || isWarehouse) ? (editUsername.trim() || (isWarehouse ? "Warehouse" : editEmail.split('@')[0])) : editEmail.split('@')[0],
                storeName: derivedStoreName,
                email: editEmail.trim().toLowerCase(),
                phone: editPhone.trim(),
                gst: (isStore || isWarehouse) ? editGst.trim() : "",
                locCode: derivedLocCode,
                address: (isStore || isWarehouse) ? editAddress.trim() : "",
                role: editRole || undefined,
                allowedLocCodes: isCluster ? editAllowedLocCodes : [],
            };

            const response = await fetch(`${baseUrl.baseUrl}user/updateUser/${selectedUser._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (response.ok) {
                const oldLocCode = (selectedUser?.locCode || "").toString().trim();
                const newLocCode = derivedLocCode;
                if (oldLocCode && oldLocCode !== newLocCode) {
                    removeCustomStore(oldLocCode);
                }

                if ((isStore || isWarehouse) && newLocCode) {
                    saveCustomStore({
                        locCode: newLocCode,
                        locName: (isWarehouse && (!editUsername.trim() || editUsername.trim().toLowerCase() === "warehouse")) ? "Warehouse" : (editUsername.trim() || "Warehouse"),
                        address: editAddress.trim(),
                        phone: editPhone.trim(),
                        email: editEmail.trim().toLowerCase(),
                        gst: editGst.trim()
                    });
                    fetchActiveStores().catch(() => { });
                }
                alert("User updated successfully!");
                setShowEditModal(false);
                fetchStores();
                loadAvailableStores();
            } else {
                alert(data.message || "Failed to update user.");
            }
        } catch (err) {
            console.error("Error updating user:", err);
            alert("An error occurred while updating the user.");
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async () => {
        try {
            setDeleteLoading(true);
            const userToDelete = selectedUser;
            const response = await fetch(`${baseUrl.baseUrl}user/deleteUser/${userToDelete._id}`, {
                method: "DELETE",
            });
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                const locCodeToRemove = data.deletedLocCode || userToDelete?.locCode;
                if (locCodeToRemove) {
                    removeCustomStore(locCodeToRemove);
                }
                alert("User deleted successfully!");
                setShowDeleteModal(false);
                setSelectedUser(null);
                fetchStores();
                await fetchActiveStores().catch(() => { });
            } else {
                const data = await response.json().catch(() => ({}));
                alert(data.message || "Failed to delete user.");
            }
        } catch (err) {
            console.error("Delete user error:", err);
            alert("An error occurred while deleting the user.");
        } finally {
            setDeleteLoading(false);
        }
    };

    const editFilteredStores = availableStores.filter(store =>
        ((store.locName || store.name || "").toLowerCase().includes(editStoreSearch.toLowerCase()) ||
            (store.locCode || "").toLowerCase().includes(editStoreSearch.toLowerCase())) &&
        !editAllowedLocCodes.includes(store.locCode)
    );

    return (
        <div className="min-h-screen bg-[#FFFFFF]">
            <Header title="Existing Users" />

            <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
                {/* Clean Page Title Header */}
                <div className="bg-white px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
                    <h1 className="text-[18px] font-semibold text-[#212121]">Manage Existing Users</h1>
                </div>

                {/* Toolbar: Search + New User Button */}
                <div className="px-8 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="relative w-full sm:w-[270px]">
                        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center">
                            <Search size={15} className="text-[#212121]" />
                            <span className="h-4 w-[1px] bg-[#E5E5E5] ml-2.5" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name or user"
                            className="rf-input !pl-12"
                        />
                    </div>

                    <button
                        onClick={() => navigate("/manage-users/add-user")}
                        className="rf-btn-primary cursor-pointer"
                    >
                        <Plus size={15} /> New User
                    </button>
                </div>

                {/* Table */}
                <div className="px-8 pb-8">
                    <div className="bg-white rounded-lg border border-[#E5E5E5] overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-[48px_1.6fr_1.6fr_2.2fr_1.5fr_1.2fr_0.9fr] bg-[#1B1B1B] text-white h-[40px] items-center">
                            <div />
                            <div className="px-3 text-[11px] font-semibold text-white uppercase tracking-wider">ROLE</div>
                            <div className="px-3 text-[11px] font-semibold text-white uppercase tracking-wider">USER</div>
                            <div className="px-3 text-[11px] font-semibold text-white uppercase tracking-wider">EMAIL</div>
                            <div className="px-3 text-[11px] font-semibold text-white uppercase tracking-wider">PHONE</div>
                            <div className="px-3 text-[11px] font-semibold text-white uppercase tracking-wider text-center">USER TYPE</div>
                            <div className="px-3 text-[11px] font-semibold text-white uppercase tracking-wider text-center">ACTION</div>
                        </div>

                        {loadingStores ? (
                            <div className="p-10 text-center text-[#6A6A6A] text-[13px]">Loading...</div>
                        ) : (
                            ROLE_GROUPS.map(({ key, label }) => {
                                const users = getUsersForRole(key);
                                const isSearching = searchQuery.trim().length > 0;
                                if (isSearching && users.length === 0) return null;
                                const isOpen = isSearching ? true : !!openGroups[key];

                                return (
                                    <div key={key} className="border-b border-[#E2D4EC] last:border-b-0">
                                        {/* Lavender Accordion Group Header Row */}
                                        <div
                                            onClick={() => toggleGroup(key)}
                                            className="grid grid-cols-[48px_1fr] bg-[#F1E6F8] hover:bg-[#EAD9F5] h-[44px] cursor-pointer transition-colors items-center"
                                        >
                                            <div className="flex items-center justify-center">
                                                {isOpen
                                                    ? <ChevronDown size={15} className="text-[#212121]" />
                                                    : <ChevronRight size={15} className="text-[#212121]" />
                                                }
                                            </div>
                                            <div className="px-3 flex items-center gap-2.5">
                                                <span className="text-[12px] font-bold text-[#212121] uppercase tracking-wide">{label}</span>
                                                <span className="bg-[#9D43D6] text-white text-[10px] font-semibold min-w-[20px] h-[20px] px-1.5 rounded-full inline-flex items-center justify-center">
                                                    {users.length}
                                                </span>
                                            </div>
                                        </div>

                                        {/* User Rows */}
                                        {isOpen && (
                                            users.length === 0 ? (
                                                <div className="px-14 py-3 text-[13px] text-[#6A6A6A] bg-white border-t border-[#EFEFEF]">
                                                    No users in this role.
                                                </div>
                                            ) : (
                                                users.map((user) => (
                                                    <div
                                                        key={user._id}
                                                        className="grid grid-cols-[48px_1.6fr_1.6fr_2.2fr_1.5fr_1.2fr_0.9fr] min-h-[46px] bg-white border-t border-[#EFEFEF] hover:bg-[#FBF5FC] transition-colors items-center text-[13px]"
                                                    >
                                                        {/* Spacer under chevron */}
                                                        <div className="h-full border-r border-[#F3F3F3]" />
                                                        {/* Role */}
                                                        <div className="px-3 py-2.5 h-full flex items-center border-r border-[#F3F3F3] text-[#4A4A4A] italic">
                                                            {getRoleLabel(user.role || 'normal_user')}
                                                        </div>
                                                        {/* User */}
                                                        <div className="px-3 py-2.5 h-full flex items-center border-r border-[#F3F3F3] text-[#212121] italic">
                                                            {user.storeName || user.username}
                                                        </div>
                                                        {/* Email */}
                                                        <div className="px-3 py-2.5 h-full flex items-center border-r border-[#F3F3F3] text-[#4A4A4A] italic truncate">
                                                            <span className="truncate">{user.email}</span>
                                                        </div>
                                                        {/* Phone */}
                                                        <div className="px-3 py-2.5 h-full flex items-center border-r border-[#F3F3F3] text-[#4A4A4A] italic">
                                                            {user.phone || "—"}
                                                        </div>
                                                        {/* User Type Badge */}
                                                        <div className="px-3 py-2.5 h-full flex items-center justify-center border-r border-[#F3F3F3]">
                                                            <span className="bg-[#EFE3F7] text-[#9D43D6] text-[11px] font-semibold px-3.5 py-1 rounded-md whitespace-nowrap">
                                                                {getRoleLabel(user.role || 'normal_user')}
                                                            </span>
                                                        </div>
                                                        {/* Action */}
                                                        <div className="px-3 py-2.5 h-full flex items-center justify-center">
                                                            <button
                                                                onClick={() => setViewUser(user)}
                                                                className="no-blue-button text-[#9D43D6] hover:text-[#7E2BB8] transition-colors cursor-pointer"
                                                                title="View details"
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            {/* User Detail Panel (slide-in from right) */}
            {viewUser && (
                <div className="fixed inset-0 z-40 flex justify-end">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/30" onClick={() => setViewUser(null)} />
                    {/* Panel */}
                    <div className="relative bg-white w-[400px] h-full shadow-2xl flex flex-col z-50 overflow-y-auto">
                        {/* Header */}
                        <div className="px-6 pt-7 pb-5 border-b border-gray-100">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setViewUser(null)} className="text-gray-500 hover:text-gray-800 mt-0.5">
                                        <ChevronLeft size={22} />
                                    </button>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
                                            {viewUser.storeName || viewUser.username}
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wider">
                                            ROLE :&nbsp;
                                            <span className="font-semibold text-gray-700 capitalize">
                                                {getRoleLabel(viewUser.role)}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#9D43D6]/10 text-[#9D43D6]">
                                    {getRoleLabel(viewUser.role)}
                                </span>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 px-6 py-6 space-y-5">
                            {/* Email */}
                            <div className="flex items-start gap-4">
                                <div className="bg-[#9D43D6] p-2.5 rounded-lg flex-shrink-0">
                                    <Mail size={16} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-xs text-[#6A6A6A] uppercase tracking-wider">Email :</p>
                                    <p className="text-[#212121] font-medium mt-0.5">{viewUser.email}</p>
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="flex items-start gap-4">
                                <div className="bg-[#9D43D6] p-2.5 rounded-lg flex-shrink-0">
                                    <Phone size={16} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-xs text-[#6A6A6A] uppercase tracking-wider">Phone Number</p>
                                    <p className="text-[#212121] font-medium mt-0.5">{viewUser.phone || "—"}</p>
                                </div>
                            </div>

                            {/* Store Admin specific details: Loc Code, Address, GST */}
                            {normalizeRole(viewUser.role) === "store_admin" && (
                                <>
                                    {viewUser.locCode && (
                                        <div className="flex items-start gap-4">
                                            <div className="bg-[#9D43D6] p-2.5 rounded-lg flex-shrink-0">
                                                <MapPin size={16} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6A6A6A] uppercase tracking-wider">Location Code</p>
                                                <p className="text-[#212121] font-medium mt-0.5">{viewUser.locCode}</p>
                                            </div>
                                        </div>
                                    )}

                                    {viewUser.address && (
                                        <div className="flex items-start gap-4">
                                            <div className="bg-[#9D43D6] p-2.5 rounded-lg flex-shrink-0">
                                                <MapPin size={16} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6A6A6A] uppercase tracking-wider">Address :</p>
                                                <p className="text-[#212121] font-medium mt-0.5">{viewUser.address}</p>
                                            </div>
                                        </div>
                                    )}

                                    {viewUser.gst && (
                                        <div className="flex items-start gap-4">
                                            <div className="bg-[#9D43D6] p-2.5 rounded-lg flex-shrink-0">
                                                <ShieldCheck size={16} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6A6A6A] uppercase tracking-wider">Tax Registration (GST)</p>
                                                <p className="text-[#212121] font-medium mt-0.5">{viewUser.gst}</p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Cluster Admin: Assigned Stores */}
                            {normalizeRole(viewUser.role) === "cluster_admin" && (
                                <div className="pt-2">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Assigned Stores</p>
                                    {viewUser.allowedLocCodes?.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {viewUser.allowedLocCodes.map((code) => (
                                                <span key={code} className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200">
                                                    {getStoreName(code)} ({code})
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400">No stores assigned</p>
                                    )}
                                </div>
                            )}

                            {/* Super Admin, Admin, Financial Admin: Access note */}
                            {["super_admin", "admin", "financial_admin"].includes(normalizeRole(viewUser.role)) && (
                                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-700 font-medium">
                                    ✦ Has full access to all stores currently in the system.
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="px-6 pb-8 pt-4 border-t border-gray-100 flex items-center gap-3">
                            <button
                                onClick={() => { const u = viewUser; setViewUser(null); openEditModal(u); }}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-semibold transition-colors"
                            >
                                Edit User <Pencil size={15} />
                            </button>
                            <button
                                onClick={() => { const u = viewUser; setViewUser(null); openDeleteModal(u); }}
                                className="flex items-center justify-center w-12 h-12 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] p-8 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">EDIT USER</h2>
                        <div className="space-y-5">
                            {/* Store / Warehouse Admin layout: Role & Store/Warehouse Name, Email & Phone, Loc Code & GST, Address */}
                            {(editRole === "store_admin" || editRole === "warehouse_admin") ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">User Role</label>
                                            <AppSelect
                                                value={editRole}
                                                onChange={(e) => {
                                                    setEditRole(e.target.value);
                                                    if (e.target.value !== "store_admin" && e.target.value !== "warehouse_admin") {
                                                        setEditLocCode("");
                                                        setEditGst("");
                                                        setEditAddress("");
                                                    } else if (e.target.value === "warehouse_admin") {
                                                        if (!editLocCode) setEditLocCode("858");
                                                        if (!editUsername) setEditUsername("Warehouse");
                                                    }
                                                    if (e.target.value !== "cluster_admin") {
                                                        setEditAllowedLocCodes([]);
                                                    }
                                                }}
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 text-sm"
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
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">
                                                {editRole === "warehouse_admin" ? "Warehouse Name *" : "Store Name *"}
                                            </label>
                                            <input
                                                value={editUsername}
                                                onChange={(e) => setEditUsername(e.target.value)}
                                                placeholder={editRole === "warehouse_admin" ? "Enter warehouse name" : "Enter store name"}
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Email Address *</label>
                                            <input
                                                type="email"
                                                value={editEmail}
                                                onChange={(e) => setEditEmail(e.target.value)}
                                                placeholder="store@example.com"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Phone Number</label>
                                            <input
                                                value={editPhone}
                                                onChange={(e) => setEditPhone(e.target.value)}
                                                placeholder="+91 98765 43210"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Loc Code *</label>
                                            <input
                                                value={editLocCode}
                                                onChange={(e) => setEditLocCode(e.target.value)}
                                                placeholder={editRole === "warehouse_admin" ? "e.g., 858" : "Enter location code"}
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">GST Number</label>
                                            <input
                                                value={editGst}
                                                onChange={(e) => setEditGst(e.target.value)}
                                                placeholder="123450000AAz5"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">
                                            {editRole === "warehouse_admin" ? "Warehouse Address" : "Store Address"}
                                        </label>
                                        <textarea
                                            value={editAddress}
                                            onChange={(e) => setEditAddress(e.target.value)}
                                            placeholder={editRole === "warehouse_admin" ? "Enter warehouse address" : "Enter store address"}
                                            rows="2"
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                                        />
                                    </div>
                                </>
                            ) : editRole === "cluster_admin" ? (
                                /* Cluster Admin layout: Role, Email, Phone, Assign Stores */
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">User Role</label>
                                            <AppSelect
                                                value={editRole}
                                                onChange={(e) => {
                                                    setEditRole(e.target.value);
                                                    if (e.target.value !== "cluster_admin") {
                                                        setEditAllowedLocCodes([]);
                                                    }
                                                }}
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 text-sm"
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
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Email Address *</label>
                                            <input
                                                type="email"
                                                value={editEmail}
                                                onChange={(e) => setEditEmail(e.target.value)}
                                                placeholder="user@example.com"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Phone Number</label>
                                        <input
                                            value={editPhone}
                                            onChange={(e) => setEditPhone(e.target.value)}
                                            placeholder="+91 98765 43210"
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                    </div>

                                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-xs font-semibold text-gray-700 uppercase">
                                                Assign Stores to Cluster Admin <span className="text-red-500">*</span>
                                            </label>
                                            <div className="flex gap-2 text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditAllowedLocCodes(availableStores.map(s => s.locCode))}
                                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    Select All
                                                </button>
                                                <span className="text-gray-300">|</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditAllowedLocCodes([])}
                                                    className="text-gray-500 hover:text-gray-700"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>

                                        <div className="relative mb-2">
                                            <input
                                                type="text"
                                                value={editStoreSearch}
                                                onChange={(e) => { setEditStoreSearch(e.target.value); setShowEditStoreDropdown(true); }}
                                                onFocus={() => setShowEditStoreDropdown(true)}
                                                placeholder="Search and add stores..."
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                            />
                                            {showEditStoreDropdown && editFilteredStores.length > 0 && (
                                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                    {editFilteredStores.map((store) => (
                                                        <div
                                                            key={store.locCode}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                if (!editAllowedLocCodes.includes(store.locCode)) {
                                                                    setEditAllowedLocCodes([...editAllowedLocCodes, store.locCode]);
                                                                }
                                                                setEditStoreSearch("");
                                                                setShowEditStoreDropdown(false);
                                                            }}
                                                            className="px-3 py-2 text-sm flex items-center justify-between hover:bg-[#FBF5FC] cursor-pointer text-[#212121]"
                                                        >
                                                            <span>{store.locName || store.name}</span>
                                                            <span className="text-xs text-[#6A6A6A]">Loc: {store.locCode}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {editAllowedLocCodes.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {editAllowedLocCodes.map((code) => (
                                                    <span key={code} className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#9D43D6]/10 text-[#9D43D6] rounded-full text-xs font-medium">
                                                        {getStoreName(code)} ({code})
                                                        <button
                                                            type="button"
                                                            className="no-blue-button text-[#9D43D6] hover:text-[#8B3CBD] font-bold ml-0.5 cursor-pointer"
                                                            onClick={() => setEditAllowedLocCodes(editAllowedLocCodes.filter(c => c !== code))}
                                                        >×</button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* Super Admin, Admin, Financial Admin, Normal User layout */
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">User Role</label>
                                            <AppSelect
                                                value={editRole}
                                                onChange={(e) => {
                                                    setEditRole(e.target.value);
                                                    if (e.target.value === "warehouse_admin") {
                                                        if (!editLocCode) setEditLocCode("858");
                                                        if (!editUsername) setEditUsername("Warehouse");
                                                    }
                                                }}
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 text-sm"
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
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Email Address *</label>
                                            <input
                                                type="email"
                                                value={editEmail}
                                                onChange={(e) => setEditEmail(e.target.value)}
                                                placeholder="user@example.com"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Phone Number</label>
                                        <input
                                            value={editPhone}
                                            onChange={(e) => setEditPhone(e.target.value)}
                                            placeholder="+91 98765 43210"
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-between mt-8">
                            <button onClick={() => setShowDeleteModal(true)}
                                className="rf-btn-danger cursor-pointer">
                                <Trash2 size={16} /> DELETE
                            </button>
                            <div className="flex gap-3">
                                <button onClick={() => setShowEditModal(false)}
                                    className="rf-btn-cancel cursor-pointer">
                                    CANCEL
                                </button>
                                <button onClick={handleEditSave} disabled={editLoading}
                                    className={editLoading ? "rf-btn-disabled" : "rf-btn-primary cursor-pointer"}>
                                    {editLoading ? "SAVING..." : "SAVE CHANGES"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && selectedUser && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] p-8 text-center border border-[#E9E9E9]">
                        <h2 className="text-xl font-bold text-[#212121] mb-3">DELETE USER</h2>
                        <p className="text-[#6A6A6A] text-[13px] mb-8">
                            Are you sure you want to delete <strong>{selectedUser.storeName || selectedUser.username}</strong>?<br />
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={() => setShowDeleteModal(false)}
                                className="rf-btn-cancel cursor-pointer">
                                CANCEL
                            </button>
                            <button onClick={handleDelete} disabled={deleteLoading}
                                className={deleteLoading ? "rf-btn-disabled" : "rf-btn-danger !bg-[#DC2626] !text-white hover:!bg-[#b91c1c] cursor-pointer"}>
                                {deleteLoading ? "DELETING..." : "DELETE"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default ExistingUsers;
