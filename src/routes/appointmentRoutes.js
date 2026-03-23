const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

/**
 * Appointment REST API Routes
 * These endpoints return JSON data for 11za chatbot to use
 */

/**
 * GET /api/get-available-slots
 * Fetch available 30-minute slots for a specified date
 * Query params: date (YYYY-MM-DD)
 * Returns: { slots: [ { time: "HH:MM", date: "YYYY-MM-DD" } ] }
 */
router.get('/get-available-slots', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // Validate date is in the future
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return res.status(400).json({
        success: false,
        error: 'Cannot book appointments in the past',
      });
    }

    const result = await appointmentController.getAvailableSlots(date);
    res.json(result);
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/confirm-booking
 * Create an appointment in Google Calendar
 * Body: { phoneNumber, date, time, userName }
 * Returns: Confirmation with appointment details
 */
router.post('/confirm-booking', async (req, res) => {
  try {
    const { phoneNumber, date, time, userName } = req.body;

    // Validate required fields
    if (!phoneNumber || !date || !time ) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: phoneNumber, date, time',
      });
    }
    const result = await appointmentController.confirmBooking(phoneNumber, date, time, userName);
    res.json(result);
  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/doctor-report
 * Fetch all appointments from the last 2 hours
 * Returns: { totalAppointments, appointments: [ { patientName, date, time } ] }
 */
router.get('/doctor-report', async (req, res) => {
  try {
    const result = await appointmentController.getDoctorReport();
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/reschedule
 * Reschedule an existing appointment
 * Body: { phoneNumber, date, time }
 * Returns: Updated appointment details
 */
router.post('/reschedule', async (req, res) => {
  try {
    const { phoneNumber, date, time } = req.body;

    if (!phoneNumber || !date || !time) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: phoneNumber, date, time',
      });
    }

    const result = await appointmentController.rescheduleAppointment(phoneNumber, date, time);
    res.json(result);
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/cancel
 * Cancel an existing appointment
 * Body: { phoneNumber }
 * Returns: Cancellation confirmation
 */
router.post('/cancel', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: phoneNumber',
      });
    }

    const result = await appointmentController.cancelAppointment(phoneNumber);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/appointment/:phoneNumber
 * Fetch appointment details for a specific phone number
 * Returns: Appointment details
 */
router.get('/appointment/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const result = await appointmentController.getAppointmentDetails(phoneNumber);
    res.json(result);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
