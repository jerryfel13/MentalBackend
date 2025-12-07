const { supabase } = require('../config/supabase');

/**
 * Notification Service
 * Handles creating and managing notifications
 */

class NotificationService {
  /**
   * Create a notification
   */
  async createNotification(notificationData) {
    const {
      user_id,
      appointment_id,
      type = 'info',
      title,
      message,
      metadata = {}
    } = notificationData;

    const notification = {
      user_id,
      appointment_id: appointment_id || null,
      type,
      title,
      message,
      is_read: false,
      metadata
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert([notification])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return data;
  }

  /**
   * Notify patient when doctor accepts appointment
   */
  async notifyAppointmentAccepted(appointmentId, doctorName) {
    try {
      // Get appointment details
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('*, user:users!appointments_user_id_fkey(id, full_name, email_address)')
        .eq('id', appointmentId)
        .single();

      if (appointmentError || !appointment) {
        console.error('Error fetching appointment for notification:', appointmentError);
        return;
      }

      const patientId = appointment.user_id;
      const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString();
      const appointmentTime = appointment.appointment_time;

      // Create notification
      await this.createNotification({
        user_id: patientId,
        appointment_id: appointmentId,
        type: 'appointment_accepted',
        title: 'Appointment Accepted',
        message: `Dr. ${doctorName} has accepted your appointment scheduled for ${appointmentDate} at ${appointmentTime}.`,
        metadata: {
          appointment_id: appointmentId,
          doctor_name: doctorName,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
          appointment_type: appointment.appointment_type
        }
      });
    } catch (error) {
      console.error('Error notifying appointment acceptance:', error);
    }
  }

  /**
   * Notify patient when doctor cancels appointment
   */
  async notifyAppointmentCancelled(appointmentId, doctorName, reason) {
    try {
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('user_id')
        .eq('id', appointmentId)
        .single();

      if (appointmentError || !appointment) {
        return;
      }

      await this.createNotification({
        user_id: appointment.user_id,
        appointment_id: appointmentId,
        type: 'appointment_cancelled',
        title: 'Appointment Cancelled',
        message: `Dr. ${doctorName} has cancelled your appointment. ${reason ? `Reason: ${reason}` : ''}`,
        metadata: {
          appointment_id: appointmentId,
          doctor_name: doctorName,
          reason: reason || null
        }
      });
    } catch (error) {
      console.error('Error notifying appointment cancellation:', error);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, filters = {}) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters.is_read !== undefined) {
      query = query.eq('is_read', filters.is_read);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();

    if (error) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }

    return data;
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }

    return true;
  }
}

module.exports = new NotificationService();

