import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import mongoose from "mongoose";
import User from "../model/UserModel.js";

// AUTH_SECRET should be set in deployments. Keep a local key stable across restarts.
const localSecretFile = new URL("../.closure-auth-secret", import.meta.url);
const localSecret = () => {
    try {
        const saved = readFileSync(localSecretFile, "utf8").trim();
        if (saved) return saved;
    } catch (_error) { /* Generate a key below. */ }
    const generated = randomBytes(32).toString("hex");
    try {
        writeFileSync(localSecretFile, generated, { flag: "wx", mode: 0o600 });
        return generated;
    } catch (_error) {
        try { return readFileSync(localSecretFile, "utf8").trim() || generated; }
        catch (_readError) { return generated; }
    }
};
const secret = process.env.AUTH_SECRET || localSecret();
const sign = (payload) => createHmac("sha256", secret).update(payload).digest("base64url");

export const createClosureAuthToken = (user) => {
    const payload = Buffer.from(JSON.stringify({
        id: String(user._id),
        expires: Date.now() + 12 * 60 * 60 * 1000
    })).toString("base64url");
    return `${payload}.${sign(payload)}`;
};

export const requireClosureApprover = async (req, res, next) => {
    try {
        const token = req.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
        const [payload, signature] = token.split(".");
        if (!payload || !signature) return res.status(401).json({ message: "Please sign in again." });

        const expected = Buffer.from(sign(payload));
        const received = Buffer.from(signature);
        if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
            return res.status(401).json({ message: "Invalid session." });
        }

        const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        if (!session.expires || session.expires < Date.now()) {
            return res.status(401).json({ message: "Session expired. Please sign in again." });
        }

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: "Database unavailable. Please try again when MongoDB reconnects." });
        }
        let user;
        try {
            user = await User.findById(session.id).select("power role email");
        } catch (error) {
            console.error("Closure approver lookup failed:", error);
            return res.status(503).json({ message: "Database unavailable. Please try again shortly." });
        }
        const adminEmails = [
            "officerootments@gmail.com", "brynex@gmail.com",
            "operationsrootments@gmail.com", "headoffice01@gmail.com"
        ];
        const permitted = user && (
            ["admin", "super_admin"].includes(user.power) ||
            ["admin", "superadmin", "financial_head"].includes(user.role) ||
            adminEmails.includes((user.email || "").toLowerCase())
        );
        if (!permitted) {
            return res.status(403).json({ message: "Accountant or admin access required." });
        }
        next();
    } catch (_error) {
        return res.status(401).json({ message: "Invalid session." });
    }
};
