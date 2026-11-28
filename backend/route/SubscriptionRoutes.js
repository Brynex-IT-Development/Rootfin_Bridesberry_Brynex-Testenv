import express from "express";
import {
  approveRenewalRequest,
  createRenewalRequest,
  getSubscriptionInfo,
  listRenewalRequests,
  updateRenewalRequest,
  updateSubscription,
  verifyAdminKey,
} from "../controllers/SubscriptionController.js";

const router = express.Router();

router.get("/", getSubscriptionInfo);
router.post("/verify-key", verifyAdminKey);
router.put("/", updateSubscription);

// Renewal requests: the app sends them, the provider reviews them on /subscriptionadmin
router.post("/renewal-requests", createRenewalRequest);
router.get("/renewal-requests", listRenewalRequests);
router.patch("/renewal-requests/:id", updateRenewalRequest);
router.post("/renewal-requests/:id/approve", approveRenewalRequest);

export default router;
