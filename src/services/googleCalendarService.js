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

  async initializeCalendar() {
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
      const authClient = await auth.getClient();
      this.calendar = google.calendar({ version: 'v3', auth: authClient });
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
   * Check if a specific slot window is free in calendar
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} time - Time in HH:MM format
   * @param {string|null} excludeEventId - Event ID to ignore (for updates)
   * @returns {Promise<boolean>} True if slot has no overlap
   */
  async isSlotAvailable(date, time, excludeEventId = null) {
    try {
      const [hour, minute] = time.split(':');
      const slotStart = new Date(`${date}T${hour}:${minute}:00`);
      const SLOT_DURATION = parseInt(process.env.APPOINTMENT_SLOT_DURATION) || 30;
      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION * 60000);

      const response = await this.calendar.events.list({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        timeMin: slotStart.toISOString(),
        timeMax: slotEnd.toISOString(),
        singleEvents: true,
        showDeleted: false,
        maxResults: 20,
      });

      const overlapping = (response.data.items || []).filter((event) => {
        if (excludeEventId && event.id === excludeEventId) return false;
        if (event.status === 'cancelled') return false;

        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);
        return slotStart < eventEnd && slotEnd > eventStart;
      });

      return overlapping.length === 0;
    } catch (error) {
      console.error('Error checking slot availability:', error);
      throw error;
    }
  }

  /**
   * Validate requested time falls within configured office hours.
   * @param {string} time - Time in HH:MM format
   * @returns {boolean}
   */
  isWithinOfficeHours(time) {
    const OFFICE_START = parseInt(process.env.OFFICE_HOURS_START) || 10;
    const OFFICE_END = parseInt(process.env.OFFICE_HOURS_END) || 18;
    const SLOT_DURATION = parseInt(process.env.APPOINTMENT_SLOT_DURATION) || 30;

    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return false;

    const requestedMinutes = (hour * 60) + minute;
    const startMinutes = OFFICE_START * 60;
    const endMinutes = OFFICE_END * 60;

    // Start must be inside [office_start, office_end - slot_duration].
    return requestedMinutes >= startMinutes && (requestedMinutes + SLOT_DURATION) <= endMinutes;
  }

  /**
   * Calculate available 30-minute slots for a given date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of available time slots
   */
  async getAvailableSlots(date, maxSlots = 10) {
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

      // Filter out slots that overlap with busy periods and exclude past slots
      const today = new Date();
      const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const candidateSlots = allSlots.filter((slot) => {
        // Check if slot is in the past (only for today's date)
        if (date === todayDate && slot.startDateTime <= today) {
          return false; // Exclude past slots for today
        }

        // Check if slot overlaps with busy period
        return !busyPeriods.some((busyPeriod) => {
          const busyStart = new Date(busyPeriod.start);
          const busyEnd = new Date(busyPeriod.end);

          // Check if slot overlaps with busy period
          return slot.startDateTime < busyEnd && slot.endDateTime > busyStart;
        });
      });

      // Format for 11za response (time display in 12-hour format with AM/PM)
      // Second pass validation against live events API for stronger race/consistency safety.
      const availabilityChecks = await Promise.all(
        candidateSlots.map(async (slot) => {
          try {
            const free = await this.isSlotAvailable(date, slot.startTime);
            return free ? slot : null;
          } catch (error) {
            console.error('Slot recheck failed:', error.message);
            return null;
          }
        })
      );

      const availableSlots = availabilityChecks.filter(Boolean);

      const formattedSlots = availableSlots.map((slot, index) => ({
        id: `${date}-${slot.startTime}`, // Unique ID: date + time
        time12: this.convertTo12HourFormat(slot.startTime), // 12-hour format with AM/PM
        time24: slot.startTime, // 24-hour format (HH:MM)

      }));

      // Default behavior: return only next 10 upcoming slots
      return formattedSlots.slice(0, maxSlots);
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

  async createAppointment(phoneNumber, date, time, userName) {
    try {
      if (!this.isWithinOfficeHours(time)) {
        throw new Error(`Time slot ${time} is outside configured office hours`);
      }

      const isFree = await this.isSlotAvailable(date, time);
      if (!isFree) {
        throw new Error(`Time slot ${date} ${time} is already booked`);
      }

      const [hour, minute] = time.split(':');
      const startDateTime = new Date(`${date}T${hour}:${minute}:00`);
      const SLOT_DURATION = parseInt(process.env.APPOINTMENT_SLOT_DURATION) || 30;
      const endDateTime = new Date(startDateTime.getTime() + SLOT_DURATION * 60000);
      let formatLocalISO = (dateObj) => {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
      }

      const TIME_ZONE = 'Asia/Kolkata';
      const event = {
        summary: `Appointment - ${userName}`,
        description: `Phone: ${phoneNumber}\nBooked via WhatsApp`,
        start: {
          dateTime: formatLocalISO(startDateTime), // "2026-03-23T13:00:00"
          timeZone: TIME_ZONE,
        },
        end: {
          dateTime: formatLocalISO(endDateTime),   // "2026-03-23T13:30:00"
          timeZone: TIME_ZONE,
        },
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
   * Get all appointments from today onwards (next 7 days)
   * @returns {Promise<Array>} Array of recent and upcoming appointments
   */
  async getRecentAppointments() {
    try {
      const now = new Date();
      // Start from today at 00:00
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // End at 7 days from now
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const response = await this.calendar.events.list({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        timeMin: startOfToday.toISOString(),
        timeMax: sevenDaysLater.toISOString(),
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
      if (!this.isWithinOfficeHours(time)) {
        throw new Error(`Time slot ${time} is outside configured office hours`);
      }

      const isFree = await this.isSlotAvailable(date, time, eventId);
      if (!isFree) {
        throw new Error(`Time slot ${date} ${time} is already booked`);
      }

      const [hour, minute] = time.split(':');
      const startDateTime = new Date(`${date}T${hour}:${minute}:00`);
      const SLOT_DURATION = parseInt(process.env.APPOINTMENT_SLOT_DURATION) || 30;
      const endDateTime = new Date(startDateTime.getTime() + SLOT_DURATION * 60000);
      let formatLocalISO = (dateObj) => {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
      }

      const TIME_ZONE = 'Asia/Kolkata';
      const response = await this.calendar.events.update({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        eventId: eventId,
        requestBody: {
          // You usually want to keep the existing summary/description 
          // unless you pass them as arguments to this function
          start: {
            dateTime: formatLocalISO(startDateTime),
            timeZone: TIME_ZONE,
          },
          end: {
            dateTime: formatLocalISO(endDateTime),
            timeZone: TIME_ZONE,
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
