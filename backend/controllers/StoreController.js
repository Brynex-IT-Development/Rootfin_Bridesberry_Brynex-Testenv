import Store from "../model/Store.js";
import User from "../model/UserModel.js";
import mongoose from "mongoose";
import { assertCanAddStore, assertStoreSlotAvailable, sendLimitError } from "../utils/subscription.js";

// Stores come only from the backend: a store is listed when it has an active
// Store Admin / Warehouse Admin user (see getStores / GetAllStores). There is no
// hardcoded list of allowed or blocked stores.
export const isAllowedStore = (store) => {
  if (!store) return false;
  if (store.isActive === false) return false;
  return Boolean((store.locCode || "").toString().trim());
};

// Create a new store
export const createStore = async (req, res) => {
  try {
    const storeData = req.body;
    
    if (!storeData.name || !storeData.locCode) {
      return res.status(400).json({ 
        message: "Store name and location code (locCode) are required" 
      });
    }
    
    if (storeData.email === '' || !storeData.email) {
      delete storeData.email;
    }

    // Subscription: refuse a new store once the plan's store limit is reached
    if (storeData.isActive !== false) {
      await assertCanAddStore(storeData.locCode, { storeType: storeData.storeType });
    }

    const store = await Store.findOneAndUpdate(
      { locCode: storeData.locCode.toString().trim() },
      { ...storeData, isActive: storeData.isActive !== false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    const storeObj = store.toObject ? store.toObject() : { ...store };
    storeObj.id = (storeObj._id || "").toString();
    
    res.status(201).json({
      message: "Store created successfully",
      store: storeObj,
    });
  } catch (error) {
    if (sendLimitError(res, error)) return;
    console.error("Create store error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: "Store with this location code already exists" 
      });
    }
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ 
        message: "Validation error", 
        errors: validationErrors 
      });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all stores - only stores with existing store admin
export const getStores = async (req, res) => {
  try {
    const { isActive } = req.query;

    // First ensure super admin accounts have no store associations
    await User.updateMany(
      { role: { $in: ['super_admin', 'superadmin'] } },
      { $set: { locCode: '', storeName: null, storeId: null } }
    ).catch(() => {});

    // Make sure every warehouse admin's own location has a warehouse-type Store document
    const warehouseAdmins = await User.find({
      role: { $in: ["warehouse_admin", "warehouseadmin", "warehouse admin"] },
      locCode: { $exists: true, $ne: "" }
    }).lean();
    for (const w of warehouseAdmins) {
      await Store.findOneAndUpdate(
        { locCode: w.locCode.toString().trim() },
        {
          $set: { storeType: "warehouse", isActive: true },
          $setOnInsert: {
            name: w.storeName || w.username,
            address: w.address || "",
            phone: w.phone || "",
            email: w.email || "",
            gst: w.gst || "",
            manager: w.username || ""
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).catch(() => {});
    }

    // Look up active Store Admin or Warehouse Admin users (each must have a location code)
    const storeAdmins = await User.find({
      role: { $in: ["store_admin", "store_manager", "store admin", "warehouse_admin", "warehouseadmin", "warehouse admin"] },
      locCode: { $exists: true, $ne: "" }
    }).select("username storeName locCode email address phone gst role").lean();

    const validLocCodes = storeAdmins.map(u => (u.locCode || "").toString().trim()).filter(Boolean);

    // Prune orphaned stores from Store collection if no store admin exists for them
    try {
      if (validLocCodes.length > 0) {
        await Store.deleteMany({ locCode: { $nin: validLocCodes } });
      } else {
        await Store.deleteMany({});
      }
    } catch (e) {}

    if (validLocCodes.length === 0) {
      return res.status(200).json({
        message: "Stores retrieved successfully",
        stores: [],
      });
    }

    const filter = {
      locCode: { $in: validLocCodes }
    };
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    } else {
      filter.isActive = { $ne: false };
    }

    let dbStores = [];
    try {
      dbStores = await Store.find(filter).sort({ name: 1 }).lean();
    } catch (e) {
      console.warn("Could not query Store collection:", e.message);
    }

    const combinedMap = new Map();

    for (const u of storeAdmins) {
      const code = (u.locCode || "").toString().trim();
      const isWarehouse = ['warehouse_admin', 'warehouseadmin', 'warehouse admin'].includes((u.role || '').toLowerCase().trim());
      if (code) {
        const s = dbStores.find(doc => (doc.locCode || "").toString().trim() === code);
        const defaultName = u.storeName || u.username || code;
        combinedMap.set(code, {
          id: (s?._id || s?.id || u._id || code).toString(),
          name: s?.name || defaultName,
          locCode: code,
          locName: s?.name || defaultName,
          address: s?.address || u.address || "",
          phone: s?.phone || u.phone || "",
          email: s?.email || u.email || "",
          gst: s?.gst || u.gst || "",
          storeType: s?.storeType || (isWarehouse ? "warehouse" : "branch"),
          isActive: true
        });
      }
    }

    // Drop inactive / code-less entries and sort
    const storesList = Array.from(combinedMap.values())
      .filter(isAllowedStore)
      .sort((a, b) => (a.name || a.locName || "").localeCompare(b.name || b.locName || ""));

    return res.status(200).json({
      message: "Stores retrieved successfully",
      stores: storesList,
    });
  } catch (error) {
    console.error("Get stores error:", error.message);
    return res.status(200).json({
      message: "Stores retrieved successfully",
      stores: [],
    });
  }
};

// Get store by ID
export const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid store ID" });
    }
    
    const store = await Store.findById(id);
    
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }
    
    const obj = store.toObject();
    obj.id = obj._id.toString();
    
    res.status(200).json({
      message: "Store retrieved successfully",
      store: obj,
    });
  } catch (error) {
    console.error("Get store by ID error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get store by location code
export const getStoreByLocCode = async (req, res) => {
  try {
    const { locCode } = req.params;
    
    const store = await Store.findOne({ locCode });
    
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }
    
    const storeObj = store.toObject();
    storeObj.id = storeObj._id.toString();
    
    res.status(200).json({
      message: "Store retrieved successfully",
      store: storeObj,
    });
  } catch (error) {
    console.error("Get store by locCode error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update store
export const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid store ID" });
    }
    
    // Subscription: re-activating a store, or turning a warehouse into a branch,
    // takes a store slot
    const current = await Store.findById(id).select("isActive storeType").lean();
    if (current) {
      const wasCounted = current.isActive !== false && current.storeType !== "warehouse";
      const willBeActive = updateData.isActive !== undefined ? updateData.isActive !== false : current.isActive !== false;
      const willBeType = updateData.storeType !== undefined ? updateData.storeType : current.storeType;
      if (!wasCounted && willBeActive && willBeType !== "warehouse") {
        await assertStoreSlotAvailable();
      }
    }

    const store = await Store.findByIdAndUpdate(id, updateData, { 
      new: true, 
      runValidators: true 
    });
    
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }
    
    const obj = store.toObject();
    obj.id = obj._id.toString();
    
    res.status(200).json({
      message: "Store updated successfully",
      store: obj,
    });
  } catch (error) {
    if (sendLimitError(res, error)) return;
    console.error("Update store error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: "Store with this location code already exists" 
      });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete store
export const deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid store ID" });
    }
    
    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const code = (store.locCode || "").toString().trim();
    await Store.findByIdAndDelete(id);
    
    res.status(200).json({
      message: "Store deleted successfully",
      deletedLocCode: code
    });
  } catch (error) {
    console.error("Delete store error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
