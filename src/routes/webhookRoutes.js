const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const aiController = require('../controllers/aiController');
const elevenLabsService = require('../services/elevenLabsService');
const elevenLabsSendService = require('../services/elevenLabsSendService');

/**
 * 11za Webhook Routes
 * These endpoints receive incoming data from 11za Chatbot
 * and return JSON responses for the chatbot to use in flows
 */

/**
 * POST /webhook/user-action
 * Receives user interactions from 11za Chatbot
 * Returns JSON data for 11za to use in chatbot flows
 */
router.post('/user-action', async (req, res) => {
  try {
    const expectedSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
 
    if (expectedSecret) {
      const incomingToken = req.headers['x-api-key'];
 
      if (incomingToken !== expectedSecret) {
        console.error('❌ UNAUTHORIZED: Invalid Webhook Request. Headers mismatch.');
        return res.status(200).send('Unauthorized but acknowledged'); // Returning 200 to prevent retries
      }
    }
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));

    // Extract data from webhook
    const phoneNumber = elevenLabsService.getPhoneNumberFromWebhook(req.body);
    const parsedData = elevenLabsService.parseWebhookData(req.body);

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'No phone number found in webhook data',
      });
    }

    let response = {};

    // Handle different action types
    if (parsedData.content === 'book' || parsedData.content?.toLowerCase() === 'book') {
      // Trigger 11za's booking flow - return action to switch flows
      console.log('📅 Switching to 11za booking flow (69be7fce6e0b91f4ba6a26df)');
      response = {
        success: true,
        action: 'flow',
        flowName: '69be7fce6e0b91f4ba6a26df',  // Your booking flow ID from 11za
        message: 'Let me help you book an appointment...'
      };
    } else if (parsedData.content === 'get_available_slots' || parsedData.content?.startsWith('date_')) {
      // Get available slots for date
      const date = parsedData.content.replace('date_', '');
      response = await appointmentController.getAvailableSlots(date);
    } else if (parsedData.content?.startsWith('slot_')) {
      // Confirm booking for selected time slot
      // Note: You may need to store the selected date in session/context
      const time = parsedData.content.replace('slot_', '').replace(/_/g, ':');
      const date = req.body.selectedDate || new Date().toISOString().split('T')[0];
      response = await appointmentController.confirmBooking(phoneNumber, date, time);
    } else if (parsedData.content === 'get_doctor_report') {
      // Get doctor report
      response = await appointmentController.getDoctorReport();
    } else if (parsedData.content === 'reschedule') {
      // Handle reschedule - would need date/time from request
      if (req.body.newDate && req.body.newTime) {
        response = await appointmentController.rescheduleAppointment(
          phoneNumber,
          req.body.newDate,
          req.body.newTime
        );
      } else {
        response = {
          success: false,
          error: 'newDate and newTime required for reschedule',
        };
      }
    } else if (parsedData.content === 'cancel') {
      // Cancel appointment
      response = await appointmentController.cancelAppointment(phoneNumber);
    } else if (parsedData.content) {
      // Fallback to AI for general text queries
      console.log(`🤖 Fallback to AI for content: "${parsedData.content}"`);
      response = await aiController.processMessage(phoneNumber, parsedData.content);
    } else {
      response = {
        success: true,
        message: 'Webhook received and processed',
        receivedAction: parsedData.content,
      };
    }

    // Step 2: Auto-send response back to WhatsApp via 11za API
    let whatsappDelivery = { success: false };
    
    try {
      if (response.success) {
        let alreadySent = false;

        // In confirmed flow, send only final confirmation message (no slot list echo).
        if (response.intent === 'CONFIRM' && response.message) {
          whatsappDelivery = await elevenLabsSendService.sendTextMessage(
            phoneNumber,
            response.message
          );
          alreadySent = whatsappDelivery.success;
        }

        const slotsToSend = Array.isArray(response.slots) && response.slots.length > 0
          ? response.slots
          : [];

        // Send slot list only for manual slot APIs, not AI booking flow.
        if (!alreadySent && slotsToSend.length > 0) {
          if (response.aiMessage) {
            await elevenLabsSendService.sendTextMessage(phoneNumber, response.aiMessage);
          }
          whatsappDelivery = await elevenLabsSendService.sendSlotOptions(
            phoneNumber,
            slotsToSend,
            'hinglish'
          );
          alreadySent = whatsappDelivery.success;
        } 
        // If there's a confirmation message or AI message, send it
        else if (!alreadySent && (response.message || response.aiMessage)) {
          whatsappDelivery = await elevenLabsSendService.sendTextMessage(
            phoneNumber,
            response.message || response.aiMessage
          );
          alreadySent = whatsappDelivery.success;
        }
        // If it's appointment data, send confirmation
        else if (!alreadySent && response.appointments && Array.isArray(response.appointments)) {
          const apptText = response.appointments
            .map(apt => `📅 ${apt.date} ${apt.time} - ${apt.doctorName || 'Dr.'}`)
            .join('\n');
          whatsappDelivery = await elevenLabsSendService.sendTextMessage(
            phoneNumber,
            apptText || 'Appointment processed successfully'
          );
        }
      } else {
        // Send error message
        whatsappDelivery = await elevenLabsSendService.sendTextMessage(
          phoneNumber,
          `Error: ${response.error || 'Failed to process request'}`
        );
      }
    } catch (sendError) {
      console.error('Error sending WhatsApp message:', sendError);
      whatsappDelivery = {
        success: false,
        error: sendError.message
      };
    }

    // Return JSON response for 11za chatbot flow + delivery confirmation
    res.json({
      ...response,
      whatsappDelivery: {
        success: whatsappDelivery.success,
        messageId: whatsappDelivery.messageId,
        sentVia: '11za API'
      }
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /webhook/status
 * Health check endpoint for 11za to verify webhook is active
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    service: 'WhatsApp Appointment Booking System',
  });
});

module.exports = router;
