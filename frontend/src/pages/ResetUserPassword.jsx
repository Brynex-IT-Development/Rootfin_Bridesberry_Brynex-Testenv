import { useState, useEffect, useRef } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { ShieldCheck, ChevronDown } from "lucide-react";
import baseUrl from "../api/api";
import { useSidebar } from "../hooks/useSidebar.js";

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
            u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
            u.username.toLowerCase().includes(userSearch.toLowerCase())
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
        <div className={`bg-[#F7F7F7] min-h-screen transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
            {/* Header */}
            <div className="bg-white px-8 py-5 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-4">
                    <div className="bg-[#9D43D6] p-3 rounded-xl flex items-center justify-center shadow-sm">
                        <ShieldCheck className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-[24px] font-semibold text-[#212121]">RESET USER PASSWORD</h1>
                        <p className="text-[#6A6A6A] text-[13px] font-normal">Only admin can reset password for any user</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="p-6 md:p-8">
                <form onSubmit={handleReset} className="max-w-lg bg-white border border-[#E5E5E5] rounded-xl p-6 shadow-xs space-y-4" autoComplete="off">
                    {/* Select User */}
                    <div ref={dropdownRef}>
                        <label className="block text-[12px] font-medium text-[#212121] mb-[6px]">
                            Select User / Store *
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
                                className="w-full h-[40px] px-[14px] pr-10 border border-[#E5E5E5] rounded-[10px] text-[13px] font-medium text-[#212121] placeholder-[#A3A3A3] outline-none focus:border-[#9B48D7] focus:ring-1 focus:ring-[#9B48D7]"
                            />
                            <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6A6A6A] pointer-events-none" />
                            {showUserDropdown && filteredUsers.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-[#E5E5E5] rounded-[10px] shadow-xl max-h-60 overflow-y-auto">
                                    {filteredUsers.map((u) => (
                                        <div
                                            key={u._id}
                                            onMouseDown={(e) => { e.preventDefault(); handleSelectUser(u); }}
                                            className="px-3.5 py-2.5 hover:bg-[#FBF5FC] cursor-pointer text-[#212121] text-[13px] border-b border-[#E5E5E5] last:border-0"
                                        >
                                            <span className="font-medium text-[#212121]">{u.username}</span>
                                            <span className="text-[#6A6A6A] ml-2 text-xs">— {u.email}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-[12px] font-medium text-[#212121] mb-[6px]">
                            New Password *
                        </label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                autoComplete="new-password"
                                className="w-full h-[40px] px-[14px] pr-12 border border-[#E5E5E5] rounded-[10px] text-[13px] font-medium text-[#212121] placeholder-[#A3A3A3] outline-none focus:border-[#9B48D7] focus:ring-1 focus:ring-[#9B48D7]"
                            />
                            <span onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6A6A6A] hover:text-[#9D43D6] cursor-pointer">
                                {showNewPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                            </span>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-[12px] font-medium text-[#212121] mb-[6px]">
                            Confirm Password *
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                autoComplete="new-password"
                                className="w-full h-[40px] px-[14px] pr-12 border border-[#E5E5E5] rounded-[10px] text-[13px] font-medium text-[#212121] placeholder-[#A3A3A3] outline-none focus:border-[#9B48D7] focus:ring-1 focus:ring-[#9B48D7]"
                            />
                            <span onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6A6A6A] hover:text-[#9D43D6] cursor-pointer">
                                {showConfirmPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                            </span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-between items-center pt-4">
                        <button type="button"
                            onClick={() => { setSelectedUser(null); setUserSearch(""); setNewPassword(""); setConfirmPassword(""); }}
                            className="rf-btn-cancel cursor-pointer">
                            CANCEL
                        </button>
                        <button type="submit" disabled={loading}
                            className={loading ? "rf-btn-disabled" : "rf-btn-primary cursor-pointer"}>
                            {loading ? "RESETTING..." : "RESET PASSWORD"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResetUserPassword;
