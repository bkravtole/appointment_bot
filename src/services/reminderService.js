const cron = require('node-cron');
const elevenLabsSendService = require('./elevenLabsSendService');
const databaseService = require('./supabaseService');

/**
 * Reminder Service
 * Handles scheduling and sending appointment reminders via WhatsApp
 */

class ReminderService {
  constructor() {
    this.reminders = new Map(); // Store scheduled reminders: key = `${phoneNumber}-${eventId}`, value = task
  }

  /**
   * Schedule a reminder for 1 hour before appointment
   * @param {string} phoneNumber - User's phone number
   * @param {string} eventId - Google Calendar event ID
   * @param {string} appointmentTime - ISO appointment time (e.g., 2026-03-27T13:00:00)
   * @param {string} userName - User's name
   * @returns {Promise<Object>} Scheduling result
   */
  async scheduleReminder(phoneNumber, eventId, appointmentTime, userName = 'Patient') {
    try {
      const appointmentDate = new Date(appointmentTime);
      const reminderTime = new Date(appointmentDate.getTime() - 60 * 60 * 1000); // 1 hour before

      // Validate reminder time is in the future
      const now = new Date();
      if (reminderTime < now) {
        console.log(`⏭️ Reminder time already passed for ${phoneNumber}. Skipping.`);
        return {
          success: false,
          error: 'Appointment is too soon to schedule a reminder.',
        };
      }

      // Format times for display
      const appointmentTimeStr = appointmentDate.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      });

      // Define cron expression for the reminder time
      const minutes = reminderTime.getMinutes();
      const hours = reminderTime.getHours();
      const day = reminderTime.getDate();
      const month = reminderTime.getMonth() + 1;

      // Cron format: minute hour day month dayOfWeek
      const cronExpression = `${minutes} ${hours} ${day} ${month} *`;

      console.log(`📅 Scheduling reminder for ${phoneNumber}`);
      console.log(`   Appointment: ${appointmentTimeStr}`);
      console.log(`   Reminder at: ${reminderTime.toLocaleString()}`);
      console.log(`   Cron: ${cronExpression}`);

      // Create cron task
      const task = cron.schedule(cronExpression, async () => {
        await this.sendReminderMessage(phoneNumber, userName, appointmentTimeStr, eventId);
      });

      // Store reminder task for cancellation if needed
      const reminderId = `${phoneNumber}-${eventId}`;
      this.reminders.set(reminderId, {
        task,
        phoneNumber,
        eventId,
        appointmentTime,
        reminderTime,
      });

      console.log(`✅ Reminder scheduled for ${phoneNumber} (${reminderId})`);

      return {
        success: true,
        reminderId,
        phoneNumber,
        reminderTime: reminderTime.toISOString(),
        appointmentTime: appointmentTimeStr,
      };
    } catch (error) {
      console.error('Error scheduling reminder:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send reminder message via WhatsApp
   * @private
   */
  async sendReminderMessage(phoneNumber, userName, appointmentTimeStr, eventId) {
    try {
      console.log(`🔔 Sending reminder to ${phoneNumber}`);

      const reminderMessage = `Hello ${userName}! 👋\n\nThis is a friendly reminder about your doctor appointment:\n\n📅 Time: ${appointmentTimeStr}\n\nPlease arrive 5-10 minutes early. If you need to reschedule or cancel, reply with "reschedule" or "cancel".\n\nThank you!`;

      const result = await elevenLabsSendService.sendTextMessage(phoneNumber, reminderMessage);

      if (result.success) {
        console.log(`✅ Reminder sent successfully to ${phoneNumber}`);
      } else {
        console.error(`❌ Failed to send reminder to ${phoneNumber}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error('Error sending reminder message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel a scheduled reminder
   * @param {string} phoneNumber - User's phone number
   * @param {string} eventId - Google Calendar event ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelReminder(phoneNumber, eventId) {
    try {
      const reminderId = `${phoneNumber}-${eventId}`;
      const reminder = this.reminders.get(reminderId);

      if (!reminder) {
        console.log(`⚠️ Reminder not found for ${reminderId}`);
        return {
          success: false,
          error: 'Reminder not found.',
        };
      }

      // Stop the cron task
      reminder.task.stop();
      this.reminders.delete(reminderId);

      console.log(`✅ Reminder cancelled for ${reminderId}`);

      return {
        success: true,
        message: 'Reminder cancelled successfully.',
      };
    } catch (error) {
      console.error('Error cancelling reminder:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all active reminders
   * @returns {Array} List of active reminders
   */
  getActiveReminders() {
    return Array.from(this.reminders.values()).map((reminder) => ({
      reminderId: `${reminder.phoneNumber}-${reminder.eventId}`,
      phoneNumber: reminder.phoneNumber,
      eventId: reminder.eventId,
      appointmentTime: reminder.appointmentTime,
      reminderTime: reminder.reminderTime,
    }));
  }

  /**
   * Get reminder status
   * @param {string} phoneNumber - User's phone number
   * @param {string} eventId - Google Calendar event ID
   * @returns {Object} Reminder status
   */
  getReminderStatus(phoneNumber, eventId) {
    const reminderId = `${phoneNumber}-${eventId}`;
    const reminder = this.reminders.get(reminderId);

    if (!reminder) {
      return {
        scheduled: false,
        message: 'No reminder scheduled.',
      };
    }

    return {
      scheduled: true,
      reminderId,
      phoneNumber,
      eventId,
      appointmentTime: reminder.appointmentTime,
      reminderTime: reminder.reminderTime,
    };
  }
}

module.exports = new ReminderService();
