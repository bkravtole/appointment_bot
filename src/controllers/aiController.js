const aiService = require('../services/aiService');
const audioService = require('../services/audioService');
const contextService = require('../services/contextService');
const googleCalendarService = require('../services/googleCalendarService');
const databaseService = require('../services/supabaseService');

/**
 * AI Controller
 * Orchestrates AI-powered appointment booking with intent extraction,
 * smart slot matching, and contextual memory
 */

class AIController {
  normalizeTimeTo24(timeText) {
    if (!timeText || typeof timeText !== 'string') return null;

    const normalized = timeText.trim().toUpperCase().replace(/\./g, '');
    const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const minute = match[2] || '00';
    const period = match[3] || null;

    if (period === 'AM') {
      if (hour === 12) hour = 0;
    } else if (period === 'PM') {
      if (hour !== 12) hour += 12;
    }

    if (hour < 0 || hour > 23) return null;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  extractRequestedSelection(message, suggestedSlots = []) {
    if (!message || typeof message !== 'string') {
      return { slotByNumber: null, time24: null };
    }

    const trimmed = message.trim();
    const numberMatch = trimmed.match(/^(\d{1,2})$/);
    let slotByNumber = null;

    if (numberMatch) {
      const index = parseInt(numberMatch[1], 10) - 1;
      if (index >= 0 && index < suggestedSlots.length) {
        slotByNumber = suggestedSlots[index];
      }
    }

    const timePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
    const timeMatch = trimmed.match(timePattern);
    const time24 = timeMatch ? this.normalizeTimeTo24(timeMatch[1]) : null;

    return { slotByNumber, time24 };
  }

  /**
   * Process user message (text or audio)
   * @param {string} phoneNumber - User's phone number
   * @param {string} message - User's text message (optional if audio URL provided)
   * @param {string} audioUrl - Audio file URL from 11za (optional)
   * @param {string} language - User's language preference (en, hi, hinglish)
   * @returns {Promise<Object>} AI response with intent and suggested slots
   */
  async processMessage(phoneNumber, message, audioUrl = null, language = 'en') {
    try {
      let userMessage = message;

      // Step 1: If audio URL provided, transcribe it first
      if (audioUrl && !message) {
        console.log('Transcribing audio...');
        userMessage = await audioService.transcribeAudioFromUrl(audioUrl, language);
        console.log('Transcribed message:', userMessage);
      }

      if (!userMessage) {
        return {
          success: false,
          error: 'No message or audio provided',
        };
      }

      // Step 2: Get conversation history for context
      const conversationHistory = await contextService.getConversationHistory(phoneNumber);
      const contextSummary = contextService.formatContextForAI(conversationHistory);

      // Step 3: Extract intent from message
      const intentData = await aiService.extractIntent(userMessage, {
        conversationHistory: contextSummary,
        previousThoughtProcess: conversationHistory.slice(-1)[0]?.intent || null,
      });

      console.log('Extracted intent:', intentData);

      // Step 4: Get current state and save it with the new message
      const userState = await contextService.getUserState(phoneNumber);
      const currentState = userState ? userState.state : 'IDLE';
      const lastContext = userState ? userState.last_context : null;
      
      await contextService.saveMessage(phoneNumber, userMessage, intentData, currentState, lastContext);

      // Step 5: Handle different intents
      let response = {
        success: true,
        phoneNumber,
        userMessage,
        intent: intentData.intent,
        date: intentData.date,
        time: intentData.time,
        treatment: intentData.treatment,
        confidence: intentData.confidence,
      };

      const awaitingConfirmation = currentState === 'AWAITING_CONFIRMATION';
      const looksLikeSlotNumber = typeof userMessage === 'string' && /^\s*\d{1,2}\s*$/.test(userMessage);
      const looksLikeTime = typeof userMessage === 'string' && /\d{1,2}(:\d{2})?\s*(am|pm)?/i.test(userMessage);

      if (intentData.intent === 'BOOK' || intentData.intent === 'RESCHEDULE') {
        response = await this.handleBookingIntent(
          phoneNumber,
          intentData,
          language,
          conversationHistory
        );
      } else if (intentData.intent === 'QUERY') {
        response = await this.handleQueryIntent(phoneNumber, intentData, language);
      } else if (intentData.intent === 'CANCEL') {
        response = await this.handleCancelIntent(phoneNumber, language);
      } else if (intentData.intent === 'CONFIRM' || (awaitingConfirmation && (looksLikeSlotNumber || looksLikeTime))) {
        response = await this.handleConfirmIntent(phoneNumber, intentData, language, userMessage);
      }

      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle BOOK intent - Find matching slots
   * @private
   */
  async handleBookingIntent(phoneNumber, intentData, language, conversationHistory) {
    try {
      let targetDate = intentData.date;

      // If date not provided or 'null' string, use today
      if (!targetDate || targetDate === 'null') {
        targetDate = new Date().toISOString().split('T')[0];
      }

      // Get available slots
      const allSlots = await googleCalendarService.getAvailableSlots(targetDate);

      // Step 1: Filter by time preference if specified
      let filteredSlots = allSlots;

      if (intentData.time === 'MORNING') {
        filteredSlots = allSlots.filter((slot) => {
          const hour = parseInt(slot.time24.split(':')[0]);
          return hour >= 10 && hour < 12;
        });
      } else if (intentData.time === 'AFTERNOON') {
        filteredSlots = allSlots.filter((slot) => {
          const hour = parseInt(slot.time24.split(':')[0]);
          return hour >= 12 && hour < 16;
        });
      } else if (intentData.time === 'EVENING') {
        filteredSlots = allSlots.filter((slot) => {
          const hour = parseInt(slot.time24.split(':')[0]);
          return hour >= 16 && hour < 19;
        });
      } else if (intentData.time && intentData.time !== 'null') {
        // Exact time match - find closest available slot
        const requestedHour = parseInt(intentData.time.split(':')[0]);
        const exactMatch = allSlots.find((slot) => {
          const slotHour = parseInt(slot.time24.split(':')[0]);
          return slotHour === requestedHour;
        });

        if (exactMatch) {
          filteredSlots = [exactMatch];
        } else {
          // If exact time not available, suggest next 2 available slots
          filteredSlots = allSlots.slice(0, 2);
        }
      }

      // If no slots found for preferred time, suggest next available
      if (filteredSlots.length === 0) {
        filteredSlots = allSlots.slice(0, 2);
      }

      // Generate AI response with slots
      const aiResponse = await aiService.generateResponse(
        intentData,
        filteredSlots.slice(0, 2), // Send top 2 slots
        language
      );

      // Update user state to AWAITING_CONFIRMATION
      await contextService.updateUserState(phoneNumber, 'AWAITING_CONFIRMATION', {
        intent: intentData.intent,
        date: targetDate,
        suggestedSlots: filteredSlots.slice(0, 2),
        treatment: intentData.treatment,
      });

      return {
        success: true,
        phoneNumber,
        intent: 'BOOK',
        date: targetDate,
        suggestedSlots: filteredSlots.slice(0, 2).map((slot) => ({
          id: slot.id,
          time12: slot.time12,
          time24: slot.time24,
        })),
        aiMessage: aiResponse,
        userPrompt: `Choose one of the slots above to confirm booking`,
      };
    } catch (error) {
      console.error('Error handling booking intent:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle QUERY intent - Check availability
   * @private
   */
  async handleQueryIntent(phoneNumber, intentData, language) {
    try {
      let targetDate = intentData.date;

      // If date not provided, use today
      if (!targetDate || targetDate === 'null') {
        targetDate = new Date().toISOString().split('T')[0];
      }

      const availableSlots = await googleCalendarService.getAvailableSlots(targetDate);

      const aiResponse = await aiService.generateResponse(
        intentData,
        availableSlots.slice(0, 3),
        language
      );

      return {
        success: true,
        phoneNumber,
        intent: 'QUERY',
        date: targetDate,
        totalAvailableSlots: availableSlots.length,
        availableSlots: availableSlots.slice(0, 3),
        aiMessage: aiResponse,
      };
    } catch (error) {
      console.error('Error handling query intent:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle CANCEL intent
   * @private
   */
  async handleCancelIntent(phoneNumber, language) {
    try {
      const userState = await contextService.getUserState(phoneNumber);

      if (!userState || !userState.last_context?.appointmentId) {
        return {
          success: false,
          error: 'No active appointment found to cancel',
        };
      }

      // Cancel the appointment
      await googleCalendarService.deleteAppointment(userState.last_context.appointmentId);
      await contextService.updateUserState(phoneNumber, 'CANCELLED', {});

      const messages = {
        en: 'Your appointment has been cancelled successfully.',
        hi: 'आपकी अपॉइंटमेंट सफलतापूर्वक रद्द हो गई है।',
        hinglish: 'Aapki appointment successfully cancel ho gyi hai.',
      };

      return {
        success: true,
        phoneNumber,
        intent: 'CANCEL',
        message: messages[language] || messages.en,
      };
    } catch (error) {
      console.error('Error handling cancel intent:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle CONFIRM intent - Finalize booking
   * @private
   */
  async handleConfirmIntent(phoneNumber, intentData, language, userMessage = '') {
    try {
      const userState = await contextService.getUserState(phoneNumber);

      if (!userState || userState.state !== 'AWAITING_CONFIRMATION') {
        return {
          success: false,
          error: 'No pending booking to confirm',
        };
      }

      const { date, suggestedSlots = [] } = userState.last_context;
      const { slotByNumber, time24: requestedTime24 } = this.extractRequestedSelection(
        userMessage,
        suggestedSlots
      );

      let selectedTime = null;
      let selectedSlot = null;

      if (slotByNumber) {
        selectedSlot = slotByNumber;
        selectedTime = slotByNumber.time24;
      } else if (requestedTime24) {
        selectedSlot = suggestedSlots.find((slot) => slot.time24 === requestedTime24) || null;
        selectedTime = selectedSlot ? selectedSlot.time24 : requestedTime24;
      } else if (intentData.time && intentData.time !== 'null') {
        selectedTime = this.normalizeTimeTo24(intentData.time) || intentData.time;
      } else if (suggestedSlots.length > 0) {
        selectedSlot = suggestedSlots[0];
        selectedTime = selectedSlot.time24;
      }

      if (!selectedTime) {
        return {
          success: false,
          error: 'Please choose a valid slot number or time to confirm',
        };
      }

      // Validate selected time is currently available
      const availableSlots = await googleCalendarService.getAvailableSlots(date);
      const isSelectedTimeAvailable = availableSlots.some((slot) => slot.time24 === selectedTime);

      if (!isSelectedTimeAvailable) {
        return {
          success: false,
          error: `Selected time ${selectedTime} is not available. Please choose another slot.`,
          availableSlots: availableSlots.slice(0, 3),
        };
      }

      if (!selectedSlot) {
        selectedSlot = availableSlots.find((slot) => slot.time24 === selectedTime) || {
          time24: selectedTime,
          time12: googleCalendarService.convertTo12HourFormat(selectedTime),
        };
      }

      const existingAppointment = await databaseService.getAppointmentByPhone(phoneNumber);
      let event;
      const sameDateExisting = existingAppointment?.appointment_time
        ? existingAppointment.appointment_time.startsWith(`${date}T`)
        : false;

      if (existingAppointment?.event_id && sameDateExisting) {
        // User asked a different time on same date -> move existing appointment.
        event = await googleCalendarService.updateAppointment(existingAppointment.event_id, date, selectedTime);
      } else {
        event = await googleCalendarService.createAppointment(
          phoneNumber,
          date,
          selectedTime,
          intentData.treatment || 'General Checkup'
        );
      }

      await databaseService.saveAppointment(
        phoneNumber,
        event.eventId,
        intentData.treatment || 'General Checkup',
        event.startTime
      );

      // Update state
      await contextService.updateUserState(phoneNumber, 'CONFIRMED', {
        appointmentId: event.eventId,
        date,
        time: selectedTime,
        treatment: intentData.treatment,
      });

      const messages = {
        en: `Appointment confirmed for ${date} at ${selectedSlot.time12}`,
        hi: `अपॉइंटमेंट ${date} को ${selectedSlot.time12} पर पुष्टि की गई।`,
        hinglish: `Appointment confirmed for ${date} at ${selectedSlot.time12}`,
      };

      return {
        success: true,
        phoneNumber,
        intent: 'CONFIRM',
        appointment: {
          date,
          time: selectedTime,
          time12: selectedSlot.time12,
          eventId: event.eventId,
        },
        message: messages[language] || messages.en,
      };
    } catch (error) {
      console.error('Error handling confirm intent:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get conversation history for user
   * @param {string} phoneNumber - User's phone number
   * @returns {Promise<Array>} Conversation history
   */
  async getConversationHistory(phoneNumber) {
    try {
      const history = await contextService.getConversationHistory(phoneNumber);
      return {
        success: true,
        phoneNumber,
        messageCount: history.length,
        messages: history,
      };
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new AIController();
