import { Router } from 'express';
import { param } from 'express-validator';
import { getMemory } from '../controllers/memoryController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.get('/:cellId', authenticate, [param('cellId').matches(/^-?\d+:-?\d+$/)], validateRequest, asyncHandler(getMemory));
export default router;
