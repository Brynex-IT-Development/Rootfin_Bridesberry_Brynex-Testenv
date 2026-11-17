import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import baseUrl from "../api/api.js";
import { daybookToday, previousDaybookDate } from "../utils/daybookDates.js";

const DaybookGuard = ({ user, admin = false, children }) => {
  const { pathname } = useLocation();
  const power = (user?.power || "").toLowerCase();
  const role = (user?.role || "").toLowerCase();
  const exempt = !user || admin || power === "admin" || power === "super_admin" ||
    ["admin", "superadmin", "cluster_manager", "cluster_admin", "financial_head"].includes(role);
  const needsCheck = !exempt && pathname !== "/" && pathname !== "/login";
  const date = previousDaybookDate(daybookToday());
  // The closure status is location/date specific, not page specific. Keeping the
  // pathname out of the key avoids re-checking (and showing the verification
  // screen) every time the user navigates to another page.
  const checkKey = `${user?.locCode || ""}:${date}`;
  const [state, setState] = useState({ loading: true, reason: null, key: null });

  useEffect(() => {
    if (exempt || pathname === "/login") return;
    const openedOn = daybookToday();
    const timer = window.setInterval(() => {
      if (daybookToday() !== openedOn) window.location.assign("/");
    }, 60000);
    return () => window.clearInterval(timer);
  }, [exempt, pathname]);

  const checkClosure = useCallback(async () => {
    if (!needsCheck) return;
    setState({ loading: true, reason: null, key: checkKey });
    try {
      const params = new URLSearchParams({ locCode: String(user.locCode || ""), date });
      const response = await fetch(`${baseUrl.baseUrl}user/getsaveCashBank?${params}`);
      if (!response.ok) throw new Error("Unable to check daybook status.");
      const result = await response.json();
      const reason = !result.data ? "missing_yesterday" :
        result.data.status === "pending_approval" ? "pending_approval" : null;
      setState({ loading: false, reason, key: checkKey });
    } catch (_error) {
      setState({ loading: false, reason: "check_failed", key: checkKey });
    }
  }, [needsCheck, checkKey, date, user?.locCode]);

  useEffect(() => {
    if (needsCheck && state.key !== checkKey) checkClosure();
  }, [needsCheck, state.key, checkKey, checkClosure]);

  if (!needsCheck) return children;
  if (state.loading || state.key !== checkKey) return <div className="p-8 text-center">Verifying daybook status...</div>;
  if (!state.reason) return children;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Day Book Locked</h1>
        <p className="mt-4 text-gray-600">
          {state.reason === "missing_yesterday"
            ? "Yesterday's day book needs to be closed before you can continue. The late closure will require accountant approval."
            : state.reason === "pending_approval"
              ? "Yesterday's late day book closure is waiting for accountant approval."
              : "Daybook status could not be checked. Please try again."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {state.reason === "missing_yesterday" && (
            <Link to="/" className="rounded-lg bg-purple-600 px-4 py-2 text-white">Close Day Book</Link>
          )}
          <button type="button" onClick={checkClosure} className="rounded-lg border px-4 py-2 text-gray-800">
            Check Status Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default DaybookGuard;
