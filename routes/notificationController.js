// controllers/notificationController.js
const pool = require('../db'); // assuming you use pg Pool for PostgreSQL

// Get notifications for authenticated user
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *',
      [notificationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new notification
exports.createNotification = async (req, res) => {
  try {
    const { user_id, appointment_id, message, type } = req.body;
    const result = await pool.query(
      `INSERT INTO notifications (user_id, appointment_id, message, type) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, appointment_id || null, message, type || 'info']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
