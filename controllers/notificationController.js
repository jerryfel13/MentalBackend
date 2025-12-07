const { supabase } = require('../config/supabase');
const notificationService = require('../services/notificationService');

const notificationController = {
  // Get user notifications
  getUserNotifications: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { is_read, type, limit } = req.query;

      const filters = {};
      if (is_read !== undefined) filters.is_read = is_read === 'true';
      if (type) filters.type = type;
      if (limit) filters.limit = parseInt(limit);

      const notifications = await notificationService.getUserNotifications(userId, filters);

      res.json({
        message: 'Notifications retrieved successfully',
        data: notifications
      });
    } catch (error) {
      next(error);
    }
  },

  // Get unread notification count
  getUnreadCount: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const count = await notificationService.getUnreadCount(userId);

      res.json({
        message: 'Unread count retrieved successfully',
        data: { count }
      });
    } catch (error) {
      next(error);
    }
  },

  // Mark notification as read
  markAsRead: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await notificationService.markAsRead(id, userId);

      res.json({
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      next(error);
    }
  },

  // Mark all notifications as read
  markAllAsRead: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const notifications = await notificationService.markAllAsRead(userId);

      res.json({
        message: 'All notifications marked as read',
        data: notifications
      });
    } catch (error) {
      next(error);
    }
  },

  // Delete notification
  deleteNotification: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await notificationService.deleteNotification(id, userId);

      res.json({
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  // Create notification (for testing/admin use)
  createNotification: async (req, res, next) => {
    try {
      const {
        user_id,
        appointment_id,
        type,
        title,
        message,
        metadata
      } = req.body;

      // Only allow if user is creating for themselves or is admin
      const targetUserId = user_id || req.user.id;
      if (targetUserId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Unauthorized',
          message: 'You can only create notifications for yourself'
        });
      }

      const notification = await notificationService.createNotification({
        user_id: targetUserId,
        appointment_id,
        type,
        title,
        message,
        metadata
      });

      res.status(201).json({
        message: 'Notification created successfully',
        data: notification
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = notificationController;

