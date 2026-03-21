# WhatsApp Appointment Bot with 11za & Google Calendar

A complete backend system for automating appointment booking via WhatsApp using 11za Chatbot and Google Calendar integration.

## Features

- 📱 **WhatsApp Integration** - Direct messaging via 11za Chatbot
- 📅 **Google Calendar Sync** - Real-time availability and smart slot calculation
- 🔄 **Reschedule Support** - Users can easily reschedule appointments
- 📊 **Doctor Reports** - View recent appointments from the last 2 hours
- 💾 **Database Integration** - Supabase/PostgreSQL for appointment tracking
- ⚡ **Stateless API** - Scalable Node.js + Express backend
- 🔐 **Secure Webhooks** - Handle incoming messages from 11za

## Project Structure

```
whatsapp-appointment-bot/
├── src/
│   ├── controllers/
│   │   └── appointmentController.js    # Business logic for appointments
│   ├── services/
│   │   ├── googleCalendarService.js   # Google Calendar API integration
│   │   ├── elevenLabsService.js       # 11za API integration
│   │   └── supabaseService.js         # Database operations
│   ├── routes/
│   │   ├── webhookRoutes.js           # 11za webhook handlers
│   │   └── appointmentRoutes.js       # REST API endpoints
│   ├── config/
│   └── database/
├── server.js                           # Express server setup
├── package.json                        # Dependencies
├── .env.example                        # Environment variables template
└── README.md
```

## Installation

### Prerequisites

- Node.js v14+ and npm
- Google Cloud project with Calendar API enabled
- 11za Chatbot account with API access
- Supabase account (or PostgreSQL database)

### Step 1: Clone & Install Dependencies

```bash
cd whatsapp-appointment-bot
npm install
```

### Step 2: Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3000
NODE_ENV=development

# 11za Configuration
ELEVENLABS_TOKEN=your_11za_api_token
ELEVENLABS_PHONE_ID=your_11za_phone_id
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret

# Google Calendar Configuration
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Business Configuration
APPOINTMENT_SLOT_DURATION=30
OFFICE_HOURS_START=10
OFFICE_HOURS_END=18
```

### Step 3: Setup Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "Google Calendar API"
4. Create a Service Account
5. Generate and download JSON key file
6. Extract `private_key` and `client_email` from the JSON file
7. Share a Google Calendar with the service account email

### Step 4: Setup Supabase Database (Optional)

Create a `public.appointments` table:

```sql
CREATE TABLE appointments (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  appointment_time TIMESTAMP,
  status VARCHAR(50) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_phone_number ON appointments(phone_number);
CREATE INDEX idx_event_id ON appointments(event_id);
```

### Step 5: Configure 11za Webhook

1. Log in to your 11za Chatbot dashboard
2. Set Webhook URL to: `https://your-domain.com/webhook/user-action`
3. (Optional) Set webhook secret in `.env`

## Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:3000`

## API Documentation

### Webhook Endpoints

#### POST `/webhook/user-action`
Receives user messages and interactions from 11za Chatbot.

**Example Payload:**
```json
{
  "from": "+1234567890",
  "text": {
    "body": "Hi, I want to book an appointment"
  },
  "interactive": {
    "button_reply": {
      "id": "book_appointment"
    }
  }
}
```

### REST API Endpoints

#### GET `/api/get-available-slots?date=YYYY-MM-DD`
Fetch available 30-minute slots for a date.

**Response:**
```json
{
  "date": "2026-03-25",
  "totalSlots": 12,
  "slots": [
    {
      "time": "10:00",
      "startDateTime": "2026-03-25T10:00:00.000Z",
      "endDateTime": "2026-03-25T10:30:00.000Z"
    }
  ]
}
```

#### POST `/api/confirm-booking`
Create a new appointment in Google Calendar.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "date": "2026-03-25",
  "time": "10:00",
  "userName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "abc123xyz",
  "title": "Appointment - John Doe",
  "startTime": "2026-03-25T10:00:00.000Z",
  "endTime": "2026-03-25T10:30:00.000Z"
}
```

#### GET `/api/doctor-report`
Fetch all appointments from the last 2 hours.

**Response:**
```json
{
  "timestamp": "2026-03-21T15:30:00.000Z",
  "timeRange": "Last 2 hours",
  "totalAppointments": 3,
  "appointments": [
    {
      "id": "event123",
      "patientName": "Appointment - John Doe",
      "startTime": "2026-03-21T14:00:00Z",
      "endTime": "2026-03-21T14:30:00Z"
    }
  ]
}
```

#### POST `/api/reschedule`
Reschedule an existing appointment.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "date": "2026-03-26",
  "time": "14:00"
}
```

#### POST `/api/cancel`
Cancel an existing appointment.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

#### GET `/api/appointment/:phoneNumber`
Fetch appointment details by phone number.

**Response:**
```json
{
  "success": true,
  "appointment": {
    "phoneNumber": "+1234567890",
    "userName": "John Doe",
    "appointmentTime": "2026-03-25T10:00:00.000Z",
    "eventId": "abc123xyz",
    "status": "confirmed"
  }
}
```

## Conversation Flow

### User Books an Appointment

```
User: "Hi"
Bot: "Hello! How can I help you?"
     [📅 Book] [🔄 Reschedule] [📊 Report]

User: Clicks "Book"
Bot: Displays available dates (next 7 days)

User: Selects a date
Bot: Displays available time slots

User: Selects a time
Bot: ✅ Appointment Confirmed!
     [🔄 Reschedule] [❌ Cancel]
```

## Slot Calculation Algorithm

1. **Fetch Busy Times** - Query Google Calendar freeBusy for the selected date
2. **Generate Slots** - Create 30-minute intervals between office hours (10 AM - 6 PM)
3. **Filter Overlaps** - Remove slots that overlap with busy periods
4. **Format Output** - Return available slots in 11za-compatible format

## Security Considerations

- ✅ Use HTTPS in production
- ✅ Validate 11za webhook signatures
- ✅ Store Google service account key securely
- ✅ Use environment variables for all secrets
- ✅ Enable CORS only for trusted origins
- ✅ Rate limit API endpoints
- ✅ Validate phone numbers and dates

## Troubleshooting

### Google Calendar Connection Issues

```bash
# Verify credentials
node -e "
const service = require('./src/services/googleCalendarService');
console.log('Google Calendar connected');
"
```

### Supabase Connection Issues

```bash
# Test database connection
node -e "
const db = require('./src/services/supabaseService');
db.getAllAppointments().then(console.log).catch(console.error);
"
```

### 11za Webhook Not Receiving Messages

1. Ensure webhook URL is publicly accessible
2. Check 11za dashboard for webhook logs
3. Verify phone ID in `.env`
4. Test with curl:
   ```bash
   curl -X POST http://localhost:3000/webhook/user-action \
     -H "Content-Type: application/json" \
     -d '{"from":"+1234567890","text":{"body":"Test"}}'
   ```

## Development

### Adding a New Endpoint

1. Create handler in `src/controllers/appointmentController.js`
2. Create route in `src/routes/appointmentRoutes.js` or `webhookRoutes.js`
3. Test with curl or Postman

### Modifying Slot Duration

Edit `.env`:
```env
APPOINTMENT_SLOT_DURATION=60  # 60 minutes instead of 30
```

### Changing Office Hours

Edit `.env`:
```env
OFFICE_HOURS_START=9    # 9 AM
OFFICE_HOURS_END=17     # 5 PM
```

## Deployment

### Heroku

```bash
heroku create whatsapp-appointment-bot
git push heroku main
heroku config:set GOOGLE_PRIVATE_KEY="..."
```

### AWS Lambda

Use AWS SAM CLI with API Gateway for webhook URL.

### Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t whatsapp-bot .
docker run -p 3000:3000 --env-file .env whatsapp-bot
```

## Support & Issues

For issues or questions:
1. Check troubleshooting section above
2. Review 11za API documentation
3. Check Google Calendar API limits
4. Enable debug logging in development mode

## License

MIT

## Contributing

Contributions welcome! Please create a pull request with:
- Clear description of changes
- Tests for new features
- Updated documentation

---

**Note**: Update all placeholder values in `.env` before deployment to production.
