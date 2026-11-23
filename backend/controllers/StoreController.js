import Store from "../model/Store.js";
import User from "../model/UserModel.js";
import mongoose from "mongoose";

// Fallback stores (empty - only stores with existing store admin are shown)
export const fallbackStores = [];

// Decommissioned old branch locCodes that must remain excluded
export const DISCARDED_LOC_CODES = new Set([
  "700", "701", "702", "703", "704", "705", "706", "707", "708", "709",
  "710", "711", "712", "716", "717", "718", "759", "100", "101", "102", "122",
  "133", "144", "555", "031", "222", "800", "15623"
]);

export const DISCARDED_NAME_PATTERNS = [
  "g-edappally", "g.edappally", "edappally",
  "g-palakkad", "g.palakkad", "palakkad",
  "g-calicut", "g.calicut", "calicut",
  "sg-trivandrum", "trivandrum",
  "g-kottayam", "g.kottayam", "kottayam",
  "g-perumbavoor", "g.perumbavoor", "perumbavoor",
  "g-thrissur", "g.thrissur", "thrissur",
  "g-chavakkad", "g.chavakkad", "chavakkad",
  "g-vadakara", "g.vadakara", "vadakara",
  "g-edappal", "g.edappal", "edappal",
  "g-perinthalmanna", "g.perinthalmanna", "perinthalmanna",
  "g-kottakkal", "g.kottakkal", "kottakkal",
  "g-manjeri", "g.manjeri", "manjeri",
  "g-kalpetta", "g.kalpetta", "kalpetta",
  "g-kannur", "g.kannur", "kannur",
  "production", "office", "head office", "dappr squad",
  "z-edapally", "z-edappal", "z-perinthalmanna", "z-kottakkal",
  "suitorguy mg road", "mg road", "mgroad",
  "test store tranfer"
];

export const isAllowedStore = (store) => {
  if (!store) return false;
  if (store.isActive === false) return false;
  const code = (store.locCode || "").toString().trim();
  const name = (store.name || store.locName || "").toLowerCase().trim();
  if (DISCARDED_LOC_CODES.has(code)) return false;
  if (DISCARDED_NAME_PATTERNS.some(p => name.includes(p))) return false;
  return Boolean(code);
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

    // Look up only active Store Admin or Warehouse Admin users
    const storeAdmins = await User.find({
      role: { $in: ["store_admin", "store_manager", "store admin", "warehouse_admin"] },
      locCode: { $exists: true, $ne: "" }
    }).select("username storeName locCode email address phone gst").lean();

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
      if (code) {
        const s = dbStores.find(doc => (doc.locCode || "").toString().trim() === code);
        combinedMap.set(code, {
          id: (s?._id || s?.id || u._id || code).toString(),
          name: s?.name || u.storeName || u.username || code,
          locCode: code,
          locName: s?.name || u.storeName || u.username || code,
          address: s?.address || u.address || "",
          phone: s?.phone || u.phone || "",
          email: s?.email || u.email || "",
          gst: s?.gst || u.gst || "",
          isActive: true
        });
      }
    }

    // Filter out decommissioned branches and sort
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
