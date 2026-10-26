import { Router } from 'express';
import { body } from 'express-validator';
import { createRepair } from '../controllers/officerController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireOfficer } from '../middleware/role.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.post('/', authenticate, requireOfficer, [body('contractor').isString().trim().isLength({ min: 2, max: 120 }), body('reportId').optional().isMongoId(), body('cellId').optional().isString().isLength({ min: 3, max: 80 })], validateRequest, asyncHandler(createRepair));
export default router;
