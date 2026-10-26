export function requireRole(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this action.' } });
    }
    return next();
  };
}

export const requireOfficer = requireRole('officer');
