import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getHotspots } from '../controllers/mapController.js';

const router = Router();
router.get('/hotspots', asyncHandler(getHotspots));
export default router;
