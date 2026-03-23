# Deployment Workflow - WhatsApp → AI → Response

## Complete Message Flow (Step by Step)

### When User Sends Message on WhatsApp:

```
User WhatsApp
   ↓
[Message sent via WhatsApp]
   ↓
11za WhatsApp Gateway (receives message)
   ↓
11za forwarding (sends HTTP webhook to your server)
   ↓
Your Server: POST /api/ai/11za-webhook
   ├─ Extract phone number
   ├─ Extract message text (or audio URL)
   ↓
AI Processing (aiController)
   ├─ Transcribe audio if needed (audioService)
   ├─ Extract intent using Gemini/OpenAI (aiService)
   ├─ Get conversation history from DB (contextService)
   ├─ Find available slots (googleCalendarService)
   ├─ Generate response with AI (aiService)
   ↓
Auto-Send Response (elevenLabsSendService) ✨ NEW!
   ├─ Call 11za SendMessage API
   ├─ Format message for WhatsApp
   ├─ Send slots/confirmation/etc
   ↓
11za WhatsApp Gateway
   ├─ Receives API request to send message
   ├─ Sends via WhatsApp servers
   ↓
User WhatsApp
   └─ Message arrives! ✅
```

---

## Code Flow Diagram

### Current Architecture (After Update)

```
┌──────────────────────────────────────────────────────────────┐
│                     11za Webhook                              │
│              POST /api/ai/11za-webhook                        │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ↓
┌──────────────────────────────────────────────────────────────┐
│            elevenLabsService (Parse)                          │
│    • getPhoneNumberFromWebhook()                              │
│    • Extract message/audio                                    │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ↓ (if audio)
┌──────────────────────────────────────────────────────────────┐
│            audioService (Transcribe)                          │
│    • transcribeAudioFromUrl() → Whisper API                   │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ↓
┌──────────────────────────────────────────────────────────────┐
│    aiController.processMessage()                              │
│    • Route to appropriate intent handler                      │
└───────────────────┬──────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬───────────┐
        ↓           ↓           ↓           ↓
   BOOK intent  QUERY intent CANCEL intent CONFIRM intent
        │           │           │           │
        ├─→ Find Slots      Show All   Delete    Confirm Booking
        │   (Google Calendar) Slots    (DB)      (Google Cal + DB)
        │
        ↓
┌──────────────────────────────────────────────────────────────┐
│    aiService (Generate Response)                              │
│    • Create natural language response in user language        │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ↓
┌──────────────────────────────────────────────────────────────┐
│    elevenLabsSendService (SEND) ← NEW! ✨                     │
│    • sendTextMessage()     → 11za API                         │
│    • sendSlotOptions()     → 11za API                         │
│    • sendQuickReply()      → 11za API                         │
│    • sendAppointmentConfirmation() → 11za API                 │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ↓
┌──────────────────────────────────────────────────────────────┐
│        11za SendMessage API                                   │
│    POST https://api.11za.in/api/v1/whatsapp/sendMessage      │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ↓
┌──────────────────────────────────────────────────────────────┐
│        11za WhatsApp Gateway                                  │
│        (Pushes message to WhatsApp servers)                   │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ↓
┌──────────────────────────────────────────────────────────────┐
│   User's WhatsApp Phone                                       │
│   Message Received! ✅                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Real-World Example: Complete Journey

### Example: User Books Appointment

```
TIME: 14:30 → User sends WhatsApp message
=====================================

MESSAGE FROM USER:
"Malaria check krane ke liye kal 3 baje appointment chahiye"

STEP 1: Webhook Reception
──────────────────────────
Web Server receives:
{
  "sendto": "+919876543210",
  "authToken": "11za-token-xyz",
  "text": { "body": "Malaria check krane ke liye kal 3 baje appointment chahiye" }
}

STEP 2: Parse Webhook
─────────────────────
elevenLabsService.getPhoneNumberFromWebhook()
→ Returns: "+919876543210"
→ Message: "Malaria check krane ke liye kal 3 baje appointment chahiye"

STEP 3: AI Processing
─────────────────────
aiController.processMessage(
  "+919876543210",
  "Malaria check krane ke liye kal 3 baje appointment chahiye",
  null,
  "hinglish"
)

    ↓ aiService.extractIntent() + Gemini API
    
    Response from Gemini:
    {
      "intent": "BOOK",
      "date": "2026-03-24",
      "time": "15:00",
      "treatment": "Malaria",
      "confidence": 95
    }

STEP 4: Get Context
───────────────────
contextService.getConversationHistory("+919876543210")
→ Returns: [] (first time user)

contextService.saveMessage()
→ Saves to DB: conversation_context table

STEP 5: Find Slots
──────────────────
googleCalendarService.getAvailableSlots("2026-03-24")

    Query Google Calendar for busy times
    ↓
    Generate slots: 10:00-19:00 in 30-min intervals
    ↓
    Filter: 15:00 (3 PM) is BUSY
            15:30 is FREE
            16:00 is FREE
    ↓
    Return: [
      { id: "2026-03-24-16:00", time12: "04:00 PM", time24: "16:00" },
      { id: "2026-03-24-16:30", time12: "04:30 PM", time24: "16:30" }
    ]

STEP 6: Generate Response
─────────────────────────
aiService.generateResponse({
  intent: "BOOK",
  date: "2026-03-24",
  time: "15:00",
  treatment: "Malaria"
}, slots, "hinglish")

    Gemini API response:
    "आपकी अनुरोधित समय 3 बजे व्यस्त है।
     उपलब्ध समय:
     1. 4:00 PM
     2. 4:30 PM
     
     कौन सा समय ठीक है?"

STEP 7: AUTO-SEND via 11za ✨
────────────────────────────
elevenLabsSendService.sendSlotOptions(
  "+919876543210",
  slots,
  "hinglish"
)

    elevenLabsSendService builds payload:
    {
      "sendto": "+919876543210",
      "authToken": "ELEVENLABS_TOKEN",
      "originWebsite": "https://engees.in",
      "contentType": "text",
      "text": "आपकी अनुरोधित समय 3 बजे व्यस्त है...\n1. 4:00 PM\n2. 4:30 PM"
    }
    
    Calls: 11za API
    POST https://api.11za.in/api/v1/whatsapp/sendMessage
    
    11za Returns:
    {
      "success": true,
      "messageId": "msg_123456",
      "status": "sent"
    }

STEP 8: Message Delivery
────────────────────────
11za receives API call
↓
11za sends via WhatsApp servers
↓
WhatsApp delivers to user

TIME: 14:32 (2 minutes later)
──────────────────────────────
USER RECEIVES ON WHATSAPP:

"आपकी अनुरोधित समय 3 बजे व्यस्त है।
 उपलब्ध समय:
 1. 4:00 PM
 2. 4:30 PM
 
 कौन सा समय ठीक है?"

✅ MESSAGE SUCCESSFULLY DELIVERED!

STEP 9: User Replies
────────────────────
User types: "2"

Webhook fires again with reply:
{
  "sendto": "+919876543210",
  "text": { "body": "2" }
}

STEP 10: AI Processes Reply
───────────────────────────
contextService.getConversationHistory()
→ Returns: [
    { message: "Malaria check...", intent: {...} },
    { message: "2", intent: {...} }
  ]

AI understands context:
"User selected option 2, which is 4:30 PM"

Creates appointment in Google Calendar

STEP 11: Confirmation Sent
──────────────────────────
elevenLabsSendService.sendAppointmentConfirmation()

User receives:
"✅ APPOINTMENT CONFIRMED

Doctor: General Practitioner
Date: 2026-03-24
Time: 04:30 PM
Treatment: Malaria Check
Location: New Delhi

कृपया 10 मिनट पहले पहुंचें 🏥"

JOURNEY COMPLETE! ✅
```

---

## File Structure for Deployment

```
appointment/
├── server.js                      ← Main server (imports aiRoutes)
├── .env                           ← 11za credentials here
│
├── src/
│   ├── services/
│   │   ├── googleCalendarService.js    ← Get/create appointments
│   │   ├── elevenLabsService.js        ← Parse webhook
│   │   ├── elevenLabsSendService.js    ← SEND messages via 11za ✨ NEW
│   │   ├── aiService.js                ← Intent extraction
│   │   ├── audioService.js             ← Audio transcription
│   │   ├── contextService.js           ← Store conversation
│   │   └── supabaseService.js          ← Database
│   │
│   ├── controllers/
│   │   └── aiController.js        ← Route intents
│   │
│   └── routes/
│       ├── aiRoutes.js            ← Routes (UPDATED with auto-send)
│       ├── appointmentRoutes.js
│       └── webhookRoutes.js
│
├── database-schema-ai.sql         ← Supabase tables
├── 11ZA-INTEGRATION.md            ← 11za setup guide
├── .env.example
└── package.json
```

---

## Environment Variables Needed

```env
# Server
PORT=3000
NODE_ENV=production

# Google Calendar
GOOGLE_PROJECT_ID=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_CALENDAR_ID=...

# 11za WhatsApp Integration ← CRITICAL FOR MESSAGE SENDING
ELEVENLABS_TOKEN=your-11za-api-token
ELEVENLABS_PHONE_ID=your-11za-phone-id
ELEVENLABS_ORIGIN_WEBSITE=https://engees.in

# AI
AI_PROVIDER=gemini
GEMINI_API_KEY=your-api-key
OPENAI_API_KEY=your-api-key (optional, for audio)

# Database
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

---

## Deployment on Server

### Step 1: Install on Server
```bash
cd /var/www/appointment
npm install
```

### Step 2: Configure .env
```bash
nano .env
# Add all credentials above
```

### Step 3: Setup 11za Webhook
In 11za Dashboard:
```
Webhook URL: https://your-domain.com/api/ai/11za-webhook
Method: POST
Events: All
```

### Step 4: Start Server
```bash
npm start
# or with PM2:
pm2 start server.js --name "appointment-bot"
```

### Step 5: Test End-to-End
```bash
# Send test WhatsApp message to 11za number
# Message should arrive after 2-3 seconds ✅

# Or test via curl:
curl -X POST https://your-domain.com/api/ai/11za-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "sendto": "+919876543210",
    "text": {"body": "Test message"}
  }'
```

---

## Monitoring & Debugging

### Check Server Logs
```bash
# If using PM2
pm2 logs appointment-bot

# If running directly
npm start
# Watch console output
```

### Check Message Delivery
1. Go to 11za Dashboard → Message History
2. Look for outgoing messages
3. Check delivery status
4. Verify content

### Database Check
```sql
-- Check conversation history
SELECT * FROM conversation_context 
WHERE phone_number = '+919876543210'
ORDER BY created_at DESC
LIMIT 10;

-- Check appointments
SELECT * FROM appointments 
WHERE phone_number = '+919876543210';
```

---

## Troubleshooting Deployment

### Issue: Messages not sending
```bash
# Check if elevenLabsSendService is imported
grep "elevenLabsSendService" aiRoutes.js

# Check 11za credentials in .env
echo $ELEVENLABS_TOKEN

# Test 11za API directly
curl -X POST https://api.11za.in/api/v1/whatsapp/sendMessage \
  -H "Content-Type: application/json" \
  -d '{
    "sendto": "+919876543210",
    "authToken": "YOUR_TOKEN",
    "contentType": "text",
    "text": "Test message"
  }'
```

### Issue: High latency (response >10 seconds)
- Check AI API response time (Gemini vs OpenAI)
- Implement caching for common queries
- Optimize database queries
- Add load balancing if traffic is high

### Issue: Webhook not receiving messages
- Verify webhook URL in 11za dashboard
- Check SSL certificate
- Ensure server is running
- Test with curl first
- Check 11za logs

---

## Performance Optimization

### Caching
```javascript
// Cache intent extraction for same message
const cache = new Map();
if (cache.has(message)) {
  return cache.get(message);
}
```

### Batch Processing
```javascript
// Handle multiple concurrent users
// Node.js handles this automatically with async/await
```

### Database Optimization
```sql
-- Add indexes for faster queries
CREATE INDEX idx_phone_created ON conversation_context(phone_number, created_at);
CREATE INDEX idx_phone_state ON conversation_context(phone_number, state);
```

---

## Production Checklist

- [ ] All environment variables configured in .env
- [ ] 11za webhook URL updated to production domain
- [ ] 11za API credentials verified (working)
- [ ] Database tables created (conversation_context, etc.)
- [ ] Google Calendar API working
- [ ] Gemini/OpenAI API keys configured
- [ ] Server running on port 3000 or configured port
- [ ] PM2 or systemd service configured for auto-restart
- [ ] SSL/HTTPS enabled
- [ ] Rate limiting configured
- [ ] Error logging setup
- [ ] Database backups scheduled
- [ ] Monitoring alerts configured

---

## Success Verification

### Test Workflow
1. Send WhatsApp message to 11za number
2. Wait 2-3 seconds
3. Response should arrive
4. Check console logs for "Message sent successfully"

### Expected Response
```
[11za] Sending message to +919876543210: Available slots...
[11za] Message sent successfully to +919876543210
```

---

**Your bot is ready for production!** 🚀

Messages now flow: WhatsApp → Server → AI → 11za API → WhatsApp ✅
