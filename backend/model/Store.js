import mongoose from "mongoose";

const StoreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    locCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },
    gst: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    storeType: {
      type: String,
      enum: ["branch", "warehouse", "office"],
      default: "branch",
    },
    manager: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Notify listeners (utils/storeResolver.js cache) whenever stores change.
const storeChangeListeners = new Set();
export const onStoreChange = (fn) => storeChangeListeners.add(fn);
const notifyStoreChange = () => storeChangeListeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
StoreSchema.post("save", notifyStoreChange);
StoreSchema.post(["findOneAndUpdate", "findOneAndDelete", "updateOne", "updateMany", "deleteOne", "deleteMany"], notifyStoreChange);

const Store = mongoose.model("Store", StoreSchema);

export default Store;