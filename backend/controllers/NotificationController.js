import InventoryAdjustment from "../model/InventoryAdjustment.js";
import CloseTransaction from "../model/Closing.js";
import User from "../model/UserModel.js";
import Store from "../model/Store.js";
import { isAllowedStore } from "./StoreController.js";
import { businessDate, previousDaybookDate } from "../utils/daybookDates.js";
import { locCodesWithDaybookActivity } from "../utils/daybookActivity.js";

/**
 * Controller to fetch dynamic notifications for Super Admin and Store users.
 * 1. Inventory Adjustment draft requests submitted for Super Admin review.
 * 2. Active stores that did not close yesterday.
 * 3. Day book late closure requests pending approval.
 */
export const getNotifications = async (req, res) => {
  try {
    const role = (req.query.role || req.query.userPower || req.headers["x-user-role"] || req.headers["user"] || "").toLowerCase();
    const userPower = (req.query.userPower || "").toLowerCase();
    const userLocCode = (req.query.locCode || "").toString().trim().toLowerCase();

    const isSuperAdmin =
      role === "super_admin" ||
      role === "superadmin" ||
      role === "super admin" ||
      role === "admin" ||
      userPower === "super_admin" ||
      userPower === "admin";

    const today = businessDate();
    const yesterday = previousDaybookDate(today);

    const notifications = [];

    // 1. Fetch Draft Inventory Adjustments
    const draftQuery = { status: "draft" };
    if (!isSuperAdmin && userLocCode) {
      draftQuery.$or = [
        { warehouse: new RegExp(`^${userLocCode}$`, "i") },
        { branch: new RegExp(`^${userLocCode}$`, "i") }
      ];
    }
    const draftAdjustments = await InventoryAdjustment.find(draftQuery)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    draftAdjustments.forEach((item) => {
      notifications.push({
        id: `ia_${item._id}`,
        entityId: item._id,
        type: "inventory_adjustment",
        title: "Inventory Adjustment Request",
        message: `${item.referenceNumber || "Adjustment"} for ${item.warehouse || item.branch || "Store"} (${item.reason || "Pending Review"})`,
        link: `/inventory/adjustments`,
        createdAt: item.createdAt || item.date || new Date(),
        severity: "warning",
        badge: "Draft",
        meta: {
          referenceNumber: item.referenceNumber,
          warehouse: item.warehouse,
          reason: item.reason,
          totalQuantityAdjusted: item.totalQuantityAdjusted,
          createdBy: item.createdBy,
        },
      });
    });

    // 2. Fetch Late Day Book Closure Requests (status: pending_approval)
    const closureQuery = { status: "pending_approval" };
    if (!isSuperAdmin && userLocCode) {
      closureQuery.locCode = new RegExp(`^${userLocCode}$`, "i");
    }
    const pendingClosures = await CloseTransaction.find(closureQuery)
      .sort({ date: -1, createdAt: -1 })
      .limit(100)
      .lean();

    pendingClosures.forEach((item) => {
      const dateStr = businessDate(item.date);
      notifications.push({
        id: `closure_${item._id}`,
        entityId: item._id,
        type: "closure_request",
        title: "Day Book Closure Request",
        message: `${item.locCode} requested closure approval for ${dateStr}`,
        link: `/pending-closures`,
        createdAt: item.createdAt || item.date || new Date(),
        severity: "info",
        badge: "Pending Approval",
        meta: {
          locCode: item.locCode,
          date: dateStr,
          cash: item.cash,
          cloecash: item.Closecash,
          bank: item.bank,
        },
      });
    });

    // 3. Check for Stores that Did Not Close Yesterday
    // Find active store admins with assigned locCode
    const storeAdmins = await User.find(
      {
        role: {
          $in: [
            "store_admin",
            "store_manager",
            "store admin",
            "warehouse_admin",
            "warehouseadmin",
            "warehouse admin",
          ],
        },
        locCode: { $exists: true, $ne: "" },
      },
      { password: 0 }
    ).lean();

    const validLocCodes = storeAdmins
      .map((u) => (u.locCode || "").toString().trim())
      .filter(Boolean);

    let dbStores = [];
    if (validLocCodes.length > 0) {
      try {
        dbStores = await Store.find({
          locCode: { $in: validLocCodes },
          isActive: { $ne: false },
        }).lean();
      } catch (e) {
        console.warn("Could not query Store collection:", e.message);
      }
    }

    const storeMap = new Map();
    for (const u of storeAdmins) {
      const code = (u.locCode || "").toString().trim();
      if (code) {
        const key = code.toLowerCase();
        if (!storeMap.has(key)) {
          const storeDoc = dbStores.find(
            (s) => (s.locCode || "").toString().trim().toLowerCase() === key
          );
          storeMap.set(key, {
            locName: storeDoc?.name || storeDoc?.locName || u.storeName || u.username || code,
            locCode: code,
            isActive: true,
          });
        }
      }
    }

    let activeStores = Array.from(storeMap.values()).filter(isAllowedStore);

    if (!isSuperAdmin && userLocCode) {
      activeStores = activeStores.filter(
        (s) => s.locCode.toLowerCase() === userLocCode
      );
    }

    if (activeStores.length > 0) {
      // Query close transactions around yesterday's date
      const targetDate = new Date(`${yesterday}T00:00:00.000Z`);
      const startWindow = new Date(targetDate.getTime() - 12 * 3600 * 1000);
      const endWindow = new Date(targetDate.getTime() + 36 * 3600 * 1000);

      const yesterdayCloses = await CloseTransaction.find({
        date: { $gte: startWindow, $lte: endWindow },
      }).lean();

      const closedLocCodes = new Set(
        yesterdayCloses
          .filter((c) => businessDate(c.date) === yesterday)
          .map((c) => (c.locCode || "").toString().trim().toLowerCase())
      );

      const notClosed = activeStores.filter(
        (store) => !closedLocCodes.has((store.locCode || "").toString().trim().toLowerCase())
      );
      // A store with no day book history yet (e.g. just created) owes no closing.
      const owingCodes = await locCodesWithDaybookActivity(notClosed.map((s) => s.locCode), yesterday);
      const unclosedStores = notClosed.filter(
        (store) => owingCodes.has((store.locCode || "").toString().trim())
      );

      unclosedStores.forEach((store) => {
        notifications.push({
          id: `unclosed_${store.locCode}_${yesterday}`,
          entityId: store.locCode,
          type: "unclosed_yesterday",
          title: "Day Book Not Closed",
          message: `${store.locName} did not close Day Book for yesterday (${yesterday})`,
          link: `/CloseReport`,
          createdAt: new Date(`${yesterday}T23:59:59.000Z`),
          severity: "danger",
          badge: "Unclosed",
          meta: {
            locCode: store.locCode,
            locName: store.locName,
            date: yesterday,
          },
        });
      });
    }

    // Sort by latest createdAt first
    notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const counts = {
      all: notifications.length,
      inventory_adjustment: notifications.filter((n) => n.type === "inventory_adjustment").length,
      unclosed_yesterday: notifications.filter((n) => n.type === "unclosed_yesterday").length,
      closure_request: notifications.filter((n) => n.type === "closure_request").length,
    };

    return res.status(200).json({
      success: true,
      count: notifications.length,
      counts,
      notifications,
    });
  } catch (error) {
    console.error("getNotifications Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};
