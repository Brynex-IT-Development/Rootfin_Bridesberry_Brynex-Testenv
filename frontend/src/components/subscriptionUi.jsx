import baseUrl from "../api/api";

// Shared pieces for the Subscription (view) and Subscription Admin (edit) pages.

export const SUBSCRIPTION_API = `${(baseUrl?.baseUrl || "").replace(/\/$/, "")}/api/subscription`;

export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
export const toDisplayDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export const inputClass =
  "h-8 w-full rounded-[8px] border border-[#E5E5E5] bg-white px-2.5 text-[13px] text-[#212121] focus:border-[#F2572B] focus:outline-none focus:ring-2 focus:ring-[#F2572B]/15";

export const Row = ({ label, children }) => (
  <div className="flex items-start gap-4 px-5 py-2.5">
    <span className="w-[110px] shrink-0 text-[12px] text-[#6A6A6A] pt-1">{label}</span>
    <div className="min-w-0 flex-1 text-[13px] text-[#212121] pt-0.5">{children}</div>
  </div>
);

export const Card = ({ title, action, children }) => (
  <div className="bg-white rounded-[12px] border border-[#E5E5E5] overflow-hidden">
    <div className="px-5 py-3 border-b border-[#F0F0F0] flex items-center justify-between gap-3">
      <span className="text-[14px] font-semibold text-[#212121]">{title}</span>
      {action}
    </div>
    <div className="divide-y divide-[#F4F4F5]">{children}</div>
  </div>
);

export const UsageRow = ({ label, used, max }) => {
  const unlimited = max === null || max === undefined;
  const pct = unlimited ? 0 : max === 0 ? 100 : Math.min(100, Math.round((used / max) * 100));
  const atLimit = !unlimited && used >= max;
  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-[#212121]">{label}</span>
        <span className={`tabular-nums ${atLimit ? "text-[#DC2626] font-medium" : "text-[#212121]"}`}>
          {used} <span className="text-[#6A6A6A]">of {unlimited ? "unlimited" : max}</span>
        </span>
      </div>
      {!unlimited && (
        <div className="mt-2 h-1.5 rounded-full bg-[#F4F4F5] overflow-hidden">
          <div
            className={`h-full rounded-full ${atLimit ? "bg-[#DC2626]" : pct >= 75 ? "bg-[#F59E0B]" : "bg-[#16A34A]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {atLimit && (
        <p className="mt-1.5 text-[12px] text-[#DC2626]">Limit reached. New {label.toLowerCase()} can&apos;t be added.</p>
      )}
    </div>
  );
};

export const statusText = (sub) => {
  if (!sub) return { text: "-", color: "text-[#6A6A6A]" };
  if (sub.status === "expired") return { text: `Expired on ${toDisplayDate(sub.endDate)} (read-only)`, color: "text-[#DC2626]" };
  if (sub.daysLeft === null) return { text: "Active, no expiry date", color: "text-[#16A34A]" };
  if (sub.daysLeft <= 7) return { text: `Active, expires in ${sub.daysLeft} day${sub.daysLeft === 1 ? "" : "s"}`, color: "text-[#D97706]" };
  return { text: `Active, ${sub.daysLeft} days left`, color: "text-[#16A34A]" };
};

/** Read-only plan summary + usage, used by both pages. */
export const PlanSummary = ({ sub }) => {
  const status = statusText(sub);
  return (
    <>
      <Card title="Plan">
        <Row label="Plan">{sub.planName}</Row>
        <Row label="Status"><span className={status.color}>{status.text}</span></Row>
        <Row label="Valid">
          {toDisplayDate(sub.startDate)} <span className="text-[#A1A1AA] mx-1">to</span>{" "}
          {sub.endDate ? toDisplayDate(sub.endDate) : "No end date"}
        </Row>
        {(sub.hiddenPages || []).length > 0 && (
          <Row label="Hidden pages">{sub.hiddenPages.length} page{sub.hiddenPages.length === 1 ? "" : "s"} not included</Row>
        )}
        {sub.notes && <Row label="Notes">{sub.notes}</Row>}
      </Card>
      <Card title="Usage">
        <UsageRow label="Stores" used={sub.usage.stores} max={sub.maxStores} />
        <UsageRow label="Users" used={sub.usage.users} max={sub.maxUsers} />
      </Card>
    </>
  );
};
