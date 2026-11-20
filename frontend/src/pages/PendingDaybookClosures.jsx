import { useCallback, useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import { useSidebar } from "../hooks/useSidebar.js";
import baseUrl from "../api/api.js";

const currency = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(Number(value) || 0);

const PendingDaybookClosures = () => {
  const isSidebarOpen = useSidebar();
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const signInAgain = () => {
    localStorage.removeItem("rootfinuser");
    localStorage.removeItem("rootfin_auth_token");
    window.location.assign("/login");
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
        headers: { Authorization: `Bearer ${token}` }
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

  useEffect(() => { fetchClosures(); }, [fetchClosures]);

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
        headers: { Authorization: `Bearer ${token}` }
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
    <div className="min-h-screen bg-[#f5f7fb]">
      <Header title="Late Closures" />
      <main className={`p-6 transition-all ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-800">
              Late Closures
              <span aria-label={`${closures.length} pending`} className="rounded-full bg-amber-500 px-2.5 py-0.5 text-sm font-semibold text-white">
                {closures.length}
              </span>
            </h1>
            <button type="button" onClick={fetchClosures} className="rounded-lg border bg-white px-4 py-2 text-sm">Refresh</button>
          </div>
          {error && <div role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-red-700">
            <p>{error}</p>
            {needsSignIn && <button type="button" onClick={signInAgain} className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-white">Sign in again</button>}
          </div>}
          {loading ? <p>Loading...</p> : error ? null : closures.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-gray-500">No pending closure requests found.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {closures.map((closure) => {
                const difference = Number(closure.cash) - Number(closure.Closecash);
                return (
                  <article key={closure._id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="font-bold text-gray-900">Store {closure.locCode}</h2>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Pending Approval</span>
                    </div>
                    <p className="text-sm text-gray-600">Date: {new Date(closure.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                    <p className="text-sm text-gray-600">System Cash: {currency(closure.cash)}</p>
                    <p className="text-sm text-gray-600">Physical Cash: {currency(closure.Closecash)}</p>
                    <p className="text-sm text-gray-600">Bank: {currency(closure.bank)}</p>
                    <p className={`mt-2 font-semibold ${difference === 0 ? "text-emerald-700" : "text-red-700"}`}>
                      Difference: {currency(difference)}
                    </p>
                    <button type="button" disabled={approving === closure._id} onClick={() => approve(closure._id)}
                      className="mt-5 w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                      {approving === closure._id ? "Approving..." : "Approve Closure"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PendingDaybookClosures;
