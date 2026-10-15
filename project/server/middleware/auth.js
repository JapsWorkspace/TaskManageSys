const User = require('../models/authModel');
const { verifyAuthToken } = require('../utils/token');

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });
    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.id).select('-password');
    if (!user || user.isArchived) return res.status(401).json({ message: 'Account unavailable.' });
    if ((payload.tokenVersion || 0) !== (user.tokenVersion || 0)) return res.status(401).json({ message: 'Invalid or expired token.' });
    req.user = user;
    next();
  } catch (_) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Permission denied.' });
  next();
};

module.exports = { protect, allow };
