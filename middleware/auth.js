const jwt = require('jsonwebtoken');

// JWT secret key - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware to verify JWT token and authenticate user
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'No token provided. Please login first.'
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid token format. Please login again.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      full_name: decoded.full_name
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid token. Please login again.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Token has expired. Please login again.'
      });
    }

    return res.status(401).json({
      error: 'Authentication Failed',
      message: 'Authentication error. Please login again.'
    });
  }
};

/**
 * Helper function to generate JWT token
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email_address || user.email,
    full_name: user.full_name
  };

  // Token expires in 7 days
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  });
};

module.exports = {
  authenticate,
  generateToken,
  JWT_SECRET
};




