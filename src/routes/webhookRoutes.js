const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
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
    if (parsedData.content === 'get_available_slots' || parsedData.content?.startsWith('date_')) {
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
        // If there are available slots, send them formatted
        if (response.slots && Array.isArray(response.slots) && response.slots.length > 0) {
          whatsappDelivery = await elevenLabsSendService.sendSlotOptions(
            phoneNumber,
            response.slots,
            'hinglish'
          );
        } 
        // If there's a confirmation message, send it
        else if (response.message) {
          whatsappDelivery = await elevenLabsSendService.sendTextMessage(
            phoneNumber,
            response.message
          );
        }
        // If it's appointment data, send confirmation
        else if (response.appointments && Array.isArray(response.appointments)) {
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
