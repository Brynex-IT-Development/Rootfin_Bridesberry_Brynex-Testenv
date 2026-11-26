import { useState, useEffect } from "react";
import { Trash2, BellRing, Mail, MapPin, Search, Check } from "lucide-react";
import Header from "../components/Header";
import RootfinConfirmModal from "../components/RootfinModal";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";

const ConfirmModal = ({ open, onClose, onConfirm, title, description, confirmLabel, confirmStyle }) => {
  const isDanger = confirmStyle?.background === "#FEE2E2";
  return (
    <RootfinConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant={isDanger ? "danger" : "primary"}
    />
  );
};

const ReorderAlerts = () => {
  const isSidebarOpen = useSidebar();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);

  // Modal state
  const [deleteModal, setDeleteModal] = useState(null);   // alertId
  const [resolveModal, setResolveModal] = useState(null); // alertId
  const [notifyModal, setNotifyModal] = useState(null);   // alertId

  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

  useEffect(() => { fetchAlerts(); }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/reorder-alerts?status=${filter}`);
      if (!res.ok) throw new Error();
      setAlerts(await res.json());
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reorder-alerts/${deleteModal}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAlerts(a => a.filter(x => x._id !== deleteModal));
    } catch { alert("Failed to delete alert"); }
    finally { setDeleteModal(null); }
  };

  const confirmResolve = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reorder-alerts/${resolveModal}/resolve`, { method: "PUT" });
      if (!res.ok) throw new Error();
      setAlerts(a => a.map(x => x._id === resolveModal ? { ...x, status: "resolved" } : x));
    } catch { alert("Failed to resolve alert"); }
    finally { setResolveModal(null); }
  };

  const confirmNotify = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reorder-alerts/${notifyModal}/notify`, { method: "PUT" });
      if (!res.ok) throw new Error();
      alert("Notification sent!");
    } catch { alert("Failed to send notification"); }
    finally { setNotifyModal(null); }
  };

  const handleTestEmail = async () => {
    if (!testEmail) { alert("Please enter an email address"); return; }
    try {
      setTestingEmail(true);
      const res = await fetch(`${API_URL}/api/reorder-alerts/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      alert("✅ Test email sent successfully!");
      setShowTestEmail(false);
      setTestEmail("");
    } catch (e) { alert(`❌ Failed: ${e.message}`); }
    finally { setTestingEmail(false); }
  };

  const activeAlerts   = alerts.filter(a => a.status === "active");
  const resolvedAlerts = alerts.filter(a => a.status === "resolved");
  const baseAlerts     = filter === "active" ? activeAlerts : resolvedAlerts;
  const displayedAlerts = baseAlerts.filter(a => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (a.itemName  || "").toLowerCase().includes(s) ||
      (a.itemSku   || "").toLowerCase().includes(s) ||
      (a.itemGroup || "").toLowerCase().includes(s) ||
      (a.warehouse || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Reorder Alerts" />

      {/* Modals */}
      <ConfirmModal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title="Delete this item?"
        description="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel={<><Trash2 size={14} />Delete</>}
        confirmStyle={{ background: "#FEE2E2", color: "#DC2626" }}
      />
      <ConfirmModal
        open={!!resolveModal}
        onClose={() => setResolveModal(null)}
        onConfirm={confirmResolve}
        title="Mark as Resolved?"
        description="Are you sure you want to mark this stock issue as resolved?"
        confirmLabel={<><Check size={14} />Mark as Resolved</>}
        confirmStyle={{ background: "#9D43D6", color: "white" }}
      />
      <ConfirmModal
        open={!!notifyModal}
        onClose={() => setNotifyModal(null)}
        onConfirm={confirmNotify}
        title="Notify about low stock?"
        description="Send a notification to the responsible team about the low stock for this item?"
        confirmLabel={<><BellRing size={14} />Notify</>}
        confirmStyle={{ background: "#9D43D6", color: "white" }}
      />

      <div className={`transition-all duration-300 ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#212121]">Reorder Alerts</h1>
          <button
            type="button"
            onClick={() => setShowTestEmail(!showTestEmail)}
            className="h-[38px] px-4 rounded-[10px] border border-[#E5E5E5] bg-white hover:bg-[#FAFAFA] text-[13px] font-medium text-[#212121] inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Mail size={15} className="text-[#9D43D6] shrink-0" />
            <span>Test Email</span>
          </button>
        </div>
        <div className="p-5 md:p-6">

          {/* Test Email Panel */}
          {showTestEmail && (
            <div className="mb-4 bg-white border border-[#E5E5E5] rounded-[12px] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <p className="text-[13px] font-semibold text-[#1B1B1B] mb-3">
                Send a test email to verify your email settings
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  className="rf-input !h-[38px] flex-1 min-w-[220px]"
                />
                <button
                  type="button"
                  onClick={() => { setShowTestEmail(false); setTestEmail(""); }}
                  className="rf-btn-cancel !h-[38px] !px-4 !text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="rf-btn-primary !h-[38px] !px-4 !text-[13px] disabled:opacity-50"
                >
                  {testingEmail ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          )}

          {/* Search + Status tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="relative w-full sm:w-[410px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#525252] pointer-events-none" />
              <input
                type="text"
                placeholder="Search by SKU (e.g. BLCB9), product name, category, or location..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="rf-input !pl-10 !h-[42px] bg-white"
              />
            </div>

            <div className="inline-flex items-center bg-[#F4F4F5] rounded-[12px] p-1 gap-1">
              {[
                { key: "active",   label: "Active Alerts", count: activeAlerts.length },
                { key: "resolved", label: "Resolved",      count: resolvedAlerts.length },
              ].map(({ key, label, count }) => {
                const isActive = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] text-[12px] transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-white text-[#1B1B1B] font-semibold shadow-xs"
                        : "text-[#7A7A7A] hover:text-[#212121] font-medium"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[20px] h-[18px] text-[10px] font-semibold tabular-nums ${
                        isActive ? "bg-[#9D43D6] text-white" : "bg-[#F3E8FF] text-[#9D43D6]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white border border-[#E5E5E5] rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#1B1B1B] text-white">
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold tracking-wider uppercase w-[34%]">
                      ITEM DETAILS
                    </th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold tracking-wider uppercase w-[18%]">
                      WAREHOUSE LOCATION
                    </th>
                    <th className="px-5 py-3.5 text-center text-[11px] font-semibold tracking-wider uppercase w-[16%]">
                      CURRENT STOCK
                    </th>
                    <th className="px-5 py-3.5 text-center text-[11px] font-semibold tracking-wider uppercase w-[16%]">
                      REORDER POINT
                    </th>
                    <th className="px-5 py-3.5 text-center text-[11px] font-semibold tracking-wider uppercase w-[16%]">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0] bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-[13px] text-[#7A7A7A]">
                        Loading alerts...
                      </td>
                    </tr>
                  ) : displayedAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <div className="w-12 h-12 rounded-[12px] bg-[#F3E8FF] flex items-center justify-center mx-auto mb-3">
                          <BellRing size={22} className="text-[#9D43D6]" />
                        </div>
                        <p className="text-[14px] font-semibold text-[#1B1B1B]">
                          {searchTerm ? "No alerts match your search" : filter === "active" ? "No active reorder alerts" : "No resolved alerts"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    displayedAlerts.map((alert) => {
                      const isResolved = alert.status === "resolved";
                      return (
                        <tr key={alert._id} className="hover:bg-[#FAFAFA] transition-colors">
                          {/* Item Details */}
                          <td className="px-5 py-4 border-r border-[#F5F5F5] align-middle">
                            {alert.itemSku && (
                              <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-[6px] bg-[#F3E8FF] text-[#1B1B1B] mb-1.5">
                                SKU : {alert.itemSku}
                              </span>
                            )}
                            <div className="text-[13px] font-semibold text-[#1B1B1B] leading-snug">
                              {alert.itemName || "—"}
                            </div>
                            <div className="text-[12px] text-[#7A7A7A] mt-0.5">
                              Group: {alert.itemGroup || "—"}
                            </div>
                          </td>

                          {/* Warehouse Location */}
                          <td className="px-5 py-4 border-r border-[#F5F5F5] align-middle">
                            <div className="inline-flex items-center gap-2 text-[13px] text-[#525252]">
                              <MapPin size={15} className="text-[#9D43D6] shrink-0" />
                              <span>{alert.warehouse || "—"}</span>
                            </div>
                          </td>

                          {/* Current Stock */}
                          <td className="px-5 py-4 border-r border-[#F5F5F5] text-center align-middle text-[13px] tabular-nums">
                            <span className="font-semibold text-[#EF4444]">{alert.currentStock}</span>
                            <span className="text-[#8A8A8A]"> /{alert.reorderPoint * 2 || alert.reorderPoint} Target</span>
                          </td>

                          {/* Reorder Point */}
                          <td className="px-5 py-4 border-r border-[#F5F5F5] text-center align-middle text-[13px] font-semibold text-[#1B1B1B] tabular-nums">
                            {alert.reorderPoint}
                          </td>

                          {/* Actions: Delete | Resolve | Notify (matching screenshot) */}
                          <td className="px-5 py-4 text-center align-middle">
                            <div className="inline-flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setDeleteModal(alert._id)}
                                className="w-[34px] h-[34px] rounded-[8px] bg-[#FEE2E2]/80 hover:bg-[#FEE2E2] text-[#EF4444] flex items-center justify-center transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                              {!isResolved && (
                                <button
                                  type="button"
                                  onClick={() => setResolveModal(alert._id)}
                                  className="w-[34px] h-[34px] rounded-[8px] bg-[#F4F4F5] hover:bg-[#F3E8FF] text-[#9D43D6] flex items-center justify-center transition-colors cursor-pointer"
                                  title="Mark as Resolved"
                                >
                                  <Check size={14} />
                                </button>
                              )}
                              {!isResolved && (
                                <button
                                  type="button"
                                  onClick={() => setNotifyModal(alert._id)}
                                  className="w-[34px] h-[34px] rounded-[8px] bg-[#9D43D6] hover:bg-[#8732BE] text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                                  title="Notify"
                                >
                                  <BellRing size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ReorderAlerts;
