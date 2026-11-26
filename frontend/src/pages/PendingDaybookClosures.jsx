import { useCallback, useEffect, useState } from "react";
import { Store, RefreshCw, Loader2 } from "lucide-react";
import Header from "../components/Header.jsx";
import { useSidebar } from "../hooks/useSidebar.js";
import baseUrl from "../api/api.js";
import { fetchActiveStores, getActiveStores } from "../utils/storeService.js";

const formatAmount = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDateParts = (rawDate) => {
  if (!rawDate) return { dateStr: "—", weekday: "" };
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return { dateStr: String(rawDate), weekday: "" };
  const dateStr = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const weekday = d.toLocaleDateString("en-IN", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });
  return { dateStr, weekday };
};

const PendingDaybookClosures = () => {
  const isSidebarOpen = useSidebar();
  const [closures, setClosures] = useState([]);
  const [stores, setStores] = useState(() => getActiveStores() || []);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const signInAgain = () => {
    localStorage.removeItem("rootfinuser");
    localStorage.removeItem("rootfin_auth_token");
    window.location.assign("/login");
  };

  useEffect(() => {
    fetchActiveStores()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setStores(list);
      })
      .catch(() => {});
  }, []);

  const getStoreInfo = (locCode) => {
    const code = String(locCode || "").trim();
    const match = stores.find((s) => String(s.locCode || "").trim() === code);
    return {
      name: match?.locName || match?.name || `Store ${code}`,
      subtitle: code ? `Loc Code: ${code}` : "Store",
    };
  };

  const fetchClosures = useCallback(async () => {
    setLoading(true);
    setError("");
    setNeedsSignIn(false);
    const token = localStorage.getItem("rootfin_auth_token");
    if (!token) {
      setNeedsSignIn(true);
      setError("Please sign in again to review daybook closures.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${baseUrl.baseUrl}user/pendingClosures`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.status === 401) setNeedsSignIn(true);
      if (!response.ok) throw new Error(result.message || "Unable to load pending closures.");
      setClosures(result.data || []);
    } catch (err) {
      setClosures([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClosures();
  }, [fetchClosures]);

  const approve = async (id) => {
    const token = localStorage.getItem("rootfin_auth_token");
    if (!token) {
      setNeedsSignIn(true);
      setError("Please sign in again to approve daybook closures.");
      return;
    }
    setApproving(id);
    setError("");
    try {
      const response = await fetch(`${baseUrl.baseUrl}user/approveClosure/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.status === 401) setNeedsSignIn(true);
      if (!response.ok) throw new Error(result.message || "Unable to approve closure.");
      setClosures((items) => items.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Header title="Late Closures" />

      <div className={`transition-all duration-300 ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[18px] font-semibold text-[#212121]">
              Pending Daybook Closures
            </h1>
            {closures.length > 0 && (
              <span
                aria-label={`${closures.length} pending`}
                className="bg-[#9D43D6] text-white text-[11px] font-semibold min-w-[22px] h-[22px] px-1.5 rounded-full inline-flex items-center justify-center"
              >
                {closures.length}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={fetchClosures}
            className="rf-btn-secondary cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Main Content */}
        <main className="bg-white px-8 py-6 max-w-[1400px]">
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <p>{error}</p>
              {needsSignIn && (
                <button
                  type="button"
                  onClick={signInAgain}
                  className="mt-3 rf-btn-primary cursor-pointer"
                >
                  Sign in again
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2.5 text-[#6A6A6A]">
              <Loader2 className="w-5 h-5 animate-spin text-[#9D43D6]" />
              <span className="text-[13px]">Loading pending closures...</span>
            </div>
          ) : error ? null : closures.length === 0 ? (
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-12 text-center text-[#6A6A6A] text-[13px]">
              No pending closure requests found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {closures.map((closure) => {
                const { name, subtitle } = getStoreInfo(closure.locCode);
                const { dateStr, weekday } = formatDateParts(closure.date);
                const isApproving = approving === closure._id;

                return (
                  <article
                    key={closure._id}
                    className="rounded-xl border border-[#E5E5E5] bg-white p-5 flex flex-col justify-between transition-shadow hover:shadow-sm"
                  >
                    {/* Top Store & Date Row */}
                    <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EFEFEF]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#EFE3F7] text-[#9D43D6] flex items-center justify-center shrink-0">
                          <Store size={18} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-[15px] font-semibold text-[#212121] truncate leading-tight">
                            {name}
                          </h2>
                          <p className="text-[12px] text-[#6A6A6A] truncate mt-0.5">
                            {subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-semibold text-[#212121] leading-tight">
                          {dateStr}
                        </p>
                        {weekday && (
                          <p className="text-[12px] text-[#6A6A6A] mt-0.5">
                            {weekday}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Metrics Row: System Cash, Physical Cash, Bank */}
                    <div className="grid grid-cols-3 gap-3 py-4">
                      <div>
                        <p className="text-[11px] font-medium text-[#6A6A6A]">System Cash</p>
                        <p className="text-[14px] font-semibold text-[#212121] mt-1 tabular-nums">
                          {formatAmount(closure.cash)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-[#6A6A6A]">Physical Cash</p>
                        <p className="text-[14px] font-semibold text-[#212121] mt-1 tabular-nums">
                          {formatAmount(closure.Closecash)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-[#6A6A6A]">Bank</p>
                        <p className="text-[14px] font-semibold text-[#212121] mt-1 tabular-nums">
                          {formatAmount(closure.bank)}
                        </p>
                      </div>
                    </div>

                    {/* Approve Button */}
                    <button
                      type="button"
                      disabled={isApproving}
                      onClick={() => approve(closure._id)}
                      className={
                        isApproving
                          ? "rf-btn-disabled w-full !py-2.5"
                          : "rf-btn-primary w-full !py-2.5 cursor-pointer"
                      }
                    >
                      {isApproving ? "Approving..." : "Approve Closure"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PendingDaybookClosures;
