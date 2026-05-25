const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  });
};

const requireDatabase = (req, res, next) => {
  if (!req.app.locals.db) {
    return res.status(503).json({ error: 'Database not available. Please set up MySQL database first.' });
  }
  next();
};

module.exports = { authenticateToken, requireDatabase };