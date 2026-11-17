import test from "node:test";
import assert from "node:assert/strict";
import { businessDate, closureStatusFor } from "../utils/daybookDates.js";

test("daybook cutoff uses the India calendar date", () => {
    assert.equal(businessDate(new Date("2026-11-16T18:29:59Z")), "2026-11-16");
    assert.equal(businessDate(new Date("2026-11-16T18:30:00Z")), "2026-11-17");
});

test("today closes immediately and older dates require approval", () => {
    assert.equal(closureStatusFor("2026-11-17", "2026-11-17"), "closed");
    assert.equal(closureStatusFor("2026-11-16", "2026-11-17"), "pending_approval");
    assert.throws(() => closureStatusFor("2026-11-18", "2026-11-17"));
});
