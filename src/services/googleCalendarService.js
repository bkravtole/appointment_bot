const { google } = require('googleapis');

/**
 * Google Calendar Service
 * Handles all Google Calendar API operations including:
 * - Querying busy times
 * - Calculating available slots
 * - Creating/updating/deleting events
 */

class GoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.initializeCalendar();
  }

  /**
   * Convert 24-hour time to 12-hour format with AM/PM
   * @param {string} time - Time in HH:MM format (24-hour)
   * @returns {string} Time in 12-hour format with AM/PM
   */
  convertTo12HourFormat(time) {
    const [hour, minute] = time.split(':');
    let hours = parseInt(hour, 10);
    const minutes = minute;
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12

    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }

  /**
   * Initialize Google Calendar API with Service Account credentials
   */
  initializeCalendar() {
    try {
      const privateKey = process.env.GOOGLE_PRIVATE_KEY
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : null;

      const auth = new google.auth.GoogleAuth({
        projectId: process.env.GOOGLE_PROJECT_ID,
        credentials: {
          type: 'service_account',
          project_id: process.env.GOOGLE_PROJECT_ID,
          private_key_id: 'key-id',
          private_key: privateKey,
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          client_id: 'client-id',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        },
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      this.calendar = google.calendar({ version: 'v3', auth });
    } catch (error) {
      console.error('Failed to initialize Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Get busy times for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of busy time periods
   */
  async getBusyTimes(date) {
    try {
      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59`);

      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeZone: 'UTC',
          items: [{ id: process.env.GOOGLE_CALENDAR_ID }],
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
        },
      });

      const busyPeriods = response.data.calendars[process.env.GOOGLE_CALENDAR_ID].busy || [];
      return busyPeriods;
    } catch (error) {
      console.error('Error fetching busy times:', error);
      throw error;
    }
  }

  /**
   * Calculate available 30-minute slots for a given date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of available time slots
   */
  async getAvailableSlots(date) {
    try {
      const SLOT_DURATION = parseInt(process.env.APPOINTMENT_SLOT_DURATION) || 30; // minutes
      const OFFICE_START = parseInt(process.env.OFFICE_HOURS_START) || 10; // 10 AM
      const OFFICE_END = parseInt(process.env.OFFICE_HOURS_END) || 18; // 6 PM

      // Fetch busy periods from Google Calendar
      const busyPeriods = await this.getBusyTimes(date);

      // Generate all possible slots
      const allSlots = [];
      for (let hour = OFFICE_START; hour < OFFICE_END; hour++) {
        for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
          const slotTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          const startDateTime = new Date(`${date}T${slotTime}:00`);
          const endDateTime = new Date(startDateTime.getTime() + SLOT_DURATION * 60000);

          allSlots.push({
            startTime: slotTime,
            startDateTime,
            endDateTime,
            isAvailable: true,
          });
        }
      }

      // Filter out slots that overlap with busy periods
      const availableSlots = allSlots.filter((slot) => {
        return !busyPeriods.some((busyPeriod) => {
          const busyStart = new Date(busyPeriod.start);
          const busyEnd = new Date(busyPeriod.end);

          // Check if slot overlaps with busy period
          return slot.startDateTime < busyEnd && slot.endDateTime > busyStart;
        });
      });

      // Format for 11za response (time display in 12-hour format with AM/PM)
      // Limit response to first 10 slots
      return availableSlots.slice(0, 10).map((slot) => ({
        time: this.convertTo12HourFormat(slot.startTime),
        startDateTime: slot.startDateTime.toISOString(),
        endDateTime: slot.endDateTime.toISOString(),
      }));
    } catch (error) {
      console.error('Error calculating available slots:', error);
      throw error;
    }
  }

  /**
   * Create an event in Google Calendar
   * @param {string} phoneNumber - User's phone number
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} time - Time in HH:MM format
   * @param {string} userName - User's name (optional)
   * @returns {Promise<Object>} Created event object
   */
  async createAppointment(phoneNumber, date, time, userName = 'Patient') {
    try {
      const [hour, minute] = time.split(':');
      const startDateTime = new Date(`${date}T${hour}:${minute}:00`);
      const SLOT_DURATION = parseInt(process.env.APPOINTMENT_SLOT_DURATION) || 30;
      const endDateTime = new Date(startDateTime.getTime() + SLOT_DURATION * 60000);

      const event = {
        summary: `Appointment - ${userName}`,
        description: `Phone: ${phoneNumber}\nBooked via WhatsApp`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: [
          {
            email: process.env.GOOGLE_CLIENT_EMAIL,
          },
        ],
      };

      const response = await this.calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        requestBody: event,
      });

      return {
        eventId: response.data.id,
        title: response.data.summary,
        startTime: response.data.start.dateTime,
        endTime: response.data.end.dateTime,
      };
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  /**
   * Find an event by phone number in description
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object|null>} Event object or null if not found
   */
  async findEventByPhoneNumber(phoneNumber) {
    try {
      const response = await this.calendar.events.list({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        q: phoneNumber,
        maxResults: 10,
        showDeleted: false,
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items.find((event) =>
          event.description && event.description.includes(phoneNumber)
        );
      }

      return null;
    } catch (error) {
      console.error('Error finding event:', error);
      throw error;
    }
  }

  /**
   * Delete an event from Google Calendar
   * @param {string} eventId - Event ID to delete
   * @returns {Promise<void>}
   */
  async deleteAppointment(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        eventId,
      });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  }

  /**
   * Get all appointments from the last 2 hours
   * @returns {Promise<Array>} Array of recent appointments
   */
  async getRecentAppointments() {
    try {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const response = await this.calendar.events.list({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        timeMin: twoHoursAgo.toISOString(),
        timeMax: now.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.data.items || []).map((event) => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const timeInHours = startTime.getHours().toString().padStart(2, '0');
        const timeInMinutes = startTime.getMinutes().toString().padStart(2, '0');
        const formattedTime = this.convertTo12HourFormat(`${timeInHours}:${timeInMinutes}`);

        return {
          id: event.id,
          summary: event.summary,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          formattedTime, // 12-hour format with AM/PM
          description: event.description,
        };
      });
    } catch (error) {
      console.error('Error fetching recent appointments:', error);
      throw error;
    }
  }

  /**
   * Update an existing event
   * @param {string} eventId - Event ID to update
   * @param {string} date - New date in YYYY-MM-DD format
   * @param {string} time - New time in HH:MM format
   * @returns {Promise<Object>} Updated event object
   */
  async updateAppointment(eventId, date, time) {
    try {
      const [hour, minute] = time.split(':');
      const startDateTime = new Date(`${date}T${hour}:${minute}:00`);
      const SLOT_DURATION = parseInt(process.env.APPOINTMENT_SLOT_DURATION) || 30;
      const endDateTime = new Date(startDateTime.getTime() + SLOT_DURATION * 60000);

      const response = await this.calendar.events.update({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        eventId,
        requestBody: {
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'UTC',
          },
        },
      });

      return {
        eventId: response.data.id,
        title: response.data.summary,
        startTime: response.data.start.dateTime,
        endTime: response.data.end.dateTime,
      };
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }
}

module.exports = new GoogleCalendarService();
