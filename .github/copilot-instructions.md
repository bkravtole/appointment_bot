# WhatsApp Appointment Bot - Copilot Instructions

This workspace contains a complete WhatsApp appointment booking system using 11za Chatbot and Google Calendar.

## Project Overview

- **Type**: Node.js + Express Backend
- **Purpose**: Automate appointment booking via WhatsApp
- **Integrations**: Google Calendar API, 11za Chatbot, Supabase Database

## Key Technologies

- **Runtime**: Node.js v14+
- **Framework**: Express.js
- **APIs**: Google Calendar API, 11za Chatbot API
- **Database**: Supabase/PostgreSQL (optional)
- **Environment**: Configured via `.env` file

## Code Structure

```
src/
├── controllers/      # Business logic
├── services/         # External API integrations
├── routes/          # Express route handlers
└── config/          # Configuration files

Key Files:
- server.js                    - Main Express server
- googleCalendarService.js     - Calendar API operations
- appointmentController.js     - Appointment logic
- webhookRoutes.js           - 11za webhook handlers
- appointmentRoutes.js       - REST API endpoints
```

## Common Tasks

### Adding a New Feature

1. **Create endpoint in routes** (e.g., `appointmentRoutes.js`)
2. **Add logic in controller** (e.g., `appointmentController.js`)
3. **Use services as needed** (Google Calendar, Database, 11za)
4. **Test with curl or Postman**

### Modifying Slot Calculation

1. Edit `src/services/googleCalendarService.js`
2. Update `getAvailableSlots()` method
3. Adjust algorithm or filtering logic
4. Test with: `curl "http://localhost:3000/api/get-available-slots?date=2026-03-25"`

### Changing WhatsApp Messages

1. Edit `src/controllers/appointmentController.js`
2. Find the relevant method (e.g., `handleBookingFlow()`)
3. Update `elevenLabsService.send*()` calls
4. Test via webhook or 11za dashboard

## Environment Setup

Before running:

```bash
cp .env.example .env
# Add credentials to .env
npm install
npm run dev
```

Required environment variables:
- `GOOGLE_PRIVATE_KEY` - From Google Service Account
- `GOOGLE_CLIENT_EMAIL` - Service account email
- `GOOGLE_CALENDAR_ID` - Target calendar ID
- `ELEVENLABS_TOKEN` - 11za API token (optional)
- `ELEVENLABS_PHONE_ID` - 11za phone ID (optional)

## API Endpoints

### Webhooks (from 11za)
- `POST /webhook/user-action` - Receives user messages and clicks
- `GET /webhook/status` - Health check

### REST API
- `GET /api/get-available-slots?date=YYYY-MM-DD` - List slots
- `POST /api/confirm-booking` - Create appointment
- `GET /api/doctor-report` - Recent appointments
- `POST /api/reschedule` - Reschedule appointment
- `POST /api/cancel` - Cancel appointment
- `GET /api/appointment/:phone` - Get appointment details

## Database Schema

Optional Supabase setup:

```sql
-- Main table
CREATE TABLE appointments (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE,
  event_id VARCHAR(255),
  user_name VARCHAR(255),
  appointment_time TIMESTAMP,
  status VARCHAR(50)
);
```

Full schema in `database-schema.sql`

## Debugging

### Enable Detailed Logging

```javascript
// In any service file
console.log('Variable:', variable);
```

### Test Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Get slots
curl "http://localhost:3000/api/get-available-slots?date=2026-03-25"

# Test webhook
curl -X POST http://localhost:3000/webhook/user-action \
  -H "Content-Type: application/json" \
  -d '{"from":"+1234567890","text":{"body":"Hi"}}'
```

### Check Server Logs

```bash
npm run dev  # Shows all console.log() output
```

## Important Notes

- **Secrets**: Never commit `.env` file with real credentials
- **Credentials**: Store Google keys securely
- **Rate Limits**: Google Calendar API has quotas
- **Timezone**: All times are in UTC by default
- **Slot Duration**: Configurable via `APPOINTMENT_SLOT_DURATION`

## Common Issues & Solutions

1. **"Cannot find module"** - Run `npm install`
2. **"Google Calendar connection failed"** - Check service account credentials
3. **"No slots available"** - Verify calendar events and office hours
4. **"Webhook not working"** - Ensure URL is publicly accessible

## Development Workflow

1. Make code changes
2. Server auto-restarts with `npm run dev`
3. Test with curl/Postman
4. Check logs in terminal
5. Commit changes (avoid `.env` file)

## Useful Files to Review

- `README.md` - Full documentation
- `QUICKSTART.md` - 5-minute setup guide
- `postman-collection.json` - API tests
- `database-schema.sql` - Database structure
- `.env.example` - Environment template

## Next Steps

- [ ] Set up .env with credentials
- [ ] Run `npm install && npm run dev`
- [ ] Test endpoints with curl/Postman
- [ ] Connect 11za webhook
- [ ] (Optional) Set up Supabase database
- [ ] Deploy to production

---

**Start**: Run `npm run dev` and visit `http://localhost:3000/health`
