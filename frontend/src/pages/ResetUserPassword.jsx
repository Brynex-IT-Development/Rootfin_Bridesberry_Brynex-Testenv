import { useState, useEffect, useRef } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { ChevronDown } from "lucide-react";
import baseUrl from "../api/api";
import { useSidebar } from "../hooks/useSidebar.js";
import Header from "../components/Header.jsx";

const ResetUserPassword = () => {
    const isSidebarOpen = useSidebar();
    const [users, setUsers] = useState([]);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [userSearch, setUserSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch(`${baseUrl.baseUrl}user/getAllUsers`);
                const data = await response.json();
                if (response.ok) setUsers(data.users || []);
            } catch (err) {
                console.error(err);
            }
        };
        fetchUsers();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowUserDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredUsers = userSearch.trim() === "" || selectedUser
        ? users
        : users.filter(u =>
            (u.email || "").toLowerCase().includes(userSearch.toLowerCase()) ||
            (u.username || "").toLowerCase().includes(userSearch.toLowerCase())
        );

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setUserSearch(`${user.username} — ${user.email}`);
        setShowUserDropdown(false);
    };

    const handleReset = async (e) => {
        e.preventDefault();

        if (!selectedUser) { alert("Please select a user."); return; }
        if (!newPassword || !confirmPassword) { alert("Please fill in all fields."); return; }
        if (newPassword !== confirmPassword) { alert("Passwords do not match."); return; }
        if (newPassword.length < 6) { alert("Password must be at least 6 characters."); return; }

        try {
            setLoading(true);
            const response = await fetch(`${baseUrl.baseUrl}user/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: selectedUser.email, newPassword }),
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message || "Password reset successfully!");
                setSelectedUser(null);
                setUserSearch("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                alert(data.message || "Failed to reset password.");
            }
        } catch (err) {
            alert("An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FFFFFF]">
            <Header title="Reset Password" />

            <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
                {/* Clean Page Title Header */}
                <div className="bg-white px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
                    <h1 className="text-[18px] font-semibold text-[#212121]">Reset User Password</h1>
                </div>

                {/* Form Section */}
                <div className="bg-white px-8 py-7 max-w-[1400px]">
                    <form onSubmit={handleReset} className="space-y-6" autoComplete="off">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Select User */}
                            <div ref={dropdownRef} className="rf-form-field !mb-0">
                                <label className="rf-field-label">
                                    Select User / Store <span className="required">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={userSearch}
                                        onChange={(e) => {
                                            setUserSearch(e.target.value);
                                            setSelectedUser(null);
                                            setShowUserDropdown(true);
                                        }}
                                        onFocus={() => setShowUserDropdown(true)}
                                        placeholder="Enter mail id or username..."
                                        autoComplete="off"
                                        className="rf-input !pr-11"
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 pl-2.5">
                                        <span className="h-4 w-[1px] bg-[#E5E5E5] mr-2.5" />
                                        <ChevronDown size={15} className="text-[#6A6A6A]" />
                                    </div>
                                    {showUserDropdown && filteredUsers.length > 0 && (
                                        <div className="rf-select__menu-list absolute z-50 w-full mt-1 bg-white border border-[#e2e8f0] rounded-none shadow-lg max-h-60 overflow-y-auto">
                                            {filteredUsers.map((u) => {
                                                const isSelected = selectedUser && selectedUser._id === u._id;
                                                return (
                                                    <div
                                                        key={u._id}
                                                        onMouseDown={(e) => { e.preventDefault(); handleSelectUser(u); }}
                                                        className={`px-3.5 py-2.5 cursor-pointer text-[14px] transition-colors ${
                                                            isSelected
                                                                ? "bg-[#18181b] text-white font-medium"
                                                                : "text-[#334155] hover:bg-[#f1f5f9]"
                                                        }`}
                                                    >
                                                        <span>{u.username}</span>
                                                        <span className={`ml-2 text-xs ${isSelected ? "text-gray-300" : "text-[#64748b]"}`}>— {u.email}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* New Password */}
                            <div className="rf-form-field !mb-0">
                                <label className="rf-field-label">
                                    New Password <span className="required">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        autoComplete="new-password"
                                        className="rf-input !pr-12"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute inset-y-0 right-0 pr-3.5 pl-2.5 flex items-center text-[#F2572B] hover:text-[#D9431A] cursor-pointer"
                                    >
                                        <span className="h-4 w-[1px] bg-[#E5E5E5] mr-2.5" />
                                        {showNewPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="rf-form-field !mb-0">
                                <label className="rf-field-label">
                                    Confirm Password <span className="required">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        autoComplete="new-password"
                                        className="rf-input !pr-12"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-3.5 pl-2.5 flex items-center text-[#F2572B] hover:text-[#D9431A] cursor-pointer"
                                    >
                                        <span className="h-4 w-[1px] bg-[#E5E5E5] mr-2.5" />
                                        {showConfirmPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className={loading ? "rf-btn-disabled" : "rf-btn-primary cursor-pointer !px-6"}
                            >
                                {loading ? "Resetting..." : "Reset Password"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setSelectedUser(null); setUserSearch(""); setNewPassword(""); setConfirmPassword(""); }}
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

export default ResetUserPassword;
