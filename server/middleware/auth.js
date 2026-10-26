import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'This account is unavailable.' } });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Your session is invalid or has expired.' } });
    }
    return next(error);
  }
}

export function optionalAuthentication(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next();

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    User.findById(payload.sub).then((user) => {
      req.user = user?.isActive ? user : null;
      next();
    }).catch(next);
  } catch {
    next();
  }
}
