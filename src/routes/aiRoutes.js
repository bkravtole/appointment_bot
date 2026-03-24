const express = require('express');
const aiController = require('../controllers/aiController');

const router = express.Router();


/**
 * POST /api/ai/process-message
 * Process a user message with AI intent extraction
 * 
 * Body:
 * {
 *   "phoneNumber": "+91XXXXXXXXXX",
 *   "message": "Doctor ko kab dikhana hai",
 *   "audioUrl": "https://...", (optional)
 *   "language": "hinglish" (en, hi, hinglish)
 * }
 */
router.post('/process-message', async (req, res) => {
  try {
    const { phoneNumber, message, audioUrl, language = 'en' } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber is required',
      });
    }

    const result = await aiController.processMessage(
      phoneNumber,
      message,
      audioUrl,
      language
    );

    res.json(result);
  } 
  catch (error) {
    console.error('Error in /process-message:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }

})
/**
 * GET /api/ai/conversation/:phoneNumber
 * Fetch conversation history for a user
 */
router.get('/conversation/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    const result = await aiController.getConversationHistory(phoneNumber);
    res.json(result);
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/transcribe
 * Transcribe audio from URL using Whisper API
 * 
 * Body:
 * {
 *   "audioUrl": "https://...",
 *   "language": "hi" (optional)
 * }
 */
router.post('/transcribe', async (req, res) => {
  try {
    const { audioUrl, language } = req.body;

    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'audioUrl is required',
      });
    }

    const audioService = require('../services/audioService');
    const transcript = await audioService.transcribeAudioFromUrl(audioUrl, language);

    res.json({
      success: true,
      audioUrl,
      transcript,
    });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
