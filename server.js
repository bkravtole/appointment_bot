require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const webhookRoutes = require('./src/routes/webhookRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const aiRoutes = require('./src/routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Middleware Configuration
 */

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Route Registration
 */

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'WhatsApp Appointment Bot',
  });
});

// 11za Webhook endpoints
app.use('/webhook', webhookRoutes);

// REST API endpoints
app.use('/api', appointmentRoutes);

// AI endpoints
app.use('/api/ai', aiRoutes);

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
});

/**
 * Error Handler
 */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
  });
});

/**
 * Start Server
 */
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📱 WhatsApp Appointment Bot is ready to accept webhooks`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhook/user-action`);
  console.log(`📊 API endpoint: http://localhost:${PORT}/api`);
  console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
