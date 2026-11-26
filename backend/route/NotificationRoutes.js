import express from "express";
import { getNotifications } from "../controllers/NotificationController.js";

const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Retrieve notifications for Super Admin or store user
 *     description: Fetches inventory adjustment draft requests, unclosed stores for yesterday, and pending late daybook closure requests.
 *     responses:
 *       200:
 *         description: Successfully retrieved notifications.
 *       500:
 *         description: Server error.
 */
router.get("/", getNotifications);

export default router;
