import { Router } from 'express';
import { body, param } from 'express-validator';
import { assignWorkOrder, isValidWorkOrderId, listContractors, listWorkOrders, submitWorkOrderCompletion, verifyWorkOrderCompletion } from '../controllers/workOrdersController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.use(authenticate);
router.get('/contractors', requireRole('officer'), asyncHandler(listContractors));
router.get('/', requireRole('officer', 'contractor'), asyncHandler(listWorkOrders));
router.post('/', requireRole('officer'), [body('reportId').isMongoId(), body('contractorId').isMongoId(), body('instructions').isString().trim().isLength({ min: 6, max: 1000 }), body('dueDate').optional({ values: 'falsy' }).isISO8601()], validateRequest, asyncHandler(assignWorkOrder));
router.patch('/:id/complete', requireRole('contractor'), [param('id').custom(isValidWorkOrderId), body('notes').isString().trim().isLength({ min: 6, max: 1000 })], validateRequest, asyncHandler(submitWorkOrderCompletion));
router.patch('/:id/verify', requireRole('officer'), [param('id').custom(isValidWorkOrderId)], validateRequest, asyncHandler(verifyWorkOrderCompletion));
export default router;
