import mongoose from "mongoose";

/**
 * The single subscription record for this installation.
 * Only the vendor (holder of SUBSCRIPTION_ADMIN_KEY) can change it.
 * A limit of null means "unlimited".
 */
const SubscriptionSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true }, // singleton
    // standard / plus / pro use fixed limits (see PLAN_PRESETS); custom uses maxStores/maxUsers below
    plan: { type: String, enum: ["standard", "plus", "pro", "custom"], default: "custom" },
    planName: { type: String, default: "Custom", trim: true },
    maxStores: { type: Number, default: null, min: 0 },
    maxUsers: { type: Number, default: null, min: 0 },
    // Page paths (e.g. "/purchase/orders") hidden from every user of this installation
    hiddenPages: { type: [String], default: [] },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null }, // null = never expires
    notes: { type: String, default: "", trim: true },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

const Subscription = mongoose.models.Subscription || mongoose.model("Subscription", SubscriptionSchema);

export default Subscription;
