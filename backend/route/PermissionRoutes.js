import express from 'express';
import {
    getAllPermissions,
    getRolePermissions,
    updateRolePermissions
} from '../controllers/PermissionController.js';

const router = express.Router();

router.get('/', getAllPermissions);
router.get('/:role', getRolePermissions);
router.put('/:role', updateRolePermissions);

export default router;
