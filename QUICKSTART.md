# Quick Start Guide - WhatsApp Appointment Bot

This guide will get you up and running in under 30 minutes.

## 5-Minute Setup

### Step 1: Install Dependencies (2 min)

```bash
npm install
```

### Step 2: Create Environment File (1 min)

```bash
cp .env.example .env
```

### Step 3: Add Google Credentials (2 min)

Get your Google Service Account credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Google Calendar API"
4. Go to "Service Accounts" → Create Service Account
5. Generate JSON key
6. Copy the following values to `.env`:
   - `GOOGLE_PROJECT_ID`: from JSON `project_id`
   - `GOOGLE_CLIENT_EMAIL`: from JSON `client_email`
   - `GOOGLE_PRIVATE_KEY`: from JSON `private_key` (include quotes and newlines)

**Example:**
```env
GOOGLE_PROJECT_ID=my-project-123456
GOOGLE_CLIENT_EMAIL=bot@my-project-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n"
```

### Step 4: Setup Google Calendar (1 min)

1. Get your Google Calendar ID (usually your email)
2. Add to `.env`:
   ```env
   GOOGLE_CALENDAR_ID=your-email@gmail.com
   ```
3. Share the calendar with your service account email

## Run the Server

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

You should see:
```
✅ Server running on http://localhost:3000
📱 WhatsApp Appointment Bot is ready to accept webhooks
🔗 Webhook endpoint: http://localhost:3000/webhook/user-action
```

## Test Without 11za

Use Postman or curl to test endpoints:

### Test Health Check
```bash
curl http://localhost:3000/health
```

### Test Available Slots
```bash
curl "http://localhost:3000/api/get-available-slots?date=2026-03-25"
```

### Test Webhook (Simulate User Saying "Hi")
```bash
curl -X POST http://localhost:3000/webhook/user-action \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+1234567890",
    "text": {"body": "Hi"}
  }'
```

### Test Booking
```bash
curl -X POST http://localhost:3000/api/confirm-booking \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "date": "2026-03-25",
    "time": "10:00",
    "userName": "John Doe"
  }'
```

## Connect to 11za

1. Sign up at [11za Chatbot](https://11labs.com)
2. Create a WhatsApp Bot
3. Get API Token and Phone ID
4. Add to `.env`:
   ```env
   ELEVENLABS_TOKEN=your_token_here
   ELEVENLABS_PHONE_ID=your_phone_id_here
   ```
5. In 11za Dashboard, set Webhook URL to:
   ```
   https://your-app-url.com/webhook/user-action
   ```

## Quick Reference

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# 11za Chatbot
ELEVENLABS_TOKEN=sk-...
ELEVENLABS_PHONE_ID=120...
ELEVENLABS_WEBHOOK_SECRET=secret123

# Google Calendar
GOOGLE_PROJECT_ID=my-project
GOOGLE_PRIVATE_KEY="-----BEGIN..."
GOOGLE_CLIENT_EMAIL=service@project.iam.gserviceaccount.com
GOOGLE_CALENDAR_ID=user@gmail.com

# Supabase (Optional)
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=key_...
SUPABASE_SERVICE_KEY=key_...

# Business Settings
APPOINTMENT_SLOT_DURATION=30       # minutes
OFFICE_HOURS_START=10              # 10 AM
OFFICE_HOURS_END=18                # 6 PM
```

## Troubleshooting

### "Cannot GET /health"
- Server not running. Use `npm run dev`

### "Google Calendar connection failed"
- Check `GOOGLE_PRIVATE_KEY` format (must include `\n` between lines)
- Verify calendar is shared with service account email
- Check `GOOGLE_CALENDAR_ID` is correct

### "No available slots returned"
- Verify office hours in `.env` match expected times
- Check calendar for conflicting events
- Ensure date is in the future

### "Webhook not receiving messages"
- Verify webhook URL is publicly accessible
- Check 11za Dashboard for logs
- Ensure `ELEVENLABS_PHONE_ID` is correct

## Next Steps

1. **Add Database Support** (Optional)
   - Set up Supabase account
   - Run `database-schema.sql`
   - Add Supabase credentials to `.env`

2. **Deploy to Production**
   - Heroku: `git push heroku main`
   - AWS Lambda: Use SAM CLI
   - Docker: `docker build -t bot . && docker run -p 3000:3000 bot`

3. **Customize Behavior**
   - Edit `src/controllers/appointmentController.js`
   - Modify slot calculation in `src/services/googleCalendarService.js`
   - Update 11za message templates

4. **Monitor & Debug**
   - Check logs: `npm run dev > logs.txt`
   - Use Postman collection: `postman-collection.json`
   - Check Google Calendar for created events

## Common Customizations

### Change Slot Duration to 60 Minutes
```env
APPOINTMENT_SLOT_DURATION=60
```

### Change Work Hours to 9 AM - 5 PM
```env
OFFICE_HOURS_START=9
OFFICE_HOURS_END=17
```

### Disable Database (Testing Only)
- Comment out Supabase credentials in `.env`
- Appointments won't be persisted

## API Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/user-action` | Receive messages from 11za |
| GET | `/api/get-available-slots?date=YYYY-MM-DD` | List available slots |
| POST | `/api/confirm-booking` | Create appointment |
| GET | `/api/doctor-report` | Recent appointments (last 2h) |
| POST | `/api/reschedule` | Change appointment time |
| POST | `/api/cancel` | Cancel appointment |
| GET | `/api/appointment/:phone` | Get appointment details |

## Help & Support

- 📖 Full Documentation: See `README.md`
- 🐛 Issues: Check troubleshooting section
- 💬 Questions: Review API documentation in `README.md`
- 📧 Contact: Check 11za and Google Cloud documentation

---

**You're ready to go!** Start with `npm run dev` and test with the curl examples above.
