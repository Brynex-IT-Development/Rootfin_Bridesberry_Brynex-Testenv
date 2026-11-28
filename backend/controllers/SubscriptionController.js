import mongoose from "mongoose";
import Subscription from "../model/Subscription.js";
import RenewalRequest from "../model/RenewalRequest.js";
import {
  daysLeft,
  getSubscription,
  getUsage,
  invalidateSubscriptionCache,
  isExpired,
  isValidAdminKey,
  PLAN_PRESETS,
} from "../utils/subscription.js";

// Simple brute-force protection for the vendor key: 10 wrong tries per IP per 15 minutes
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const failures = new Map();

const tooManyFailures = (ip) => {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILS;
};

const recordFailure = (ip) => {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(ip, { first: Date.now(), count: 1 });
  else entry.count += 1;
};

/** Check the x-subscription-key header. Sends the error response and returns false if not allowed. */
const requireAdminKey = (req, res) => {
  if (!process.env.SUBSCRIPTION_ADMIN_KEY) {
    res.status(503).json({ message: "Subscription editing is not set up on this server (SUBSCRIPTION_ADMIN_KEY is missing)." });
    return false;
  }
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  if (tooManyFailures(ip)) {
    res.status(429).json({ message: "Too many wrong attempts. Try again in 15 minutes." });
    return false;
  }
  if (!isValidAdminKey(req.get("x-subscription-key"))) {
    recordFailure(ip);
    res.status(401).json({ message: "Invalid subscription key." });
    return false;
  }
  failures.delete(ip);
  return true;
};

// Pages that can never be hidden (landing page and the subscription page itself)
const LOCKED_PAGES = ["/", "/manage-users/subscription"];

const toResponse = async (sub) => {
  const usage = await getUsage();
  return {
    plan: sub.plan || "custom",
    planName: sub.planName,
    hiddenPages: sub.hiddenPages || [],
    plans: PLAN_PRESETS,
    maxStores: sub.maxStores ?? null,
    maxUsers: sub.maxUsers ?? null,
    startDate: sub.startDate,
    endDate: sub.endDate,
    notes: sub.notes || "",
    updatedAt: sub.updatedAt,
    status: isExpired(sub) ? "expired" : "active",
    daysLeft: daysLeft(sub),
    usage,
    editable: Boolean(process.env.SUBSCRIPTION_ADMIN_KEY),
    renewalMonths: RENEWAL_MONTHS,
    pendingRenewal: await RenewalRequest.findOne({ status: "pending" })
      .sort({ createdAt: -1 })
      .select("requestedPlan message createdAt updatedAt")
      .lean(),
  };
};

// GET /api/subscription — plan, limits and current usage (visible to the app)
export const getSubscriptionInfo = async (req, res) => {
  try {
    const sub = await getSubscription();
    res.json(await toResponse(sub));
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({ message: "Could not load subscription." });
  }
};

// POST /api/subscription/verify-key — lets the page unlock editing
export const verifyAdminKey = (req, res) => {
  if (!requireAdminKey(req, res)) return;
  res.json({ ok: true });
};

const parseLimit = (value, field) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${field} must be a whole number of 0 or more (or empty for unlimited).`);
  return n;
};

const parseDate = (value, field) => {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${field} is not a valid date.`);
  return d;
};

// PUT /api/subscription — vendor only (x-subscription-key header)
export const updateSubscription = async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const body = req.body || {};
    const plan = (body.plan || "custom").toString().toLowerCase();
    if (!PLAN_PRESETS[plan]) {
      return res.status(400).json({ message: "Plan must be standard, plus, pro or custom." });
    }
    const preset = PLAN_PRESETS[plan];
    const hiddenPages = Array.isArray(body.hiddenPages)
      ? [...new Set(body.hiddenPages.map((p) => String(p).trim()).filter((p) => p.startsWith("/") && !LOCKED_PAGES.includes(p)))].slice(0, 200)
      : [];
    const update = {
      plan,
      planName: preset.label,
      // Fixed plans always use their preset limits; only Custom takes the entered numbers
      maxStores: plan === "custom" ? parseLimit(body.maxStores, "Max stores") : preset.maxStores,
      maxUsers: plan === "custom" ? parseLimit(body.maxUsers, "Max users") : preset.maxUsers,
      hiddenPages,
      startDate: parseDate(body.startDate, "Start date"),
      endDate: parseDate(body.endDate, "End date"),
      notes: (body.notes || "").toString().trim().slice(0, 500),
      updatedBy: "vendor",
    };
    if (update.endDate) update.endDate.setHours(23, 59, 59, 999); // valid through the whole last day
    if (update.startDate && update.endDate && update.endDate < update.startDate) {
      return res.status(400).json({ message: "End date cannot be before start date." });
    }

    await Subscription.findOneAndUpdate(
      { key: "default" },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    invalidateSubscriptionCache();
    res.json(await toResponse(await getSubscription()));
  } catch (error) {
    res.status(400).json({ message: error.message || "Could not save subscription." });
  }
};

// ── Renewal requests ─────────────────────────────────────────

// POST /api/subscription/renewal-requests — sent from the app (works even when expired).
// Only one request waits at a time: sending again updates the waiting one.
export const createRenewalRequest = async (req, res) => {
  try {
    const body = req.body || {};
    const requestedPlan = (body.requestedPlan || "standard").toString().toLowerCase();
    if (!PLAN_PRESETS[requestedPlan]) {
      return res.status(400).json({ message: "Plan must be standard, plus, pro or custom." });
    }
    const fields = {
      requestedPlan,
      message: (body.message || "").toString().trim().slice(0, 500),
      requestedBy: (body.requestedBy || "").toString().trim().slice(0, 120),
      requestedByEmail: (body.requestedByEmail || "").toString().trim().slice(0, 160),
    };

    const existing = await RenewalRequest.findOne({ status: "pending" }).sort({ createdAt: -1 });
    if (existing) {
      Object.assign(existing, fields);
      await existing.save();
      return res.status(200).json({ message: "Your renewal request was updated.", request: existing });
    }
    const request = await RenewalRequest.create(fields);
    res.status(201).json({ message: "Renewal request sent to your provider.", request });
  } catch (error) {
    console.error("Create renewal request error:", error);
    res.status(500).json({ message: "Could not send the renewal request." });
  }
};

// GET /api/subscription/renewal-requests — vendor only
export const listRenewalRequests = async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const requests = await RenewalRequest.find({}).sort({ createdAt: -1 }).limit(50).lean();
    // Waiting requests first, then the rest, newest first
    const rank = { pending: 0, done: 1, dismissed: 2 };
    requests.sort((a, b) => rank[a.status] - rank[b.status] || new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ requests });
  } catch (error) {
    console.error("List renewal requests error:", error);
    res.status(500).json({ message: "Could not load renewal requests." });
  }
};

// PATCH /api/subscription/renewal-requests/:id — vendor only; body { status: "done" | "dismissed" | "pending" }
export const updateRenewalRequest = async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const { id } = req.params;
    const status = (req.body?.status || "").toString();
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid request id." });
    if (!["done", "dismissed", "pending"].includes(status)) {
      return res.status(400).json({ message: "Status must be done, dismissed or pending." });
    }
    const request = await RenewalRequest.findByIdAndUpdate(
      id,
      { $set: { status, resolvedAt: status === "pending" ? null : new Date() } },
      { new: true }
    ).lean();
    if (!request) return res.status(404).json({ message: "Request not found." });
    res.json({ request });
  } catch (error) {
    console.error("Update renewal request error:", error);
    res.status(500).json({ message: "Could not update the request." });
  }
};

// Renewals are for one month at a time
const RENEWAL_MONTHS = 1;

/** Add months, clamping to the last day of the month (31 Jan + 1 month = 28/29 Feb). */
const addMonths = (date, months) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};

// POST /api/subscription/renewal-requests/:id/approve — vendor only.
// Switches to the requested plan and extends the subscription by one month:
// from the current end date if still active (no days lost), otherwise from today.
export const approveRenewalRequest = async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid request id." });
    const request = await RenewalRequest.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (request.status !== "pending") return res.status(400).json({ message: "This request was already handled." });

    const current = await getSubscription();
    const now = new Date();
    const stillActive = current.endDate && new Date(current.endDate) > now;
    const base = stillActive ? new Date(current.endDate) : now;
    const endDate = addMonths(base, RENEWAL_MONTHS);
    endDate.setHours(23, 59, 59, 999);

    const update = { plan: request.requestedPlan, planName: PLAN_PRESETS[request.requestedPlan].label, endDate, updatedBy: "vendor" };
    if (!stillActive) update.startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    await Subscription.findOneAndUpdate({ key: "default" }, { $set: update }, { upsert: true, setDefaultsOnInsert: true });
    request.status = "done";
    request.resolvedAt = now;
    await request.save();
    invalidateSubscriptionCache();

    res.json({ message: `Renewed on the ${update.planName} plan until ${endDate.toLocaleDateString("en-IN")}.`, subscription: await toResponse(await getSubscription()) });
  } catch (error) {
    console.error("Approve renewal request error:", error);
    res.status(500).json({ message: "Could not approve the request." });
  }
};
