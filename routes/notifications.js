const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// All notification routes require authentication
router.use(authenticate);

// GET /api/notifications - Get user notifications
router.get('/', notificationController.getUserNotifications);

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// POST /api/notifications/:id/read - Mark notification as read
router.post('/:id/read', notificationController.markAsRead);

// POST /api/notifications/read-all - Mark all notifications as read
router.post('/read-all', notificationController.markAllAsRead);

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', notificationController.deleteNotification);

// POST /api/notifications - Create notification (for admin/testing)
router.post('/', notificationController.createNotification);

module.exports = router;

