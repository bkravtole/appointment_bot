/**
 * 11za Webhook Service
 * Handles incoming webhook data from 11za Chatbot
 * Note: Message sending is handled within your 11za chatbot flows,
 * this service only parses incoming webhook data
 */

class ElevenLabsService {
  constructor() {
    this.token = process.env.ELEVENLABS_TOKEN;
    this.webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  }

  /**
   * Verify webhook signature from 11za (if enabled)
   * @param {string} body - Request body
   * @param {string} signature - X-Hub-Signature header
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(body, signature) {
    // Implement 11za webhook signature verification
    // This depends on 11za's security mechanism
    if (!this.webhookSecret) {
      console.log('No webhook secret configured, skipping verification');
      return true;
    }
    console.log('Webhook signature verification - implement based on 11za specs');
    return true; // TODO: Implement actual verification
  }

  /**
   * Extract phone number from 11za webhook payload
   * @param {Object} webhookData - Incoming webhook data
   * @returns {string|null} Phone number or null
   */
  getPhoneNumberFromWebhook(webhookData) {
    return webhookData.from || webhookData.sender?.id || null;
  }

  /**
   * Extract message/button data from 11za webhook
   * @param {Object} webhookData - Incoming webhook data
   * @returns {Object} Extracted data with type and content
   */
  parseWebhookData(webhookData) {
    // Text message
    if (webhookData.text?.body) {
      return {
        type: 'text',
        content: webhookData.text.body,
      };
    }

    // Button click
    if (webhookData.interactive?.button_reply?.id) {
      return {
        type: 'button',
        content: webhookData.interactive.button_reply.id,
      };
    }

    // List selection
    if (webhookData.interactive?.list_reply?.id) {
      return {
        type: 'list',
        content: webhookData.interactive.list_reply.id,
      };
    }

    return {
      type: 'unknown',
      content: null,
    };
  }
}

module.exports = new ElevenLabsService();
