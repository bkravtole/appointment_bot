const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Audio Service
 * Handles audio transcription using OpenAI Whisper API
 */

class AudioService {
  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Download audio file from URL and transcribe it
   * @param {string} audioUrl - URL of the audio file from 11za
   * @param {string} language - Audio language (en, hi, or auto-detect)
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudioFromUrl(audioUrl, language = null) {
    try {
      if (!this.openaiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Download audio file
      console.log('Downloading audio from:', audioUrl);
      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      // Save temporarily
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `audio-${Date.now()}.ogg`);
      fs.writeFileSync(tempFilePath, audioResponse.data);

      console.log('Audio saved to:', tempFilePath);

      // Transcribe using Whisper
      const transcript = await this.transcribeFile(tempFilePath, language);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      return transcript;
    } catch (error) {
      console.error('Error transcribing audio from URL:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio file using Whisper API
   * @param {string} filePath - Path to audio file
   * @param {string} language - Language code (optional)
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeFile(filePath, language = null) {
    try {
      if (!this.openaiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      const audioStream = fs.createReadStream(filePath);

      const form = new FormData();
      form.append('file', audioStream);
      form.append('model', 'whisper-1');
      if (language) {
        form.append('language', language); // e.g., 'hi' for Hindi, 'en' for English
      }

      console.log('Sending to Whisper API...');
      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${this.openaiKey}`,
        },
        timeout: 120000, // 2 minutes for long audio
      });

      const transcript = response.data.text;
      console.log('Transcription successful:', transcript);

      return transcript;
    } catch (error) {
      console.error('Error in transcribeFile:', error.message);
      throw error;
    }
  }

  /**
   * Process audio from 11za webhook
   * Handles both audio URL and direct audio file
   * @param {object} webhookData - Data from 11za webhook
   * @returns {Promise<string>} Transcribed text
   */
  async processAudioWebhook(webhookData) {
    try {
      // Check for audio URL in webhook data
      if (webhookData.audio?.url) {
        return await this.transcribeAudioFromUrl(webhookData.audio.url, webhookData.language);
      }

      if (webhookData.audio_url) {
        return await this.transcribeAudioFromUrl(webhookData.audio_url, webhookData.language);
      }

      throw new Error('No audio URL found in webhook data');
    } catch (error) {
      console.error('Error processing audio webhook:', error);
      throw error;
    }
  }
}

module.exports = new AudioService();
