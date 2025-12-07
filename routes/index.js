const express = require('express');
const router = express.Router();

// Import route modules
const exampleRoutes = require('./example');
const userRoutes = require('./users');
const doctorRoutes = require('./doctors');
const appointmentRoutes = require('./appointments');
const paymentRoutes = require('./payments');
const notificationRoutes = require('./notifications');
const settingsRoutes = require('./settings');

// Mount routes
router.use('/example', exampleRoutes);
router.use('/users', userRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingsRoutes);

// API info route
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      example: '/api/example',
      users: '/api/users',
      doctors: '/api/doctors',
      appointments: '/api/appointments',
      payments: '/api/payments',
      notifications: '/api/notifications',
      settings: '/api/settings'
    }
  });
});

module.exports = router;

