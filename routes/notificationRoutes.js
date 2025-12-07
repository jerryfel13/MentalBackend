// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications - Get notifications for current user (protected)
router.get('/', authenticate, notificationController.getUserNotifications);

// PATCH /api/notifications/:id/read - Mark a notification as read
router.patch('/:id/read', authenticate, notificationController.markAsRead);

// POST /api/notifications - Create a notification (admin or system use)
router.post('/', notificationController.createNotification);

module.exports = router;
