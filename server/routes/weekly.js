import { Router } from 'express';
import { generateWeekly, latestWeekly } from '../controllers/weeklyController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireOfficer } from '../middleware/role.js';

const router = Router();
router.get('/latest', authenticate, asyncHandler(latestWeekly));
router.post('/generate', authenticate, requireOfficer, asyncHandler(generateWeekly));
export default router;
