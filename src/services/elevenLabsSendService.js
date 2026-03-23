const axios = require('axios');

/**
 * 11za Send Service
 * Handles sending messages back to users via 11za WhatsApp API
 */

class ElevenLabsSendService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_TOKEN;
    this.phoneId = process.env.ELEVENLABS_PHONE_ID;
    this.originWebsite = process.env.ELEVENLABS_ORIGIN_WEBSITE || 'https://engees.in';
    this.baseURL = 'https://internal.11za.in/apis'; // 11za API endpoint
  }

  /**
   * Send text message via 11za
   * @param {string} phoneNumber - Recipient's phone number (with country code)
   * @param {string} message - Text message to send
   * @returns {Promise<Object>} Response from 11za API
   */
  async sendTextMessage(phoneNumber, message) {
    try {
      if (!this.apiKey || !this.phoneId) {
        throw new Error('11za credentials not configured (ELEVENLABS_TOKEN, ELEVENLABS_PHONE_ID)');
      }

      console.log(`[11za] Sending message to ${phoneNumber}: ${message}`);

      const payload = {
        sendto: phoneNumber,
        authToken: this.apiKey,
        originWebsite: this.originWebsite,
        contentType: 'text',
        text: message,
      };

      const response = await axios.post(`${this.baseURL}/sendMessage/sendMessages`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      console.log(`[11za] Message sent successfully to ${phoneNumber}`);
      console.log('11za Response:', response.data);

      return {
        success: true,
        messageId: response.data.messageId || response.data.id,
        timestamp: new Date().toISOString(),
        recipient: phoneNumber,
        content: message,
      };
    } catch (error) {
      console.error('[11za] Error sending message:', error.message);
      return {
        success: false,
        error: error.message,
        recipient: phoneNumber,
      };
    }
  }

  /**
   * Send interactive list menu
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} title - Menu title
   * @param {string} body - Menu body text
   * @param {array} options - Array of {title, description} objects
   * @returns {Promise<Object>} 11za API response
   */
  async sendListMenu(phoneNumber, title, body, options = []) {
    try {
      if (!this.apiKey || !this.phoneId) {
        throw new Error('11za credentials not configured');
      }

      console.log(`[11za] Sending list menu to ${phoneNumber}`);

      const payload = {
        sendto: phoneNumber,
        authToken: this.apiKey,
        originWebsite: this.originWebsite,
        contentType: 'interactive',
        interactive: {
          subtype: 'list',
          header: {
            type: 'text',
            text: title,
          },
          body: {
            text: body,
          },
          footer: {
            text: 'Select an option below',
          },
          list: {
            title: 'View Options',
            sections: [
              {
                title: 'Available Slots',
                rows: options.map((opt, idx) => ({
                  payload: `slot_${idx}`,
                  title: opt.title,
                  description: opt.description,
                })),
              },
            ],
          },
        },
      };

      const response = await axios.post(`${this.baseURL}/sendMessage/sendInteractiveMessage`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      console.log(`[11za] List menu sent to ${phoneNumber}`);

      return {
        success: true,
        messageId: response.data.messageId || response.data.id,
        recipient: phoneNumber,
      };
    } catch (error) {
      console.error('[11za] Error sending list menu:', error.message);
      return {
        success: false,
        error: error.message,
        recipient: phoneNumber,
      };
    }
  }

  /**
   * Send quick reply buttons
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} message - Message text
   * @param {array} buttons - Array of {title, id} objects
   * @returns {Promise<Object>} 11za API response
   */
  async sendQuickReply(phoneNumber, message, buttons = []) {
    try {
      if (!this.apiKey || !this.phoneId) {
        throw new Error('11za credentials not configured');
      }

      console.log(`[11za] Sending quick reply to ${phoneNumber}`);

      const payload = {
        sendto: phoneNumber,
        authToken: this.apiKey,
        originWebsite: this.originWebsite,
        contentType: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: message,
          },
          action: {
            buttons: buttons.map((btn, idx) => ({
              type: 'reply',
              reply: {
                id: btn.id || `btn_${idx}`,
                title: btn.title,
              },
            })),
          },
        },
      };

      const response = await axios.post(`${this.baseURL}/whatsapp/sendMessage`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      console.log(`[11za] Quick reply sent to ${phoneNumber}`);

      return {
        success: true,
        messageId: response.data.messageId || response.data.id,
        recipient: phoneNumber,
      };
    } catch (error) {
      console.error('[11za] Error sending quick reply:', error.message);
      return {
        success: false,
        error: error.message,
        recipient: phoneNumber,
      };
    }
  }

  /**
   * Send appointment confirmation message
   * @param {string} phoneNumber - Patient's phone number
   * @param {object} appointmentDetails - {date, time, doctorName, location}
   * @param {string} language - Response language (en, hi, hinglish)
   * @returns {Promise<Object>} 11za API response
   */
  async sendAppointmentConfirmation(phoneNumber, appointmentDetails, language = 'hinglish') {
    try {
      const { date, time, doctorName, location, treatment } = appointmentDetails;

      const messages = {
        en: `✅ APPOINTMENT CONFIRMED\n\nDoctor: ${doctorName}\nDate: ${date}\nTime: ${time}\nLocation: ${location}\nTreatment: ${treatment}\n\nPlease arrive 10 minutes early.`,
        hi: `✅ अपॉइंटमेंट की पुष्टि हुई\n\nडॉक्टर: ${doctorName}\nदिनांक: ${date}\nसमय: ${time}\nस्थान: ${location}\nउपचार: ${treatment}\n\nकृपया 10 मिनट पहले पहुंचें।`,
        hinglish: `✅ APPOINTMENT CONFIRM HO GIYA\n\nDoctor: ${doctorName}\nDate: ${date}\nTime: ${time}\nLocation: ${location}\nTreatment: ${treatment}\n\nKripya 10 min pehle aa jaana.`,
      };

      const confirmationMessage = messages[language] || messages.en;

      return await this.sendTextMessage(phoneNumber, confirmationMessage);
    } catch (error) {
      console.error('[11za] Error sending confirmation:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send slot options as formatted message
   * @param {string} phoneNumber - User's phone number
   * @param {array} slots - Array of {id, time12, time24, date}
   * @param {string} language - Response language
   * @returns {Promise<Object>} 11za API response
   */
  async sendSlotOptions(phoneNumber, slots, language = 'hinglish') {
    try {
      // Format slots as numbered options
      const slotMessages = slots.map((slot, idx) => `${idx + 1}. ${slot.time12}`).join('\n');

      const messages = {
        en: `Available appointment slots:\n\n${slotMessages}\n\nReply with the slot number (1, 2, etc.) to book.`,
        hi: `उपलब्ध अपॉइंटमेंट स्लॉट:\n\n${slotMessages}\n\nबुकिंग के लिए स्लॉट नंबर (1, 2, आदि) दें।`,
        hinglish: `Available slots:\n\n${slotMessages}\n\nSlot number bhejo (1, 2, etc.)`,
      };

      const slotMessage = messages[language] || messages.en;

      return await this.sendTextMessage(phoneNumber, slotMessage);
    } catch (error) {
      console.error('[11za] Error sending slots:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send media (image, video, document)
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} mediaUrl - URL of the media
   * @param {string} mediaType - 'image', 'video', 'document'
   * @param {string} caption - Optional caption
   * @returns {Promise<Object>} 11za API response
   */
  async sendMedia(phoneNumber, mediaUrl, mediaType = 'image', caption = '') {
    try {
      if (!this.apiKey || !this.phoneId) {
        throw new Error('11za credentials not configured');
      }

      console.log(`[11za] Sending ${mediaType} to ${phoneNumber}`);

      const payload = {
        sendto: phoneNumber,
        authToken: this.apiKey,
        originWebsite: this.originWebsite,
        contentType: mediaType,
        [mediaType]: {
          url: mediaUrl,
          caption: caption,
        },
      };

      const response = await axios.post(`${this.baseURL}/whatsapp/sendMessage`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      console.log(`[11za] Media sent to ${phoneNumber}`);

      return {
        success: true,
        messageId: response.data.messageId || response.data.id,
        recipient: phoneNumber,
      };
    } catch (error) {
      console.error('[11za] Error sending media:', error.message);
      return {
        success: false,
        error: error.message,
        recipient: phoneNumber,
      };
    }
  }

  /**
   * Mark message as read
   * @param {string} messageId - 11za message ID
   * @returns {Promise<Object>} Status
   */
  async markAsRead(messageId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/whatsapp/markAsRead`,
        { messageId },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 5000,
        }
      );

      return { success: true, messageId };
    } catch (error) {
      console.error('[11za] Error marking as read:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ElevenLabsSendService();
