const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');

const JWT_SECRET = process.env.JWT_SECRET || 'odoocafe-pos-secret-key-change-in-production';

function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch {
    return next(new UnauthorizedError('UNAUTHORIZED', 'Token is invalid or expired.'));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new (require('../utils/errors').ForbiddenError)());
    }
    next();
  };
}

module.exports = { authenticate, requireRole, JWT_SECRET };
