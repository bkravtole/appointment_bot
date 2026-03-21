const { createClient } = require('@supabase/supabase-js');

/**
 * Database Service
 * Manages user appointments and phone number to event ID mappings in Supabase
 */

class DatabaseService {
  constructor() {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    } else {
      console.warn('Supabase credentials not configured. Database operations will be disabled.');
      this.supabase = null;
    }
  }

  /**
   * Create or update an appointment record
   * @param {string} phoneNumber - User's phone number
   * @param {string} eventId - Google Calendar event ID
   * @param {string} userName - User's name
   * @param {string} appointmentTime - Appointment date and time
   * @returns {Promise<Object>} Database record
   */
  async saveAppointment(phoneNumber, eventId, userName, appointmentTime) {
    if (!this.supabase) {
      console.log('Database not configured, skipping save');
      return { phoneNumber, eventId, userName, appointmentTime };
    }

    try {
      const { data, error } = await this.supabase
        .from('appointments')
        .upsert(
          {
            phone_number: phoneNumber,
            event_id: eventId,
            user_name: userName,
            appointment_time: appointmentTime,
            created_at: new Date().toISOString(),
            status: 'confirmed',
          },
          {
            onConflict: 'phone_number',
          }
        )
        .select();

      if (error) {
        console.error('Database save error:', error);
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('Error saving appointment:', error);
      throw error;
    }
  }

  /**
   * Get appointment by phone number
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object|null>} Appointment record or null
   */
  async getAppointmentByPhone(phoneNumber) {
    if (!this.supabase) {
      console.log('Database not configured, returning null');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('appointments')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is expected
        console.error('Database query error:', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Error fetching appointment:', error);
      return null;
    }
  }

  /**
   * Delete an appointment record
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<void>}
   */
  async deleteAppointment(phoneNumber) {
    if (!this.supabase) {
      console.log('Database not configured, skipping delete');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('appointments')
        .delete()
        .eq('phone_number', phoneNumber);

      if (error) {
        console.error('Database delete error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  }

  /**
   * Get all appointments
   * @returns {Promise<Array>} All appointment records
   */
  async getAllAppointments() {
    if (!this.supabase) {
      console.log('Database not configured, returning empty array');
      return [];
    }

    try {
      const { data, error } = await this.supabase.from('appointments').select('*');

      if (error) {
        console.error('Database query error:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching all appointments:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();
