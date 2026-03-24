const Groq = require('groq-sdk');
const axios = require('axios');

/**
 * AI Service
 * Handles intent extraction, response generation using Groq/Gemini/OpenAI
 * Supports multilingual inputs (English, Hindi, Hinglish)
 */

class AIService {
  constructor() {
    this.initializeAI();
  }

  initializeAI() {
    const aiProvider = process.env.AI_PROVIDER || 'groq'; // groq, gemini or openai

    if (aiProvider === 'groq' && process.env.GROQ_API_KEY) {
      this.client = new Groq({
        apiKey: process.env.GROQ_API_KEY,
      });
      // Using llama-3.3-70b-versatile for high quality and speed
      this.modelId = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      this.aiProvider = 'groq';
      console.log(`✅ Groq AI initialized successfully with model: ${this.modelId}`);
    } else if (aiProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = require('@google/genai');
      this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      this.modelId = 'gemini-3-flash-preview';
      this.aiProvider = 'gemini';
      console.log('✅ Gemini AI (New SDK) initialized successfully');
    } else if (aiProvider === 'openai' && process.env.OPENAI_API_KEY) {
      this.openaiKey = process.env.OPENAI_API_KEY;
      this.aiProvider = 'openai';
      console.log('✅ OpenAI initialized successfully');
    } else {
      console.warn('⚠️ AI service not configured correctly. Please check AI_PROVIDER and API keys.');
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

      const currentDate = new Date().toISOString().split('T')[0];
      const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

      const systemPrompt = `WhatsApp Assistant. 
Today: ${currentDate} (${currentDay}). 
Extract intent/date (YYYY-MM-DD)/time/treatment.
JSON ONLY: {"intent":"BOOK|QUERY|CANCEL|RESCHEDULE|CONFIRM|IDLE","date":"YYYY-MM-DD","time":"HH:MM|MORNING|AFTERNOON|EVENING","treatment":"string","confidence":0-100,"message":"summary"}

Context: ${JSON.stringify(context)}`;

      let responseText;

      if (this.aiProvider === 'groq') {
        const chatCompletion = await this.client.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `USER MESSAGE: ${message}` }
          ],
          model: this.modelId,
          response_format: { type: "json_object" }
        });

        responseText = chatCompletion.choices[0].message.content;
        return JSON.parse(responseText);
      } else if (this.aiProvider === 'gemini') {
        const result = await this.client.models.generateContent({
          model: this.modelId,
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUSER MESSAGE: ${message}` }] }]
        });

        responseText = result.candidates[0].content.parts[0].text;
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
      const time24 = slot.time24 || slot.time;
      if (!time24) return `${slot.date} - Slot available`;

      const time12 = this.convertTo12Hour(time24);
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
    if (!time || typeof time !== 'string') return 'N/A';

    const parts = time.split(':');
    if (parts.length < 2) return time;

    const [hour, minute] = parts;
    let hrs = parseInt(hour, 10);
    if (isNaN(hrs)) return time;

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

      const prompt = `Friendly WhatsApp response. 
Intent: ${JSON.stringify(intentData)}
Slots: ${slotInfo}
Lang: ${language}
Max 2 short lines. Friendly & natural.`;

      let responseText;

      if (this.aiProvider === 'groq') {
        const chatCompletion = await this.client.chat.completions.create({
          messages: [
            { role: 'user', content: prompt }
          ],
          model: this.modelId,
          temperature: 0.7,
          max_tokens: 150,
        });

        responseText = chatCompletion.choices[0].message.content;
        return responseText;
      } else if (this.aiProvider === 'gemini') {
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
