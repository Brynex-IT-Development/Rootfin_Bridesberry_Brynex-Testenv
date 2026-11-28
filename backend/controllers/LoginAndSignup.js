import bcrypt from 'bcrypt';
import User from '../model/UserModel.js';
import Store from '../model/Store.js';
import { createClosureAuthToken } from '../utils/closureAuth.js';
import { isAllowedStore } from './StoreController.js';
import { assertCanAddStore, assertCanAddUser, sendLimitError } from '../utils/subscription.js';

export const SignUp = async (req, res) => {
    try {
        const { username, email, password, locCode, address, phone, gst, role, allowedLocCodes, storeName } = req.body;

        if (!password) {
            return res.status(400).json({ message: "Password is required." });
        }

        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const isStoreAdmin = (role === 'store_admin' || role === 'store_manager' || role === 'store admin');
        const isWarehouseAdmin = (role === 'warehouse_admin' || role === 'warehouseadmin' || role === 'warehouse admin');
        const isCluster = (role === 'cluster_manager' || role === 'cluster_admin' || role === 'cluster admin');

        const finalUsername = (storeName && storeName.trim()) || (username && username.trim()) || normalizedEmail.split('@')[0];

        const existingUser = await User.findOne({ $or: [{ username: finalUsername }, { email: normalizedEmail }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists.' });
        }

        // Subscription limits: one more user, and possibly one more store
        await assertCanAddUser();
        if ((isStoreAdmin || isWarehouseAdmin) && locCode && locCode.trim()) {
            await assertCanAddStore(locCode.trim(), { storeType: isWarehouseAdmin ? 'warehouse' : 'branch' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let assignedLocCode = '';
        let assignedStoreName = null;
        if (isStoreAdmin) {
            assignedLocCode = locCode ? locCode.trim() : '';
            assignedStoreName = storeName || finalUsername;
        } else if (isWarehouseAdmin) {
            assignedLocCode = (locCode && locCode.trim()) ? locCode.trim() : '';
            assignedStoreName = (storeName && storeName.trim()) ? storeName.trim() : finalUsername;
        }

        // Stores come only from what is entered here — no built-in location codes.
        if ((isStoreAdmin || isWarehouseAdmin) && !assignedLocCode) {
            return res.status(400).json({ message: 'Location code is required for store and warehouse admins.' });
        }

        const newUser = new User({
            username: finalUsername,
            email: normalizedEmail,
            password: hashedPassword,
            locCode: assignedLocCode,
            address: (isStoreAdmin || isWarehouseAdmin) ? (address || '') : '',
            phone: phone || '',
            gst: (isStoreAdmin || isWarehouseAdmin) ? (gst || '') : '',
            role: role || 'normal_user',
            storeName: assignedStoreName,
            allowedLocCodes: isCluster ? (allowedLocCodes || []) : [],
        });

        await newUser.save();

        if ((isStoreAdmin || isWarehouseAdmin) && assignedLocCode) {
            await Store.findOneAndUpdate(
                { locCode: assignedLocCode },
                { 
                    name: assignedStoreName || finalUsername, 
                    locCode: assignedLocCode, 
                    address: address || '', 
                    phone: phone || '', 
                    email: normalizedEmail,
                    gst: gst || '',
                    isActive: true,
                    storeType: isWarehouseAdmin ? 'warehouse' : 'branch',
                    manager: finalUsername
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).catch(err => console.warn("Could not upsert Store on SignUp:", err.message));
        }

        res.status(201).json({
            message: 'User created successfully.',
            user: newUser,
        });
    } catch (error) {
        if (sendLimitError(res, error)) return;
        console.error('Error:', error);
        res.status(500).json({
            message: 'An error occurred while creating the user.',
            error: error.message,
        });
    }
};







export const Login = async (req, res) => {
    try {
        const { email, password, EmpId } = req.body;
        const userPassword = password || EmpId;

        if (!email || !userPassword) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Check if user exists (case-insensitive email search or username)
        const user = await User.findOne({
            $or: [
                { email: cleanEmail },
                { email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
                { username: cleanEmail }
            ]
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(userPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const isSuper = (user.role || '').toLowerCase() === 'super_admin' || (user.role || '').toLowerCase() === 'superadmin';

        res.status(200).json({
            message: 'Login successful',
            closureAuthToken: createClosureAuthToken(user),

            user: {
                email: user.email,
                username: isSuper ? "Brynex Admin" : user.username,
                role: user.role || 'normal_user',
                locCode: isSuper ? '' : (user.locCode || ''),
                storeName: isSuper ? null : (user.storeName || null),
                storeId: isSuper ? null : user.storeId,
                allowedLocCodes: isSuper ? [] : (user.allowedLocCodes || []),
            },
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({
            message: 'An error occurred during login.',
            error: error.message,
        });
    }
};

export const GetAllStores = async (req, res) => {
    try {
        // Clear super admin store associations
        await User.updateMany(
            { role: { $in: ['super_admin', 'superadmin'] } },
            { $set: { locCode: '', storeName: null, storeId: null } }
        ).catch(() => {});

        // Make sure every warehouse admin's own location has a warehouse-type Store document
        const warehouseAdmins = await User.find({
            role: { $in: ['warehouse_admin', 'warehouseadmin', 'warehouse admin'] },
            locCode: { $exists: true, $ne: '' }
        }).lean();
        for (const w of warehouseAdmins) {
            await Store.findOneAndUpdate(
                { locCode: w.locCode.toString().trim() },
                {
                    $set: { storeType: 'warehouse', isActive: true },
                    $setOnInsert: {
                        name: w.storeName || w.username,
                        address: w.address || '',
                        phone: w.phone || '',
                        email: w.email || '',
                        gst: w.gst || '',
                        manager: w.username || ''
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).catch(() => {});
        }

        // ONLY fetch stores for existing store admins & warehouse admins
        const storeAdmins = await User.find({
            role: { $in: ['store_admin', 'store_manager', 'store admin', 'warehouse_admin', 'warehouseadmin', 'warehouse admin'] },
            locCode: { $exists: true, $ne: '' }
        }, { password: 0 }).lean();

        const validLocCodes = storeAdmins.map(u => (u.locCode || "").toString().trim()).filter(Boolean);

        // Clean up orphaned stores from Store collection
        try {
            if (validLocCodes.length > 0) {
                await Store.deleteMany({ locCode: { $nin: validLocCodes } });
            } else {
                await Store.deleteMany({});
            }
        } catch (e) {}

        if (validLocCodes.length === 0) {
            return res.status(200).json({
                message: 'Stores retrieved successfully',
                stores: [],
            });
        }

        const stores = await Store.find({
            locCode: { $in: validLocCodes },
            isActive: { $ne: false }
        }).lean();

        const storeMap = new Map();
        for (const u of storeAdmins) {
            const code = (u.locCode || "").toString().trim();
            const isWarehouse = ['warehouse_admin', 'warehouseadmin', 'warehouse admin'].includes((u.role || '').toLowerCase().trim());
            if (code) {
                const storeDoc = stores.find(s => (s.locCode || "").toString().trim() === code);
                const defaultName = u.storeName || u.username || code;
                storeMap.set(code, {
                    locName: storeDoc?.name || storeDoc?.locName || defaultName,
                    locCode: code,
                    storeType: storeDoc?.storeType || (isWarehouse ? 'warehouse' : 'branch'),
                    address: storeDoc?.address || u.address || "",
                    phone: storeDoc?.phone || u.phone || "",
                    email: storeDoc?.email || u.email || "",
                    gst: storeDoc?.gst || u.gst || ""
                });
            }
        }

        const storeList = Array.from(storeMap.values())
            .filter(isAllowedStore)
            .sort((a, b) => a.locName.localeCompare(b.locName));

        res.status(200).json({
            message: 'Stores retrieved successfully',
            stores: storeList,
        });
    } catch (error) {
        console.error('GetAllStores Error:', error);
        res.status(500).json({
            message: 'An error occurred while fetching stores.',
            error: error.message,
        });
    }
};

export const GetAllUsers = async (req, res) => {
    try {
        // Clear super admin store associations
        await User.updateMany(
            { role: { $in: ['super_admin', 'superadmin'] } },
            { $set: { locCode: '', storeName: null, storeId: null } }
        ).catch(() => {});

        const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 }).lean();
        
        const sanitizedUsers = users.map(u => {
            const role = (u.role || '').toLowerCase();
            const isSuper = role === 'super_admin' || role === 'superadmin';
            if (isSuper) {
                return {
                    ...u,
                    locCode: '',
                    storeName: null,
                    storeId: null
                };
            }
            return u;
        });

        res.status(200).json({
            message: 'Users retrieved successfully',
            users: sanitizedUsers,
        });
    } catch (error) {
        console.error('GetAllUsers Error:', error);
        res.status(500).json({
            message: 'An error occurred while fetching users.',
            error: error.message,
        });
    }
};

export const UpdateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, locCode, address, phone, gst, password, role, allowedLocCodes, storeName } = req.body;

        // Validate input
        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        // Find user
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const lowerEmail = email.trim().toLowerCase();
        // Check if email is being changed and if it's already taken by another user
        if (lowerEmail !== user.email) {
            const existingUser = await User.findOne({ email: lowerEmail, _id: { $ne: id } });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already exists.' });
            }
        }

        const effectiveRole = role || user.role || 'normal_user';
        const isStoreAdmin = (effectiveRole === 'store_admin' || effectiveRole === 'store_manager' || effectiveRole === 'store admin');
        const isWarehouseAdmin = (effectiveRole === 'warehouse_admin' || effectiveRole === 'warehouseadmin' || effectiveRole === 'warehouse admin');
        const isCluster = (effectiveRole === 'cluster_manager' || effectiveRole === 'cluster_admin' || effectiveRole === 'cluster admin');
        const finalUsername = (storeName && storeName.trim()) || (username && username.trim()) || lowerEmail.split('@')[0];

        const oldLocCode = (user.locCode || "").toString().trim();
        let newLocCode = '';
        let assignedStoreName = null;
        if (isStoreAdmin) {
            newLocCode = locCode ? locCode.trim() : '';
            assignedStoreName = storeName || finalUsername;
        } else if (isWarehouseAdmin) {
            newLocCode = (locCode && locCode.trim()) ? locCode.trim() : oldLocCode;
            assignedStoreName = (storeName && storeName.trim()) ? storeName.trim() : (user.storeName || finalUsername);
        }

        // Update fields
        user.username = finalUsername;
        user.email = lowerEmail;
        user.phone = phone || '';
        user.role = effectiveRole;

        if (isStoreAdmin || isWarehouseAdmin) {
            user.storeName = assignedStoreName;
            user.locCode = newLocCode;
            user.address = address || '';
            user.gst = gst || '';
            user.allowedLocCodes = [];
        } else if (isCluster) {
            user.storeName = null;
            user.locCode = '';
            user.address = '';
            user.gst = '';
            user.allowedLocCodes = allowedLocCodes || [];
        } else {
            // super_admin, admin, financial_admin, normal_user
            user.storeName = null;
            user.locCode = '';
            user.address = '';
            user.gst = '';
            user.allowedLocCodes = [];
        }

        // Subscription: moving this user to a store that doesn't exist yet takes a store
        // slot — unless their old store is freed at the same time (a rename).
        if ((isStoreAdmin || isWarehouseAdmin) && newLocCode && newLocCode !== oldLocCode) {
            const othersOnOld = oldLocCode
                ? await User.countDocuments({ locCode: oldLocCode, _id: { $ne: user._id } })
                : 1;
            if (othersOnOld > 0) {
                await assertCanAddStore(newLocCode, { storeType: isWarehouseAdmin ? 'warehouse' : 'branch' });
            }
        }

        // Only update password if provided
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        await user.save();

        // If old locCode changed or removed, clean up old store if no other user has it
        if (oldLocCode && oldLocCode !== newLocCode) {
            const otherUsersWithOldLoc = await User.countDocuments({ locCode: oldLocCode });
            if (otherUsersWithOldLoc === 0) {
                await Store.deleteMany({ locCode: oldLocCode }).catch(() => {});
            }
        }

        if ((isStoreAdmin || isWarehouseAdmin) && newLocCode) {
            await Store.findOneAndUpdate(
                { locCode: newLocCode },
                { 
                    name: assignedStoreName || finalUsername, 
                    locCode: newLocCode, 
                    address: address || '', 
                    phone: phone || '', 
                    email: lowerEmail,
                    gst: gst || '',
                    isActive: true,
                    storeType: isWarehouseAdmin ? 'warehouse' : 'branch',
                    manager: finalUsername
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).catch(err => console.warn("Could not upsert Store on UpdateUser:", err.message));
        }

        res.status(200).json({
            message: 'User updated successfully.',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                storeName: user.storeName,
                locCode: user.locCode,
                address: user.address,
                phone: user.phone,
                gst: user.gst,
                allowedLocCodes: user.allowedLocCodes,
            },
        });
    } catch (error) {
        if (sendLimitError(res, error)) return;
        console.error('UpdateUser Error:', error);
        res.status(500).json({
            message: 'An error occurred while updating the user.',
            error: error.message,
        });
    }
};


export const DeleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const userLocCode = (user.locCode || "").toString().trim();
        const userEmail = (user.email || "").toString().trim().toLowerCase();

        // Delete user from User collection
        await User.findByIdAndDelete(id);

        let deletedLocCode = null;

        // If this user had an associated store locCode
        if (userLocCode) {
            // Check if any other user in the database still uses this locCode
            const remainingUsersWithLoc = await User.countDocuments({ locCode: userLocCode });
            if (remainingUsersWithLoc === 0) {
                // Delete the associated store completely from the Store collection
                await Store.deleteMany({
                    $or: [
                        { locCode: userLocCode },
                        { email: userEmail }
                    ]
                }).catch(err => console.warn("Could not delete store on DeleteUser:", err.message));
                deletedLocCode = userLocCode;
            }
        } else if (userEmail) {
            // If the user had a store created matching their email
            const remainingUsersWithEmail = await User.countDocuments({ email: userEmail });
            const isSuper = user.role === 'super_admin' || user.role === 'superadmin';
            if (remainingUsersWithEmail === 0 && !isSuper) {
                await Store.deleteMany({
                    email: userEmail
                }).catch(err => console.warn("Could not delete store by email on DeleteUser:", err.message));
            }
        }

        res.status(200).json({ 
            message: 'User and associated store deleted successfully.',
            deletedLocCode
        });
    } catch (error) {
        console.error('DeleteUser Error:', error);
        res.status(500).json({ message: 'An error occurred while deleting the user.', error: error.message });
    }
};

export const ResetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        // Validate input
        if (!email || !newPassword) {
            return res.status(400).json({ message: 'Email and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({
            message: 'Password reset successfully.',
            user: {
                email: user.email,
                username: user.username,
            },
        });
    } catch (error) {
        console.error('ResetPassword Error:', error);
        res.status(500).json({
            message: 'An error occurred while resetting the password.',
            error: error.message,
        });
    }
};
