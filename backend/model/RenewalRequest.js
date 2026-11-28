import mongoose from "mongoose";

/** A customer's request to renew or change their subscription (sent from the app). */
const RenewalRequestSchema = new mongoose.Schema(
  {
    requestedPlan: { type: String, enum: ["standard", "plus", "pro", "custom"], default: "standard" },
    message: { type: String, default: "", trim: true, maxlength: 500 },
    requestedBy: { type: String, default: "", trim: true, maxlength: 120 },
    requestedByEmail: { type: String, default: "", trim: true, maxlength: 160 },
    status: { type: String, enum: ["pending", "done", "dismissed"], default: "pending", index: true },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const RenewalRequest = mongoose.models.RenewalRequest || mongoose.model("RenewalRequest", RenewalRequestSchema);

export default RenewalRequest;
