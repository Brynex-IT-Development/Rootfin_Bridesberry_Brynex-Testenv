import { useCallback, useEffect, useState } from "react";
import {
  Box, ChevronDown, DollarSign, FileSpreadsheet, FileText, FolderClosed, Layers, LayoutDashboard,
  LineChart, Notebook, Receipt, ShoppingCart, Truck, Users,
} from "lucide-react";
import { Card, PlanSummary, Row, SUBSCRIPTION_API, inputClass, toDisplayDate, toInputDate } from "../components/subscriptionUi.jsx";
import { ALL_MODULE_DEFINITIONS } from "../utils/permissionService";
import { LOCKED_PAGES } from "../utils/subscriptionPages";

// Provider-only page at /subscriptionadmin. Separate from the app: no app login,
// no side menu. Signs in with the SUBSCRIPTION_ADMIN_KEY set on the server.
// The key is kept for this browser tab only (sessionStorage) until "Sign out".
const SESSION_KEY = "rf-subscription-admin-key";

const readSessionKey = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
};
const writeSessionKey = (value) => {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, value);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
};

const verifyKey = async (key) => {
  const res = await fetch(`${SUBSCRIPTION_API}/verify-key`, { method: "POST", headers: { "x-subscription-key": key } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Sign in failed.");
};

const formFrom = (sub) => ({
  plan: sub.plan || "custom",
  maxStores: sub.maxStores ?? "",
  maxUsers: sub.maxUsers ?? "",
  hiddenPages: [...(sub.hiddenPages || [])].sort(),
  startDate: toInputDate(sub.startDate),
  endDate: toInputDate(sub.endDate),
  notes: sub.notes || "",
});

const PLAN_ORDER = ["standard", "plus", "pro", "custom"];

/** +1 month from the given yyyy-mm-dd (or from today if empty/past), as yyyy-mm-dd. */
const plusOneMonth = (value) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const current = value ? new Date(`${value}T00:00:00`) : null;
  const base = current && current > today ? current : today;
  const day = base.getDate();
  const d = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const PlanPicker = ({ plans, value, onChange }) => (
  <div role="radiogroup" className="grid grid-cols-2 gap-2">
    {PLAN_ORDER.map((key) => {
      const p = plans?.[key];
      if (!p) return null;
      const selected = value === key;
      return (
        <label
          key={key}
          className={`block rounded-[8px] border px-3 py-2 cursor-pointer transition-colors ${
            selected ? "border-[#F2572B] bg-[#FFF7F4]" : "border-[#E5E5E5] bg-white hover:border-[#D4D4D8]"
          }`}
        >
          <input type="radio" name="plan" value={key} checked={selected} onChange={() => onChange(key)} className="sr-only" />
          <span className={`block text-[13px] font-semibold ${selected ? "text-[#F2572B]" : "text-[#212121]"}`}>{p.label}</span>
          <span className="block text-[12px] text-[#6A6A6A] mt-0.5">
            {key === "custom" ? "Set your own limits" : `${p.maxStores} stores · ${p.maxUsers} users`}
          </span>
        </label>
      );
    })}
  </div>
);

// Same icons as the Permissions page
const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  daybook: FileText,
  financial_summary: FileSpreadsheet,
  sales: ShoppingCart,
  inventory: Box,
  purchase: Truck,
  reports: LineChart,
  income: DollarSign,
  record_expense: Receipt,
  expenses: DollarSign,
  late_closures: FolderClosed,
  close_report: FolderClosed,
  admin_close: Notebook,
  manage_users: Users,
};

const CHECKBOX =
  "w-4 h-4 rounded border-2 border-slate-400 checked:border-[#F2572B] bg-white accent-[#F2572B] cursor-pointer hover:scale-105 transition-all disabled:cursor-not-allowed disabled:hover:scale-100";

/** Page selection laid out like the single-role table on the Permissions page. */
const PagePicker = ({ hiddenPages, onChange }) => {
  const hidden = new Set(hiddenPages);
  // Start with "Partial" modules open so it's clear which pages are hidden
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(
      ALL_MODULE_DEFINITIONS.filter((m) => {
        const pages = m.subpages.filter((p) => !LOCKED_PAGES.includes(p.path));
        const hiddenCount = pages.filter((p) => hidden.has(p.path)).length;
        return hiddenCount > 0 && hiddenCount < pages.length;
      }).map((m) => [m.key, true])
    )
  );
  const setVisible = (paths, show) => {
    const next = new Set(hidden);
    paths.forEach((p) => (show ? next.delete(p) : next.add(p)));
    onChange([...next].sort());
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-wider">
            <th className="py-3 px-4 w-12 text-center">#</th>
            <th className="py-3 px-4 min-w-[180px]">Module</th>
            <th className="py-3 px-4 w-36">Access</th>
            <th className="py-3 px-4">Sub-pages &amp; Screens</th>
            <th className="py-3 px-4 w-28 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-xs">
          {ALL_MODULE_DEFINITIONS.map((mod, idx) => {
            const IconComp = MODULE_ICONS[mod.key] || Layers;
            const pages = mod.subpages.filter((p) => !LOCKED_PAGES.includes(p.path));
            const locked = pages.length === 0;
            const visible = pages.filter((p) => !hidden.has(p.path));
            const allVisible = visible.length === pages.length;
            const noneVisible = visible.length === 0;
            const isOpen = locked || !noneVisible;
            const hasSubpages = !mod.isStandalone && mod.subpages.length > 1;
            const isExpanded = Boolean(expanded[mod.key]);
            const badge = locked
              ? { text: "Always on", cls: "bg-gray-100 text-gray-500" }
              : allVisible
                ? { text: "Open", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" }
                : noneVisible
                  ? { text: "Blocked", cls: "bg-gray-100 text-gray-500" }
                  : { text: "Partial", cls: "bg-amber-50 text-amber-700 border border-amber-200" };

            return (
              <tr key={mod.key} className="hover:bg-[#FFF7F4]/60 transition-colors align-top">
                <td className="py-3.5 px-4 text-center text-gray-400 font-mono text-[11px]">{idx + 1}</td>

                <td className="py-3.5 px-4 font-semibold text-gray-800">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isOpen ? "bg-[#FDE3D9] text-[#F2572B]" : "bg-gray-100 text-gray-400"}`}>
                      <IconComp size={16} />
                    </div>
                    <span className={isOpen ? "text-gray-900" : "text-gray-500"}>{mod.label}</span>
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  <label className={`inline-flex items-center gap-2 select-none ${locked ? "" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      className={CHECKBOX}
                      checked={isOpen}
                      disabled={locked}
                      onChange={() => setVisible(pages.map((p) => p.path), noneVisible)}
                    />
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${badge.cls}`}>{badge.text}</span>
                  </label>
                </td>

                <td className="py-3.5 px-4">
                  {!hasSubpages ? (
                    <span className="text-[11px] text-gray-400 italic">
                      {locked ? "Always shown to users" : `Standalone module (direct screen: ${mod.subpages[0]?.path})`}
                    </span>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [mod.key]: !e[mod.key] }))}
                        className={`flex items-center gap-1.5 !text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                          isExpanded ? "bg-[#FFF7F4] text-[#F2572B] border-[#FCCAB9]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <span>{visible.length}/{pages.length} sub-pages active</span>
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[460px]">
                          {pages.map((sub) => {
                            const checked = !hidden.has(sub.path);
                            return (
                              <label
                                key={sub.path}
                                className={`flex items-center gap-2 p-2 rounded-lg border transition-colors select-none cursor-pointer ${
                                  checked ? "bg-[#FFF7F4] border-[#FCCAB9] text-gray-800" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                                }`}
                              >
                                <input type="checkbox" className={CHECKBOX} checked={checked} onChange={() => setVisible([sub.path], !checked)} />
                                <span className={`text-xs ${checked ? "font-medium text-gray-800" : "text-gray-500"}`}>{sub.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </td>

                <td className="py-3.5 px-4 text-right">
                  {hasSubpages ? (
                    <div className="flex items-center justify-end gap-1.5 text-[11px]">
                      <button type="button" onClick={() => setVisible(pages.map((p) => p.path), true)} className="!text-[11px] text-[#F2572B] hover:underline cursor-pointer font-medium">
                        All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button type="button" onClick={() => setVisible(pages.map((p) => p.path), false)} className="!text-[11px] text-gray-400 hover:text-gray-600 hover:underline cursor-pointer">
                        Clear
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** Renewal requests sent from the app's Subscription page. */
const RenewalRequests = ({ adminKey, plans, onAuthFail, onApproved }) => {
  const [requests, setRequests] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${SUBSCRIPTION_API}/renewal-requests`, { headers: { "x-subscription-key": adminKey } });
      if (res.status === 401) return onAuthFail();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load requests.");
      setRequests(data.requests || []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [adminKey, onAuthFail]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id, status) => {
    try {
      const res = await fetch(`${SUBSCRIPTION_API}/renewal-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-subscription-key": adminKey },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) return onAuthFail();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not update the request.");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const approve = async (id) => {
    try {
      const res = await fetch(`${SUBSCRIPTION_API}/renewal-requests/${id}/approve`, {
        method: "POST",
        headers: { "x-subscription-key": adminKey },
      });
      if (res.status === 401) return onAuthFail();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not approve the request.");
      onApproved(data.subscription, data.message);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (requests === null && !error) return null;
  const list = requests || [];
  const waiting = list.filter((r) => r.status === "pending");
  const shown = showAll ? list : waiting;

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          Renewal requests
          {waiting.length > 0 && (
            <span className="rounded-full bg-[#F2572B] px-2 py-0.5 text-[11px] font-semibold text-white">{waiting.length}</span>
          )}
        </span>
      }
      action={
        list.length > waiting.length && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="!text-[12px] !font-normal text-[#6A6A6A] hover:text-[#212121] cursor-pointer">
            {showAll ? "Show waiting only" : "Show history"}
          </button>
        )
      }
    >
      {error && <p className="px-5 py-3 text-[12px] text-[#DC2626]">{error}</p>}
      {shown.length === 0 && !error && (
        <p className="px-5 py-3 text-[13px] text-[#6A6A6A]">No requests waiting.</p>
      )}
      {shown.map((r) => (
        <div key={r._id} className="px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] text-[#212121]">
                <span className="font-semibold">{plans?.[r.requestedPlan]?.label || r.requestedPlan}</span> plan
                <span className="text-[#6A6A6A]"> · {toDisplayDate(r.updatedAt || r.createdAt)}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-[#6A6A6A] truncate">
                {r.requestedBy || "Unknown user"}
                {r.requestedByEmail ? ` (${r.requestedByEmail})` : ""}
              </p>
            </div>
            {r.status === "pending" ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => setStatus(r._id, "dismissed")} className="rf-btn-cancel !h-7 !px-2.5 !text-[12px]">
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => approve(r._id)}
                  className="rf-btn-primary !h-7 !px-3 !text-[12px]"
                  title="Switch to the requested plan and extend by 1 month"
                >
                  Approve (+1 month)
                </button>
              </div>
            ) : (
              <span
                className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                  r.status === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"
                }`}
              >
                {r.status === "done" ? "Done" : "Dismissed"}
              </span>
            )}
          </div>
          {r.message && <p className="mt-1.5 text-[12px] text-[#212121] bg-[#FAFAFA] rounded-[6px] px-2.5 py-1.5 whitespace-pre-wrap">{r.message}</p>}
        </div>
      ))}
    </Card>
  );
};

const LoginScreen = ({ onSignedIn }) => {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await verifyKey(key);
      onSignedIn(key);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-[360px] bg-white rounded-[12px] border border-[#E5E5E5] p-6">
        <h1 className="text-[16px] font-semibold text-[#212121]">Subscription Admin</h1>
        <p className="mt-1 text-[12px] text-[#6A6A6A]">Provider access only.</p>
        <label className="mt-5 block text-[12px] font-medium text-[#6A6A6A]" htmlFor="sub-admin-key">
          Admin key
        </label>
        <input
          id="sub-admin-key"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className={`${inputClass} mt-1 !h-9`}
        />
        {error && <p className="mt-2 text-[12px] text-[#DC2626]">{error}</p>}
        <button type="submit" disabled={!key || busy} className="rf-btn-primary mt-4 w-full !h-9 !text-[13px] disabled:opacity-50">
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
};

const SubscriptionAdmin = () => {
  const [adminKey, setAdminKey] = useState(readSessionKey);
  const [checking, setChecking] = useState(Boolean(readSessionKey()));
  const [sub, setSub] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { text, ok }

  useEffect(() => {
    document.title = "Subscription Admin";
  }, []);

  const signOut = useCallback(() => {
    writeSessionKey("");
    setAdminKey("");
    setSub(null);
    setForm(null);
    setMessage(null);
  }, []);

  // Re-check a key remembered from earlier in this tab
  useEffect(() => {
    if (!checking) return;
    verifyKey(adminKey)
      .catch(() => signOut())
      .finally(() => setChecking(false));
  }, [checking, adminKey, signOut]);

  useEffect(() => {
    if (!adminKey || checking) return;
    fetch(SUBSCRIPTION_API)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Could not load subscription.");
        setSub(data);
        setForm(formFrom(data));
      })
      .catch((e) => setMessage({ text: e.message, ok: false }));
  }, [adminKey, checking]);

  const signIn = (key) => {
    writeSessionKey(key);
    setAdminKey(key);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(SUBSCRIPTION_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-subscription-key": adminKey },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        signOut();
        return;
      }
      if (!res.ok) throw new Error(data.message || "Could not save.");
      setSub(data);
      setForm(formFrom(data));
      setMessage({ text: "Saved. The new limits apply immediately.", ok: true });
    } catch (err) {
      setMessage({ text: err.message, ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (checking) return <div className="min-h-screen bg-[#FAFAFA]" />;
  if (!adminKey) return <LoginScreen onSignedIn={signIn} />;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const dirty = sub && form && JSON.stringify(form) !== JSON.stringify(formFrom(sub));

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <div className="sticky top-0 z-10 bg-white px-6 md:px-8 h-[56px] border-b border-[#E5E5E5] flex items-center justify-between">
        <h1 className="text-[16px] font-semibold text-[#212121]">Subscription Admin</h1>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[12px] text-[#D97706] mr-1">Unsaved changes</span>}
          <button type="button" onClick={signOut} className="rf-btn-cancel !h-[34px] !px-4 !text-[13px]">
            Sign out
          </button>
          <button type="submit" form="subscription-form" disabled={saving || !dirty} className="rf-btn-primary !h-[34px] !px-5 !text-[13px] disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="p-5 md:p-6">
        {message && <p className={`mb-4 text-[13px] ${message.ok ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{message.text}</p>}

        {sub && form && (
          <form
            id="subscription-form"
            onSubmit={save}
            className="grid grid-cols-1 lg:grid-cols-[minmax(380px,440px)_minmax(0,1fr)] gap-4 items-start"
          >
            {/* Left: current plan, usage, plan & limits */}
            <div className="space-y-4">
              <RenewalRequests
                adminKey={adminKey}
                plans={sub.plans}
                onAuthFail={signOut}
                onApproved={(updated, text) => {
                  setSub(updated);
                  setForm(formFrom(updated));
                  setMessage({ text, ok: true });
                }}
              />
              <PlanSummary sub={sub} />
              <Card title="Plan & limits">
                <div className="px-5 py-3">
                  <PlanPicker plans={sub?.plans} value={form.plan} onChange={(plan) => setForm((f) => ({ ...f, plan }))} />
                </div>
                {form.plan === "custom" && (
                  <>
                    <Row label="Max stores">
                      <div className="space-y-1">
                        <input type="number" min="0" className={`${inputClass} max-w-[120px]`} value={form.maxStores} onChange={set("maxStores")} placeholder="Unlimited" />
                        <p className="text-[11px] text-[#6A6A6A]">Warehouse not counted. Leave empty for unlimited.</p>
                      </div>
                    </Row>
                    <Row label="Max users">
                      <div className="space-y-1">
                        <input type="number" min="0" className={`${inputClass} max-w-[120px]`} value={form.maxUsers} onChange={set("maxUsers")} placeholder="Unlimited" />
                        <p className="text-[11px] text-[#6A6A6A]">Leave empty for unlimited.</p>
                      </div>
                    </Row>
                  </>
                )}
                <Row label="Start date">
                  <input type="date" className={`${inputClass} max-w-[180px]`} value={form.startDate} onChange={set("startDate")} />
                </Row>
                <Row label="End date">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input type="date" className={`${inputClass} max-w-[180px]`} value={form.endDate} onChange={set("endDate")} />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, endDate: plusOneMonth(f.endDate) }))}
                        className="!h-8 !px-2.5 !rounded-[8px] !border !border-solid !border-[#E5E5E5] !bg-white hover:!bg-[#FAFAFA] !text-[12px] font-medium text-[#212121] whitespace-nowrap cursor-pointer"
                        title="Extend by 1 month (from the end date if still active, otherwise from today)"
                      >
                        +1 month
                      </button>
                    </div>
                    <p className="text-[11px] text-[#6A6A6A]">After this date the app becomes read-only. Leave empty to never expire.</p>
                  </div>
                </Row>
                <Row label="Notes">
                  <textarea rows={2} className={`${inputClass} !h-auto py-1.5 resize-none`} value={form.notes} onChange={set("notes")} maxLength={500} />
                </Row>
              </Card>
            </div>

            {/* Right: which pages users can see */}
            <div className="bg-white rounded-lg border border-[#E5E5E5] overflow-hidden">
              <div className="px-5 py-3 bg-[#FDE3D9] border-b border-[#FCCAB9] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-[#212121] uppercase tracking-wider">
                  Pages users can see{" "}
                  <span className="text-[#F2572B]">
                    {form.hiddenPages.length === 0 ? "(all shown)" : `(${form.hiddenPages.length} hidden)`}
                  </span>
                </span>
                <span className="text-[12px] text-[#6A6A6A]">
                  Untick to hide from every user, admins included. Click Save to apply.
                </span>
              </div>
              <PagePicker hiddenPages={form.hiddenPages} onChange={(hiddenPages) => setForm((f) => ({ ...f, hiddenPages }))} />
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SubscriptionAdmin;
