const googleCalendarService = require('../services/googleCalendarService');
const databaseService = require('../services/supabaseService');

/**
 * Appointment Controller
 * Handles all appointment-related business logic
 * Returns JSON data for 11za chatbot to use in flows
 */

class AppointmentController {
  /**
   * Get available slots for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} Available slots data
   */
  async getAvailableSlots(date) {
    try {
      const slots = await googleCalendarService.getAvailableSlots(date);

      return {
        success: true,
        date,
        slots: slots.map((slot) => ({
          id: slot.id, // Unique ID for 11za button actions
          time: slot.time12,
          time24 : slot.time24, // Now in 12-hour format with AM/PM
          date: date,
         
        })),
      };
    } catch (error) {
      console.error('Error getting available slots:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Confirm and create an appointment
   * @param {string} phoneNumber - User's phone number
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} time - Time in HH:MM format
   * @param {string} userName - User's name
   * @returns {Promise<Object>} Booking confirmation
   */
  async confirmBooking(phoneNumber, date, time, userName = 'Patient') {
    console.log(`Confirming booking for ${phoneNumber} on ${date} at ${time} for ${userName}`);
    try {
      // Create event in Google Calendar
      const event = await googleCalendarService.createAppointment(
        phoneNumber,
        date,
        time,
        userName
      );
console.log('Google Calendar event created:', event);
      // Save to database
      await databaseService.saveAppointment(
        phoneNumber,
        event.eventId,
        userName,
        event.startTime
      );

      return {
        success: true,
        appointment: {
          eventId: event.eventId,
          patientName: userName,
          date: date,
          time: time,
          message: `Appointment confirmed for ${date} at ${time}`,
        },
      };
    } catch (error) {
      console.error('Error confirming booking:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle reschedule request
   * @param {string} phoneNumber - User's phone number
   * @param {string} date - New date in YYYY-MM-DD format
   * @param {string} time - New time in HH:MM format
   * @returns {Promise<Object>} Reschedule result
   */
  async rescheduleAppointment(phoneNumber, date, time) {
    try {
      // Find existing appointment
      const appointment = await databaseService.getAppointmentByPhone(phoneNumber);

      if (!appointment) {
        return {
          success: false,
          error: 'No existing appointment found for this phone number',
        };
      }

      // Update the appointment
      const updatedEvent = await googleCalendarService.updateAppointment(
        appointment.event_id,
        date,
        time
      );

      // Update database
      await databaseService.saveAppointment(
        phoneNumber,
        appointment.event_id,
        appointment.user_name,
        updatedEvent.startTime
      );

      return {
        success: true,
        appointment: {
          eventId: updatedEvent.eventId,
          newDate: date,
          newTime: time,
          message: `Appointment rescheduled to ${date} at ${time}`,
        },
      };
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get doctor report for all appointments from database
   * @returns {Promise<Object>} Report data
   */
  async getDoctorReport() {
    try {
      // Fetch from database instead of Google Calendar
      const allAppointments = await databaseService.getAllAppointments();

      return {
        success: true,
        totalAppointments: allAppointments.length,
        appointments: allAppointments.map((apt) => ({
          patientName: apt.user_name,
          phoneNumber: apt.phone_number,
          date: apt.appointment_time.split('T')[0], // Extract date from ISO string
          time: apt.appointment_time.split('T')[1].substring(0, 5), // Extract HH:MM
          status: apt.status,
        })),
      };
    } catch (error) {
      console.error('Error getting doctor report:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel an appointment
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelAppointment(phoneNumber) {
    try {
      const appointment = await databaseService.getAppointmentByPhone(phoneNumber);

      if (!appointment) {
        return {
          success: false,
          error: 'No existing appointment found for this phone number',
        };
      }

      // Delete from Google Calendar
      await googleCalendarService.deleteAppointment(appointment.event_id);

      // Delete from database
      await databaseService.deleteAppointment(phoneNumber);

      return {
        success: true,
        message: 'Appointment cancelled successfully',
      };
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get appointment details by phone number
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object>} Appointment details
   */
  async getAppointmentDetails(phoneNumber) {
    try {
      const appointment = await databaseService.getAppointmentByPhone(phoneNumber);

      if (!appointment) {
        return {
          success: false,
          error: 'No appointment found for this phone number',
        };
      }

      return {
        success: true,
        appointment: {
          phoneNumber: appointment.phone_number,
          userName: appointment.user_name,
          appointmentTime: appointment.appointment_time,
          eventId: appointment.event_id,
          status: appointment.status,
        },
      };
    } catch (error) {
      console.error('Error fetching appointment:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new AppointmentController();
