const express = require('express');
const router = express.Router();

// Import route modules
const exampleRoutes = require('./example');
const userRoutes = require('./users');
const doctorRoutes = require('./doctors');

// Mount routes
router.use('/example', exampleRoutes);
router.use('/users', userRoutes);
router.use('/doctors', doctorRoutes);

// API info route
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      example: '/api/example',
      users: '/api/users',
      doctors: '/api/doctors'
    }
  });
});

module.exports = router;

