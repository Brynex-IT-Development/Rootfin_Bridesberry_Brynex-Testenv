import { useEffect, useState } from "react";
import { X } from "lucide-react";
import baseUrl from "../api/api";

const API = (baseUrl?.baseUrl || "").replace(/\/$/, "");
const DISMISS_KEY = "rf-subscription-notice-dismissed";

/**
 * Small bottom-right notice shown when the subscription expires within 7 days
 * or has expired (app is read-only). Can be dismissed for the browser session.
 */
const SubscriptionNotice = () => {
  const [sub, setSub] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/subscription`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => alive && setSub(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!sub || dismissed) return null;
  const expired = sub.status === "expired";
  const expiringSoon = !expired && sub.daysLeft !== null && sub.daysLeft <= 7;
  if (!expired && !expiringSoon) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-[60] max-w-[340px] rounded-[10px] border bg-white px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ${
        expired ? "border-[#FECACA]" : "border-[#FDE68A]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-semibold ${expired ? "text-[#DC2626]" : "text-[#B45309]"}`}>
            {expired ? "Subscription expired" : `Subscription expires in ${sub.daysLeft} day${sub.daysLeft === 1 ? "" : "s"}`}
          </p>
          <p className="mt-0.5 text-[12px] text-[#525252]">
            {expired
              ? "The app is read-only. You can view data but not add or change anything. Contact your provider to renew."
              : "Contact your provider to renew and avoid interruption."}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-[6px] text-[#A1A1AA] hover:bg-[#F4F4F5] hover:text-[#525252] cursor-pointer"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default SubscriptionNotice;
