const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

/**
 * AI Service
 * Handles intent extraction, response generation using Gemini/OpenAI
 * Supports multilingual inputs (English, Hindi, Hinglish)
 */

class AIService {
  constructor() {
    this.initializeAI();
  }

  initializeAI() {
    const aiProvider = process.env.AI_PROVIDER || 'gemini'; // gemini or openai

    if (aiProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // Using gemini-1.5-flash for best performance and latest features
      this.modelId = 'gemini-1.5-flash';
      this.aiProvider = 'gemini';
      console.log('✅ Gemini AI (New SDK) initialized successfully');
    } else if (aiProvider === 'openai' && process.env.OPENAI_API_KEY) {
      this.openaiKey = process.env.OPENAI_API_KEY;
      this.aiProvider = 'openai';
      console.log('✅ OpenAI initialized successfully');
    } else {
      console.warn('⚠️ AI service not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY');
      this.aiProvider = null;
    }
  }

  /**
   * Extract intent from user message
   * @param {string} message - User's message in any language
   * @param {object} context - Previous conversation context
   * @returns {Promise<Object>} Intent object with action, date, time, treatment
   */
  async extractIntent(message, context = {}) {
    try {
      if (!this.aiProvider) {
        throw new Error('AI service not configured');
      }

      const systemPrompt = `You are a helpful WhatsApp appointment booking assistant. Extract the user's intent from their message.

USER LANGUAGES SUPPORTED: English, Hindi, Hinglish , Gujarati

INTENT TYPES:
- BOOK: User wants to book an appointment
- QUERY: User is asking about availability or doctors
- CANCEL: User wants to cancel an appointment
- RESCHEDULE: User wants to change appointment time
- CONFIRM: User is confirming a booking
- IDLE: General conversation, no specific action

RESPONSE FORMAT (Must be valid JSON):
{
  "intent": "BOOK|QUERY|CANCEL|RESCHEDULE|CONFIRM|IDLE",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or 'MORNING'|'AFTERNOON'|'EVENING' or null",
  "treatment": "treatment type or null",
  "doctor": "doctor name or null",
  "confidence": 0-100,
  "message": "English summary of intent"
}

TIME SLOTS:
- MORNING: 10:00-12:00
- AFTERNOON: 12:00-16:00 (12 PM - 4 PM)
- EVENING: 16:00-08:00 (4 PM - 8 PM)

EXAMPLES:
Input: "Doctor ko kab dikhana hai"
Output: {"intent":"QUERY","date":null,"time":null,"treatment":null,"doctor":null,"confidence":85,"message":"User asking about doctor availability"}

Input: "Kal sham book kardo"
Output: {"intent":"BOOK","date":"NEXT_DAY","time":"EVENING","treatment":null,"doctor":null,"confidence":90,"message":"User wants to book for tomorrow evening"}

Input: "Malaria ke liye appointment chahiye kal 3 baje"
Output: {"intent":"BOOK","date":"NEXT_DAY","time":"15:00","treatment":"Malaria","doctor":null,"confidence":95,"message":"Booking for malaria treatment tomorrow at 3 PM"}

PREVIOUS CONTEXT:
${JSON.stringify(context)}

Extract intent from this message and respond ONLY with valid JSON.`;

      let responseText;

      if (this.aiProvider === 'gemini') {
        const result = await this.client.models.generateContent({
          model: this.modelId,
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUSER MESSAGE: ${message}` }] }]
        });
        
        responseText = result.candidates[0].content.parts[0].text;
        return this.parseJSON(responseText);
      } else if (this.aiProvider === 'openai') {
        const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: message,
            },
          ],
          temperature: 0.3,
        }, {
          headers: {
            'Authorization': `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json',
          },
        });

        responseText = openaiResponse.data.choices[0].message.content;
        return this.parseJSON(responseText);
      }
    } catch (error) {
      console.error('Error extracting intent:', error);
      return {
        intent: 'IDLE',
        date: null,
        time: null,
        treatment: null,
        doctor: null,
        confidence: 0,
        error: error.message,
      };
    }
  }

  /**
   * Parse JSON response safely
   * @param {string} text - Response text that should contain JSON
   * @returns {Object} Parsed JSON or default object
   */
  parseJSON(text) {
    try {
      // Extract JSON from text (in case AI wraps it with extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch (error) {
      console.error('JSON parse error:', error);
      return {
        intent: 'IDLE',
        date: null,
        time: null,
        treatment: null,
        doctor: null,
        confidence: 0,
        error: 'Failed to parse response',
      };
    }
  }

  /**
   * Generate slot suggestion message in user's language
   * @param {array} suggestedSlots - Available slots
   * @param {string} language - Language preference (en, hi, hinglish)
   * @returns {string} Formatted message
   */
  generateSlotMessage(suggestedSlots, language = 'en') {
    if (!suggestedSlots || suggestedSlots.length === 0) {
      const messages = {
        en: 'No slots available. Please try another date.',
        hi: 'कोई स्लॉट उपलब्ध नहीं है। कृपया किसी अन्य दिन प्रयास करें।',
        hinglish: 'Koi slots available nahi hain. Kripya dusre din try kren.',
      };
      return messages[language] || messages.en;
    }

    const slotTexts = suggestedSlots.slice(0, 2).map((slot) => {
      const time12 = this.convertTo12Hour(slot.time);
      return `${slot.date} - ${time12}`;
    }).join('\n');

    const messages = {
      en: `Available slots:\n${slotTexts}`,
      hi: `उपलब्ध स्लॉट:\n${slotTexts}`,
      hinglish: `Available slots:\n${slotTexts}`,
    };

    return messages[language] || messages.en;
  }

  /**
   * Convert 24-hour time to 12-hour format
   * @param {string} time - Time in HH:MM format
   * @returns {string} Time in 12-hour format with AM/PM
   */
  convertTo12Hour(time) {
    const [hour, minute] = time.split(':');
    let hrs = parseInt(hour, 10);
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12;
    hrs = hrs || 12;
    return `${String(hrs).padStart(2, '0')}:${minute} ${ampm}`;
  }

  /**
   * Generate smart AI response for user
   * @param {object} intentData - Intent extraction result
   * @param {array} availableSlots - Available appointment slots
   * @param {string} language - User's language preference
   * @returns {Promise<string>} AI-generated response
   */
  async generateResponse(intentData, availableSlots = [], language = 'en') {
    try {
      const slotInfo = this.generateSlotMessage(availableSlots, language);

      const prompt = `Generate a friendly WhatsApp response for user intent: ${JSON.stringify(intentData)}

Available slots: ${slotInfo}

Language: ${language} (Hindi for 'hi', Hinglish for 'hinglish', English for 'en')

Keep response short (1-2 lines), natural, and friendly. Include slot suggestions if booking intent detected.`;

      let responseText;

      if (this.aiProvider === 'gemini') {
        const result = await this.client.models.generateContent({
          model: this.modelId,
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        // Extract text from parts
        responseText = result.candidates[0].content.parts
          .filter(part => part.text)
          .map(part => part.text)
          .join('');
          
        return responseText;
      } else if (this.aiProvider === 'openai') {
        const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
        }, {
          headers: {
            'Authorization': `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json',
          },
        });

        return openaiResponse.data.choices[0].message.content;
      }
    } catch (error) {
      console.error('Error generating response:', error);
      return 'An error occurred. Please try again.';
    }
  }
}

module.exports = new AIService();
