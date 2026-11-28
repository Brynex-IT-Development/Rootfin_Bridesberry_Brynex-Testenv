import crypto from "crypto";
import Subscription from "../model/Subscription.js";
import Store from "../model/Store.js";
import User from "../model/UserModel.js";

/**
 * Subscription rules for this installation:
 *  - maxStores: how many active stores (branches) may exist. The central
 *    warehouse (storeType "warehouse") does not count.
 *  - maxUsers:  how many user accounts may exist.
 *  - endDate:   after this date the app becomes read-only (data can be viewed,
 *    nothing can be added, edited or deleted) until the subscription is renewed.
 */

// Fixed plans. "custom" uses whatever limits the vendor enters.
// Change the numbers here and every customer on that plan gets them immediately.
export const PLAN_PRESETS = {
  standard: { label: "Standard", maxStores: 2, maxUsers: 4 },
  plus: { label: "Plus", maxStores: 4, maxUsers: 6 },
  pro: { label: "Pro", maxStores: 6, maxUsers: 8 },
  custom: { label: "Custom", maxStores: null, maxUsers: null },
};

/** Limits always come from the preset for fixed plans (custom keeps its own numbers). */
const applyPreset = (doc) => {
  const plan = PLAN_PRESETS[doc?.plan] ? doc.plan : "custom";
  if (plan === "custom") return { ...doc, plan, planName: PLAN_PRESETS.custom.label };
  const preset = PLAN_PRESETS[plan];
  return { ...doc, plan, planName: preset.label, maxStores: preset.maxStores, maxUsers: preset.maxUsers };
};

const CACHE_MS = 15 * 1000;
let cached = null;
let cachedAt = 0;

export const invalidateSubscriptionCache = () => {
  cached = null;
  cachedAt = 0;
};

export const getSubscription = async () => {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  let doc = await Subscription.findOne({ key: "default" }).lean();
  if (!doc) {
    doc = (await Subscription.findOneAndUpdate(
      { key: "default" },
      { $setOnInsert: { key: "default" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean());
  }
  cached = applyPreset(doc);
  cachedAt = Date.now();
  return cached;
};

/** Active stores that count against the limit (warehouses excluded). */
const countableStoreFilter = { isActive: { $ne: false }, storeType: { $ne: "warehouse" } };

export const getUsage = async () => {
  const [stores, users] = await Promise.all([
    Store.countDocuments(countableStoreFilter),
    User.countDocuments({}),
  ]);
  return { stores, users };
};

export const isExpired = (sub) => Boolean(sub?.endDate) && new Date(sub.endDate).getTime() < Date.now();

export const daysLeft = (sub) => {
  if (!sub?.endDate) return null;
  return Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};

export class SubscriptionLimitError extends Error {
  constructor(message, code) {
    super(message);
    this.status = 403;
    this.code = code;
  }
}

/**
 * Throw if adding/activating the store `locCode` would go over the store limit.
 * Re-saving a store that is already active, or a warehouse, is always allowed.
 */
export const assertCanAddStore = async (locCode, { storeType } = {}) => {
  if (storeType === "warehouse") return;
  const sub = await getSubscription();
  if (sub.maxStores === null || sub.maxStores === undefined) return;

  const code = (locCode ?? "").toString().trim();
  if (code) {
    const existing = await Store.findOne({ locCode: code }).select("isActive storeType").lean();
    if (existing && existing.isActive !== false) return; // already counted
    if (existing && existing.storeType === "warehouse") return;
  }

  await assertStoreSlotAvailable(sub);
};

/** Throw if there is no free store slot (used when a store becomes countable). */
export const assertStoreSlotAvailable = async (subscription) => {
  const sub = subscription || (await getSubscription());
  if (sub.maxStores === null || sub.maxStores === undefined) return;
  const used = await Store.countDocuments(countableStoreFilter);
  if (used >= sub.maxStores) {
    throw new SubscriptionLimitError(
      `Store limit reached: your ${sub.planName} plan allows ${sub.maxStores} store${sub.maxStores === 1 ? "" : "s"} and ${used} are in use. Contact your provider to upgrade.`,
      "STORE_LIMIT"
    );
  }
};

/** Throw if creating one more user would go over the user limit. */
export const assertCanAddUser = async () => {
  const sub = await getSubscription();
  if (sub.maxUsers === null || sub.maxUsers === undefined) return;
  const used = await User.countDocuments({});
  if (used >= sub.maxUsers) {
    throw new SubscriptionLimitError(
      `User limit reached: your ${sub.planName} plan allows ${sub.maxUsers} user${sub.maxUsers === 1 ? "" : "s"} and ${used} exist. Contact your provider to upgrade.`,
      "USER_LIMIT"
    );
  }
};

/** Send a SubscriptionLimitError as a response. Returns true if it handled the error. */
export const sendLimitError = (res, error) => {
  if (!(error instanceof SubscriptionLimitError)) return false;
  res.status(error.status).json({ message: error.message, code: error.code });
  return true;
};

// Writes that must keep working when the subscription has expired
const ALWAYS_ALLOWED = [
  /^\/api\/subscription(\/|$)/, // renewing
  /^\/user\/login\/?$/,         // signing in
];

/**
 * Express middleware: once the subscription has expired, block every
 * create/edit/delete request (read-only mode). Reads keep working.
 */
export const readOnlyWhenExpired = async (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (ALWAYS_ALLOWED.some((re) => re.test(req.path))) return next();
  try {
    const sub = await getSubscription();
    if (isExpired(sub)) {
      return res.status(403).json({
        message: `Your subscription expired on ${new Date(sub.endDate).toLocaleDateString("en-IN")}. The app is read-only until it is renewed. Contact your provider.`,
        code: "SUBSCRIPTION_EXPIRED",
      });
    }
  } catch (error) {
    console.error("Subscription check failed:", error.message);
  }
  return next();
};

/** Constant-time check of the vendor key against SUBSCRIPTION_ADMIN_KEY. */
export const isValidAdminKey = (provided) => {
  const expected = process.env.SUBSCRIPTION_ADMIN_KEY || "";
  if (!expected || typeof provided !== "string" || !provided) return false;
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};
