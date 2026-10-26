import { Router } from 'express';
import { body } from 'express-validator';
import { login, me, register } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.post('/register', authRateLimit, [body('name').isString().trim().isLength({ min: 2, max: 80 }), body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 8, max: 128 })], validateRequest, asyncHandler(register));
router.post('/login', authRateLimit, [body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 1, max: 128 })], validateRequest, asyncHandler(login));
router.get('/me', authenticate, asyncHandler(me));
export default router;
