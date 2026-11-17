import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "../model/UserModel.js";
import { createClosureAuthToken, requireClosureApprover } from "../utils/closureAuth.js";

const userId = "507f1f77bcf86cd799439011";

const checkAccess = async (token) => {
    let status = 200;
    let body;
    let admitted = false;
    const req = { get: () => `Bearer ${token}` };
    const res = {
        status(code) { status = code; return this; },
        json(value) { body = value; return this; }
    };
    await requireClosureApprover(req, res, () => { admitted = true; });
    return { status, body, admitted };
};

test("only a signed-in approver can access closure approval", async () => {
    const originalFindById = User.findById;
    const originalReadyState = mongoose.connection._readyState;
    let user = { power: "normal", role: "financial_head", email: "finance@example.com" };
    User.findById = () => ({ select: async () => user });
    mongoose.connection._readyState = 1;
    try {
        const token = createClosureAuthToken({ _id: userId });
        assert.equal((await checkAccess(token)).admitted, true);

        user = { power: "normal", role: "store_user", email: "store@example.com" };
        const denied = await checkAccess(token);
        assert.equal(denied.status, 403);
        assert.equal(denied.admitted, false);

        const tampered = await checkAccess(`${token}x`);
        assert.equal(tampered.status, 401);
        assert.equal(tampered.admitted, false);

        mongoose.connection._readyState = 0;
        const unavailable = await checkAccess(token);
        assert.equal(unavailable.status, 503);
        assert.equal(unavailable.admitted, false);
    } finally {
        User.findById = originalFindById;
        mongoose.connection._readyState = originalReadyState;
    }
});
