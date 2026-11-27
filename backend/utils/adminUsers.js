import User from "../model/UserModel.js";

/**
 * Admin access is decided only by the user's role (or legacy power field) in the
 * database — never by a hardcoded email address.
 *
 * Requests identify the user by email/username (`userId`), so this looks the user
 * up and caches the answer briefly to avoid a query per request.
 */
const ADMIN_ROLES = new Set(["admin", "super_admin", "superadmin"]);
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // key -> { value, at }

export const isAdminUserId = async (userId) => {
  const key = (userId ?? "").toString().trim().toLowerCase();
  if (!key) return false;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  let value = false;
  try {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`^${escaped}$`, "i");
    const user = await User.findOne({ $or: [{ email: rx }, { username: rx }] }, { role: 1, power: 1 }).lean();
    const role = (user?.role || "").toString().toLowerCase().trim();
    const power = (user?.power || "").toString().toLowerCase().trim();
    value = ADMIN_ROLES.has(role) || ADMIN_ROLES.has(power);
  } catch (err) {
    console.warn("isAdminUserId lookup failed:", err.message);
  }
  cache.set(key, { value, at: Date.now() });
  return value;
};
