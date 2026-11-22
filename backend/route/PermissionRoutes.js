import express from 'express';
import {
    GetAllRolePermissions,
    GetRolePermissions,
    UpdateRolePermissions,
    ResetRolePermissions
} from '../controllers/PermissionController.js';

const router = express.Router();

router.get('/', GetAllRolePermissions);
router.get('/:role', GetRolePermissions);
router.put('/:role', UpdateRolePermissions);
router.post('/reset/:role', ResetRolePermissions);

export default router;
