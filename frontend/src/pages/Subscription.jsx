import { useCallback, useEffect, useState } from "react";
import Header from "../components/Header";
import useSidebar from "../hooks/useSidebar";
import { Card, PlanSummary, Row, SUBSCRIPTION_API, inputClass, toDisplayDate } from "../components/subscriptionUi.jsx";

const PLAN_ORDER = ["standard", "plus", "pro", "custom"];

const currentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("rootfinuser") || "{}") || {};
  } catch {
    return {};
  }
};

/**
 * In-app subscription page (super admin). Shows the plan and usage, and lets the
 * customer send a renewal request to the provider (reviewed on /subscriptionadmin).
 */
const Subscription = () => {
  const isSidebarOpen = useSidebar();
  const [sub, setSub] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [request, setRequest] = useState({ requestedPlan: "standard", message: "" });
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null); // { text, ok }

  const load = useCallback(async () => {
    try {
      const res = await fetch(SUBSCRIPTION_API);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load subscription.");
      setSub(data);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = () => {
    const pending = sub?.pendingRenewal;
    setRequest({
      requestedPlan: pending?.requestedPlan || sub?.plan || "standard",
      message: pending?.message || "",
    });
    setNotice(null);
    setShowForm(true);
  };

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    setNotice(null);
    try {
      const user = currentUser();
      const res = await fetch(`${SUBSCRIPTION_API}/renewal-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...request,
          requestedBy: user.username || user.storeName || "",
          requestedByEmail: user.email || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not send the request.");
      setNotice({ text: data.message || "Renewal request sent.", ok: true });
      setShowForm(false);
      load();
    } catch (err) {
      setNotice({ text: err.message, ok: false });
    } finally {
      setSending(false);
    }
  };

  const pending = sub?.pendingRenewal;
  const planLabel = (key) => sub?.plans?.[key]?.label || key;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Subscription" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
        <div className="bg-white px-6 md:px-8 py-3 border-b border-[#E5E5E5] flex items-center justify-between gap-4 min-h-[59px]">
          <h1 className="text-[16px] font-semibold text-[#212121]">Subscription</h1>
          {sub && !showForm && (
            <button type="button" onClick={openForm} className="rf-btn-primary !h-[34px] !px-4 !text-[13px]">
              {pending ? "Update renewal request" : "Request renewal"}
            </button>
          )}
        </div>

        <div className="p-5 md:p-6 space-y-4 max-w-[760px]">
          {error && <p className="text-[13px] text-[#DC2626]">{error}</p>}
          {notice && <p className={`text-[13px] ${notice.ok ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{notice.text}</p>}

          {pending && !showForm && (
            <div className="bg-white rounded-[12px] border border-[#FDE68A] px-5 py-3.5">
              <p className="text-[13px] font-semibold text-[#B45309]">Renewal requested</p>
              <p className="mt-0.5 text-[12px] text-[#525252]">
                Sent {toDisplayDate(pending.updatedAt || pending.createdAt)} for the{" "}
                <span className="font-medium text-[#212121]">{planLabel(pending.requestedPlan)}</span> plan. Your provider will contact you.
              </p>
            </div>
          )}

          {showForm && sub && (
            <form onSubmit={send}>
              <Card
                title={pending ? "Update renewal request" : "Request renewal"}
                action={
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowForm(false)} disabled={sending} className="rf-btn-cancel !h-8 !px-3.5 !text-[13px]">
                      Cancel
                    </button>
                    <button type="submit" disabled={sending} className="rf-btn-primary !h-8 !px-4 !text-[13px] disabled:opacity-50">
                      {sending ? "Sending..." : "Send request"}
                    </button>
                  </div>
                }
              >
                <Row label="Plan">
                  <select
                    className={`${inputClass} max-w-[280px]`}
                    value={request.requestedPlan}
                    onChange={(e) => setRequest((r) => ({ ...r, requestedPlan: e.target.value }))}
                  >
                    {PLAN_ORDER.filter((k) => sub.plans?.[k]).map((k) => {
                      const p = sub.plans[k];
                      return (
                        <option key={k} value={k}>
                          {p.label}
                          {k === "custom" ? " (tell us what you need)" : ` (${p.maxStores} stores, ${p.maxUsers} users)`}
                          {k === sub.plan ? " · current" : ""}
                        </option>
                      );
                    })}
                  </select>
                </Row>
                <Row label="Duration">
                  <span className="text-[13px] text-[#212121]">{sub.renewalMonths || 1} month</span>
                  <span className="ml-2 text-[12px] text-[#6A6A6A]">Added after your current end date, so you don&apos;t lose remaining days.</span>
                </Row>
                <Row label="Note">
                  <textarea
                    rows={3}
                    maxLength={500}
                    className={`${inputClass} !h-auto py-1.5 resize-none`}
                    placeholder="Optional. For example: we need 2 more stores."
                    value={request.message}
                    onChange={(e) => setRequest((r) => ({ ...r, message: e.target.value }))}
                  />
                </Row>
              </Card>
            </form>
          )}

          {sub && <PlanSummary sub={sub} />}
        </div>
      </div>
    </div>
  );
};

export default Subscription;
