import mongoose from 'mongoose';

const rolePermissionSchema = new mongoose.Schema({
    role: { 
        type: String, 
        required: true, 
        unique: true,
        enum: ["super_admin", "admin", "financial_admin", "cluster_admin", "store_admin", "normal_user"]
    },
    permissions: {
        type: Object,
        default: {}
    },
    updatedBy: { type: String, default: 'system' },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);
export default RolePermission;
