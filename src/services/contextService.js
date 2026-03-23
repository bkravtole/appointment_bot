const { createClient } = require('@supabase/supabase-js');

/**
 * Context Service
 * Manages conversation context and history in Supabase
 * Stores last 5 messages for continuity in AI conversations
 */

class ContextService {
  constructor() {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    } else {
      console.warn('Supabase credentials not configured. Context management will be limited.');
      this.supabase = null;
    }
  }

  /**
   * Save user message to conversation history
   * @param {string} phoneNumber - User's phone number
   * @param {string} message - User's message
   * @param {object} intent - Extracted intent data
   * @returns {Promise<Object>} Saved record
   */
  async saveMessage(phoneNumber, message, intent = {}) {
    if (!this.supabase) {
      console.log('Supabase not configured, skipping context save');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('conversation_context')
        .insert([
          {
            phone_number: phoneNumber,
            message: message,
            intent: intent,
            message_type: intent.intent || 'IDLE',
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) {
        console.error('Database save error:', error);
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  /**
   * Get last 5 messages for conversation context
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Array>} Last 5 messages
   */
  async getConversationHistory(phoneNumber) {
    if (!this.supabase) {
      console.log('Supabase not configured, returning empty history');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('conversation_context')
        .select('*')
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Database query error:', error);
        throw error;
      }

      // Reverse to get chronological order
      return (data || []).reverse();
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
  }

  /**
   * Update user state (for multi-step flows)
   * @param {string} phoneNumber - User's phone number
   * @param {string} state - Current state (AWAITING_TIME, CONFIRMED, etc.)
   * @param {object} lastContext - Context data to store
   * @returns {Promise<Object>} Updated record
   */
  async updateUserState(phoneNumber, state, lastContext = {}) {
    if (!this.supabase) {
      console.log('Supabase not configured, skipping state update');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('conversation_context')
        .upsert(
          {
            phone_number: phoneNumber,
            state: state,
            last_context: lastContext,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'phone_number',
          }
        )
        .select();

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('Error updating user state:', error);
      throw error;
    }
  }

  /**
   * Get current user state
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Object|null>} User state record
   */
  async getUserState(phoneNumber) {
    if (!this.supabase) {
      console.log('Supabase not configured, returning null');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('conversation_context')
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
      console.error('Error fetching user state:', error);
      return null;
    }
  }

  /**
   * Clear old conversation history (older than 7 days)
   * @param {number} daysOld - Delete messages older than this many days
   * @returns {Promise<number>} Number of deleted records
   */
  async clearOldHistory(daysOld = 7) {
    if (!this.supabase) {
      console.log('Supabase not configured, skipping cleanup');
      return 0;
    }

    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from('conversation_context')
        .delete()
        .lt('created_at', cutoffDate);

      if (error) {
        console.error('Database delete error:', error);
        throw error;
      }

      console.log(`Cleared conversation history older than ${daysOld} days`);
      return data?.length || 0;
    } catch (error) {
      console.error('Error clearing history:', error);
      return 0;
    }
  }

  /**
   * Format conversation history for AI context
   * @param {array} messages - Array of message records
   * @returns {string} Formatted context string for AI
   */
  formatContextForAI(messages) {
    if (!messages || messages.length === 0) {
      return 'No previous context.';
    }

    return messages
      .map((msg) => `${new Date(msg.created_at).toLocaleTimeString()}: ${msg.message}`)
      .join('\n');
  }
}

module.exports = new ContextService();
