# AI Features - Quick Start (5 Minutes)

## Files Created

```
src/
  ├── services/
  │   ├── aiService.js           # Intent extraction & response generation
  │   ├── audioService.js        # Whisper audio transcription
  │   └── contextService.js      # Conversation memory management
  │
  ├── controllers/
  │   └── aiController.js        # Smart slot matching & intent handling
  │
  └── routes/
      └── aiRoutes.js            # API endpoints for AI features

Root/
  ├── .env.example               # Updated with AI configuration
  ├── database-schema-ai.sql     # Supabase tables for AI
  └── AI-SETUP.md                # Complete documentation
```

---

## 30-Second Setup

### 1. Get API Key (1 min)

**Option A: Gemini (Recommended)**
```
Visit: https://ai.google.dev/
Click: "Get API Key"
Copy key to .env: GEMINI_API_KEY=xxxx
```

**Option B: OpenAI (For Audio)**
```
Visit: https://platform.openai.com/api-keys
Create new key
Copy to .env: OPENAI_API_KEY=xxxx
```

### 2. Update .env (30 sec)

```bash
cp .env.example .env

# Edit .env and add:
GEMINI_API_KEY=your-key-here
# OR
OPENAI_API_KEY=your-key-here
```

### 3. Create Database Tables (1 min)

```
1. Go to Supabase → SQL Editor
2. Copy entire content from: database-schema-ai.sql
3. Paste and Execute
```

### 4. Test (1 min)

```bash
npm run dev

# In another terminal:
curl -X POST http://localhost:3000/api/ai/process-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919876543210",
    "message": "Kal shaam book kardo",
    "language": "hinglish"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "intent": "BOOK",
  "date": "2026-03-24",
  "suggestedSlots": [
    {"id": "2026-03-24-16:00", "time12": "04:00 PM", "time24": "16:00"},
    {"id": "2026-03-24-16:30", "time12": "04:30 PM", "time24": "16:30"}
  ],
  "aiMessage": "Your evening slots are ready..."
}
```

---

## 5 Main Features

### 1️⃣ Intent Extraction

User message → AI analyzes → Returns action and parameters

```
Input: "Malaria ke liye kal 3 baje book karo"
         ↓
Output: {
  intent: "BOOK",
  date: "2026-03-24",
  time: "15:00",
  treatment: "Malaria",
  confidence: 95
}
```

### 2️⃣ Voice Support

User sends audio message from 11za → Whisper transcribes → AI processes

```
Audio URL → Whisper API → Text: "Doctor ko kab dikhana hai?"
                           → AI processes as normal
```

### 3️⃣ Smart Slots

If user says "evening", AI suggests 4 PM - 7 PM slots

```
"Sham ka time" → Filter: 16:00-19:00 → Return top 2 available
```

### 4️⃣ Context Memory

AI remembers previous messages for continuity

```
Message 1: "Malaria check"
Message 2: "Kal 5 baje" → AI still remembers "Malaria"
Message 3: "Confirm karo" → Books malaria appointment
```

### 5️⃣ Multilingual

English, Hindi, Hinglish all supported

```
✅ "Doctor ko kab time mill sakta hai?"
✅ "डॉक्टर के लिए स्लॉट बताओ"
✅ "Kal appointment book kara do"
```

---

## Integration with 11za

### Current Flow

```
User WhatsApp → 11za Webhook
              ↓
         POST /api/ai/11za-webhook
              ↓
         AI Processing
              ↓
         Formatted Response
              ↓
         Use this to call: 11za SendMessage API
```

### To Connect to 11za:

In 11za Console → Webhook Settings:
```
URL: https://your-domain.com/api/ai/11za-webhook
Method: POST
Format: JSON
```

When 11za sends message, response includes:
```json
{
  "11zaRequest": {
    "sendto": "+919876543210",
    "text": "Your appointment slots...",
    "contentType": "text"
  }
}
```

Use this to call 11za SendMessage API back.

---

## Test Scenarios

### Scenario 1: Book Appointment

```bash
curl -X POST http://localhost:3000/api/ai/process-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919876543210",
    "message": "Kal health checkup chahiye",
    "language": "hinglish"
  }'
```

Expected: `intent: "BOOK"`, suggestedSlots returned

### Scenario 2: Check Availability

```bash
curl -X POST http://localhost:3000/api/ai/process-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919876543210",
    "message": "Kab khali slots hain?",
    "language": "hinglish"
  }'
```

Expected: `intent: "QUERY"`, available slots listed

### Scenario 3: Cancel Appointment

```bash
curl -X POST http://localhost:3000/api/ai/process-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919876543210",
    "message": "Cancel kardo",
    "language": "hinglish"
  }'
```

Expected: `intent: "CANCEL"`, confirmation message

### Scenario 4: Transcribe Audio

```bash
curl -X POST http://localhost:3000/api/ai/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://11za-audio-url.com/voice.ogg",
    "language": "hi"
  }'
```

Expected: Transcribed text returned

---

## Database Queries

### Check conversation history

```sql
SELECT * FROM conversation_context 
WHERE phone_number = '+919876543210'
ORDER BY created_at DESC
LIMIT 5;
```

### Get user preferences

```sql
SELECT * FROM user_preferences 
WHERE phone_number = '+919876543210';
```

### Clear old conversations (7 days)

```sql
DELETE FROM conversation_context
WHERE created_at < NOW() - INTERVAL '7 days';
```

---

## Troubleshooting Checklist

- [ ] API key is in .env (not .env.example)
- [ ] Database tables created (conversation_context table exists)
- [ ] Node dependencies installed (`npm install`)
- [ ] Server running (`npm run dev`)
- [ ] OPENAI_API_KEY set if using Whisper
- [ ] GEMINI_API_KEY set if using Gemini

---

## Environment Variables Needed

```env
# Required for AI
GEMINI_API_KEY=xxxxx           # For Gemini
OPENAI_API_KEY=xxxxx           # For Whisper, optional for GPT

# Required for database
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=xxxxx

# Existing (keep as-is)
GOOGLE_PROJECT_ID=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_CALENDAR_ID=...
```

---

## Next Steps

1. ✅ Read AI-SETUP.md for detailed docs
2. ✅ Test all 5 features with curl commands
3. ✅ Connect to 11za webhook
4. ✅ Monitor conversation database
5. ✅ Add custom intents if needed

---

## Performance Tips

- **Gemini API**: Free tier, best for Hindi/Hinglish
- **OpenAI API**: Paid, better for audio + fast responses
- **Caching**: Implement for repeated questions
- **Batch Processing**: Queue multiple requests

---

**Ready to launch! 🚀**

Questions? See AI-SETUP.md
