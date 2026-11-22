import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    locCode: { type: String, required: false, default: '' },
    power: { type: String, default: null }, // Legacy field deprecated; all access is role and permission based
    password: { type: String, required: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    gst: { type: String, default: '' },
    role: { 
        type: String, 
        enum: [
            "super_admin", "superadmin", "super admin",
            "admin", 
            "warehouse_admin", "warehouse admin", "warehouseadmin",
            "financial_admin", "financial_head", "financial admin",
            "cluster_admin", "cluster_manager", "cluster admin",
            "store_admin", "store_manager", "store admin",
            "normal_user", "store_user", "normal user"
        ], 
        default: "normal_user" 
    },
    storeName: { type: String, default: null },
    storeId: { type: String, default: null },
    allowedLocCodes: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

userSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const User = mongoose.model('User', userSchema);
export default User;
