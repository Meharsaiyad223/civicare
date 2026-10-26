import { Router } from 'express';
import { body, param } from 'express-validator';
import { createReport, getReport, listReports, updateReportStatus } from '../controllers/reportsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireOfficer } from '../middleware/role.js';
import { reportRateLimit } from '../middleware/rateLimit.js';
import { uploadPhoto } from '../middleware/upload.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.use(authenticate);
router.post('/', reportRateLimit, uploadPhoto.single('photo'), [body('description').isString().trim().isLength({ min: 8, max: 2000 }), body('lat').isFloat({ min: -90, max: 90 }), body('lng').isFloat({ min: -180, max: 180 }), body('severity').optional().isInt({ min: 1, max: 5 }), body('category').optional().isIn(['pothole', 'garbage', 'water_leak', 'streetlight_damage', 'other'])], validateRequest, asyncHandler(createReport));
router.get('/', asyncHandler(listReports));
router.get('/:id', [param('id').isMongoId()], validateRequest, asyncHandler(getReport));
router.patch('/:id/status', requireOfficer, [param('id').isMongoId(), body('status').isIn(['open', 'acknowledged', 'in_progress', 'repaired', 'closed'])], validateRequest, asyncHandler(updateReportStatus));
export default router;
