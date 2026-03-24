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
  isAffirmativeMessage(message) {
    if (!message || typeof message !== 'string') return false;
    const text = message.trim().toLowerCase();
    if (!text) return false;

    const affirmativePhrases = [
      'ok', 'okay', 'yes', 'yep', 'yeah', 'sure', 'done', 'confirm', 'book it',
      'haan', 'ha', 'han', 'hanji', 'haanji', 'ji', 'thik hai', 'theek hai',
      'thik h', 'theek h', 'kar do', 'kr do', 'kardo', 'kar dijiye', 'kr dijiye',
      'ho gaya', 'chalega', 'sahi hai'
    ];

    return affirmativePhrases.some((phrase) => text === phrase || text.includes(phrase));
  }

  inferTimePreferenceFromMessage(message) {
    if (!message || typeof message !== 'string') return null;
    const text = message.toLowerCase();

    // English + Hindi/Hinglish keywords
    if (/\bmorning\b|\bsubah\b|\bmrng\b/.test(text)) return 'MORNING';
    if (/\bafternoon\b|\bdupahar\b|\bdopehar\b|\bnoon\b/.test(text)) return 'AFTERNOON';
    if (/\bevening\b|\bshaam\b|\bsham\b|\braat\b|\bnight\b/.test(text)) return 'EVENING';

    return null;
  }

  isAnyAvailableBookingRequest(message) {
    if (!message || typeof message !== 'string') return false;
    const text = message.trim().toLowerCase();
    if (!text) return false;

    // If user already provided an explicit time, don't treat it as "any available".
    if (/\b\d{1,2}(:\d{2})?\s*(am|pm)?\b/i.test(text)) {
      return false;
    }

    const phrases = [
      'jo available ho',
      'jo available hai',
      'available ho to kar do',
      'koi bhi available',
      'any available',
      'any slot',
      'first available',
      'next available',
      'available slot book'
    ];

    return phrases.some((phrase) => text.includes(phrase));
  }

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

  normalizeTimeWithContext(message, rawTimeText) {
    const base = this.normalizeTimeTo24(rawTimeText);
    if (!base) return null;

    const hasPeriod = /\b(am|pm)\b/i.test(rawTimeText);
    if (hasPeriod) return base;

    const text = (message || '').toLowerCase();
    const hour = parseInt(base.split(':')[0], 10);
    const minute = base.split(':')[1];
    const officeStart = parseInt(process.env.OFFICE_HOURS_START) || 10;
    const officeEnd = parseInt(process.env.OFFICE_HOURS_END) || 18;

    // Hindi/Hinglish context for evening requests like "5 baje sham ko".
    if ((/\bevening\b|\bshaam\b|\bsham\b|\braat\b|\bnight\b|\bpm\b/.test(text)) && hour < 12) {
      const adjusted = hour === 12 ? 12 : hour + 12;
      return `${String(adjusted).padStart(2, '0')}:${minute}`;
    }

    // If AM/PM is missing and parsed hour is outside clinic window, try PM variant.
    if (!/\b(am|pm)\b/i.test(rawTimeText) && hour < officeStart) {
      const pmHour = hour === 12 ? 12 : hour + 12;
      if (pmHour < officeEnd) {
        return `${String(pmHour).padStart(2, '0')}:${minute}`;
      }
    }

    return base;
  }

  extractTreatmentFromMessage(message) {
    if (!message || typeof message !== 'string') return null;
    const text = message.trim();
    const forPattern = /(?:for|ke liye|ki liye)\s+([a-zA-Z\s]{3,40})/i;
    const match = text.match(forPattern);
    if (!match) return null;
    return match[1].trim();
  }

  extractRequestedTimeFromMessage(message) {
    if (!message || typeof message !== 'string') return null;
    const match = message.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (!match) return null;
    return this.normalizeTimeWithContext(message, match[1]);
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
    const time24 = timeMatch ? this.normalizeTimeWithContext(trimmed, timeMatch[1]) : null;

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
      const looksLikeAffirmative = this.isAffirmativeMessage(userMessage);

      if (intentData.intent === 'BOOK' || intentData.intent === 'RESCHEDULE') {
        response = await this.handleBookingIntent(
          phoneNumber,
          intentData,
          language,
          conversationHistory,
          userMessage
        );
      } else if (intentData.intent === 'QUERY') {
        response = await this.handleQueryIntent(phoneNumber, intentData, language);
      } else if (intentData.intent === 'CANCEL') {
        response = await this.handleCancelIntent(phoneNumber, language);
      } else if (intentData.intent === 'CONFIRM' || (awaitingConfirmation && (looksLikeSlotNumber || looksLikeTime || looksLikeAffirmative))) {
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
  async handleBookingIntent(phoneNumber, intentData, language, conversationHistory, userMessage = '') {
    try {
      let targetDate = intentData.date;

      // If date not provided or 'null' string, use today
      if (!targetDate || targetDate === 'null') {
        targetDate = new Date().toISOString().split('T')[0];
      }

      const requestedTimeFromMessage = this.extractRequestedTimeFromMessage(userMessage);
      const requestedTimeFromIntent = intentData.time && !['MORNING', 'AFTERNOON', 'EVENING', 'null'].includes(intentData.time)
        ? this.normalizeTimeTo24(intentData.time)
        : null;
      const selectedTime = requestedTimeFromMessage || requestedTimeFromIntent;

      if (!selectedTime) {
        return {
          success: false,
          error: 'Exact time bhejiye (example: 5 pm ya 17:00). Slot recommendation disabled hai.',
        };
      }

      const isAvailable = await googleCalendarService.isSlotAvailable(targetDate, selectedTime);
      if (!isAvailable) {
        return {
          success: false,
          error: `Requested slot ${targetDate} ${selectedTime} already booked hai. Dusra exact time bhejiye.`,
        };
      }

      const treatmentName = intentData.treatment || this.extractTreatmentFromMessage(userMessage) || 'General Checkup';
      const existingAppointment = await databaseService.getAppointmentByPhone(phoneNumber);
      const sameDateExisting = existingAppointment?.appointment_time
        ? existingAppointment.appointment_time.startsWith(`${targetDate}T`)
        : false;

      let event;
      if (existingAppointment?.event_id && sameDateExisting) {
        event = await googleCalendarService.updateAppointment(existingAppointment.event_id, targetDate, selectedTime);
      } else {
        event = await googleCalendarService.createAppointment(
          phoneNumber,
          targetDate,
          selectedTime,
          treatmentName
        );
      }

      await databaseService.saveAppointment(
        phoneNumber,
        event.eventId,
        treatmentName,
        event.startTime
      );

      await contextService.updateUserState(phoneNumber, 'CONFIRMED', {
        appointmentId: event.eventId,
        date: targetDate,
        time: selectedTime,
        treatment: treatmentName,
      });

      return {
        success: true,
        phoneNumber,
        intent: 'CONFIRM',
        appointment: {
          date: targetDate,
          time: selectedTime,
          time12: googleCalendarService.convertTo12HourFormat(selectedTime),
          eventId: event.eventId,
        },
        message: `Appointment confirmed for ${targetDate} at ${googleCalendarService.convertTo12HourFormat(selectedTime)}`,
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
      const anyAvailableRequested = this.isAnyAvailableBookingRequest(userMessage);

      let selectedTime = null;
      let selectedSlot = null;

      if (slotByNumber) {
        selectedSlot = slotByNumber;
        selectedTime = slotByNumber.time24;
      } else if (anyAvailableRequested) {
        const availableSlots = await googleCalendarService.getAvailableSlots(date);
        const now = new Date();
        const oneHourLaterMinutes = (now.getHours() * 60) + now.getMinutes() + 60;
        const slotAfterOneHour = availableSlots.find((slot) => {
          const [h, m] = slot.time24.split(':').map((n) => parseInt(n, 10));
          const slotMinutes = (h * 60) + m;
          return slotMinutes >= oneHourLaterMinutes;
        });

        selectedSlot = slotAfterOneHour || availableSlots[0] || null;
        selectedTime = selectedSlot ? selectedSlot.time24 : null;
      } else if (requestedTime24) {
        selectedSlot = suggestedSlots.find((slot) => slot.time24 === requestedTime24) || null;
        selectedTime = selectedSlot ? selectedSlot.time24 : requestedTime24;
      } else if (suggestedSlots.length > 0) {
        // Generic confirmations like "ok/yes" should confirm the first suggested slot,
        // not stale extracted intent values from the previous turn (e.g. EVENING).
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
