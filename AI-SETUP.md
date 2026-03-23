# AI Appointment Bot - Setup & Integration Guide

## Overview

This enhanced WhatsApp Appointment Bot now includes AI capabilities powered by Google Gemini or OpenAI. The AI handles:

- **Intent Extraction**: Understands user intent (BOOK/QUERY/CANCEL/CONFIRM)
- **Multilingual Support**: English, Hindi, Hinglish
- **Voice Message Support**: Whisper API transcription
- **Smart Slot Matching**: Time-based filtering and suggestions
- **Contextual Memory**: Remembers last 5 messages

---

## Architecture

```
User Message (Text/Audio)
    ↓
11za Webhook → aiRoutes.post('/11za-webhook')
    ↓
audioService.transcribeAudioFromUrl() [if audio]
    ↓
aiController.processMessage()
    ↓
    ├─ aiService.extractIntent() [Gemini/OpenAI]
    ├─ contextService.saveMessage()
    ├─ contextService.getConversationHistory()
    └─ Handle Intent (BOOK/QUERY/CANCEL/CONFIRM)
        ├─ htmlkalendarService.getAvailableSlots()
        ├─ aiService.generateResponse()
        └─ contextService.updateUserState()
    ↓
Format for 11za → Send back via 11za API
```

---

## Setup Instructions

### Step 1: Install Dependencies

```bash
npm install @google/generative-ai axios form-data
```

### Step 2: Environment Configuration

Copy `.env.example` to `.env` and configure:

#### Option A: Google Gemini API (Recommended for Hindi/Hinglish)

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-api-key
```

Get API key: https://ai.google.dev/

#### Option B: OpenAI API (For Whisper audio transcription)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your-api-key
```

Get API key: https://platform.openai.com/

### Step 3: Database Setup

Run the SQL schema in Supabase:

```bash
# In Supabase SQL Editor, paste content from:
database-schema-ai.sql
```

This creates:
- `conversation_context` - Chat history
- `user_preferences` - Language/time preferences
- `doctors` - Doctor information

### Step 4: Test the Setup

```bash
npm run dev
```

Test endpoint:
```bash
curl -X POST http://localhost:3000/api/ai/process-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919876543210",
    "message": "Kal sham book kardo",
    "language": "hinglish"
  }'
```

Expected response:
```json
{
  "success": true,
  "intent": "BOOK",
  "date": "2026-03-24",
  "suggestedSlots": [
    {
      "id": "2026-03-24-16:00",
      "time12": "04:00 PM",
      "time24": "16:00"
    },
    {
      "id": "2026-03-24-16:30",
      "time12": "04:30 PM",
      "time24": "16:30"
    }
  ],
  "aiMessage": "Your evening slots are ready. Which time works for you?"
}
```

---

## API Endpoints

### 1. Process Message (Text or Audio)

**POST** `/api/ai/process-message`

```json
{
  "phoneNumber": "+919876543210",
  "message": "Doctor ko kab dikhana hai?",
  "audioUrl": "https://11za.com/audio/...",
  "language": "hinglish"
}
```

**Response**: Intent + Suggested Slots + AI Message

### 2. 11za Webhook Integration

**POST** `/api/ai/11za-webhook`

Receives messages from 11za chatbot automatically. Format response back through 11za API.

```json
{
  "sendto": "+919876543210",
  "authToken": "token",
  "text": {
    "body": "Kal appointment book karo"
  }
}
```

### 3. Transcribe Audio

**POST** `/api/ai/transcribe`

```json
{
  "audioUrl": "https://11za.com/audio/...",
  "language": "hi"
}
```

### 4. Get Conversation History

**GET** `/api/ai/conversation/:phoneNumber`

Returns last 5 messages for context.

---

## Intent Types

| Intent | Example | Action |
|--------|---------|--------|
| **BOOK** | "Kal shaam book kardo" | Find slots, suggest times |
| **QUERY** | "Kab khali hao?" | Show available slots |
| **CONFIRM** | "Ha, wahi time fixed karo" | Create appointment |
| **CANCEL** | "Cancel kardo" | Delete appointment |
| **IDLE** | "Namaste!" | General response |

---

## Language Support

### Hinglish Example

**Input**: "Malaria ke liye appointment chahiye kal 3 baje"

**AI Extraction**:
```json
{
  "intent": "BOOK",
  "date": "2026-03-24",
  "time": "15:00",
  "treatment": "Malaria",
  "confidence": 95
}
```

**AI Response**: "Malaria ke liye appointment kal 3 baje confirm ho gyi hai! ✅"

### Hindi Example

**Input**: "कल शाम डॉक्टर के पास जाना है"

Supported in Gemini API.

---

## Smart Slot Matching Logic

### Time-Based Filtering

```
User says: "Sham ka time do"
         ↓
AI extracts: time = "EVENING"
         ↓
Filter: Hours 16:00-19:00 (4 PM - 7 PM)
         ↓
Return: Top 2 slots in evening
```

### Time Slots Mapping

```
MORNING    → 10:00 - 12:00
AFTERNOON  → 12:00 - 16:00 (12 PM - 4 PM)
EVENING    → 16:00 - 19:00 (4 PM - 7 PM)
```

### Busy Time Fallback

```
User requests: "3 baje" (3 PM)
         ↓
Check Google Calendar: 3 PM is BUSY
         ↓
Suggest: Next 2 available slots
         ↓
Send: [3:30 PM, 4:00 PM]
```

---

## Contextual Memory Example

### Conversation Flow

**Message 1**: "Malaria check kaina chahiye"
- AI saves intent: treatment = Malaria

**Message 2**: "Kal 5 baje"
- AI remembers: Still talking about Malaria
- AI combines: Book malaria appointment for tomorrow at 5 PM

**Message 3**: "Ha, wahi time fixed karo"
- AI knows: Previous time (5 PM tomorrow for Malaria)
- Action: Create appointment immediately

All messages stored in `conversation_context` table with timestamp.

---

## Voice Message Support (Whisper API)

### Flow

```
11za sends audio URL
    ↓
audioService.transcribeAudioFromUrl()
    ↓
OpenAI Whisper API
    ↓
Returns: "Kal shaam book kardo"
    ↓
Process as normal text with AI
```

### Audio Formats Supported

- MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM
- Max 25 MB
- Works with Indian accents

### Language Detection

```env
# Auto-detect
WHISPER_LANGUAGE=null

# Or specify
WHISPER_LANGUAGE=hi  # Hindi
WHISPER_LANGUAGE=en  # English
```

---

## Database Schema

### conversation_context

```sql
id: UUID
phone_number: VARCHAR(20)
message: TEXT
intent: JSONB {
  intent: "BOOK|QUERY|CANCEL|CONFIRM|IDLE",
  date: "YYYY-MM-DD",
  time: "HH:MM",
  treatment: "string",
  confidence: 0-100
}
message_type: VARCHAR(50)
state: VARCHAR(50)  -- IDLE, AWAITING_TIME, AWAITING_CONFIRMATION, CONFIRMED
last_context: JSONB
created_at: TIMESTAMP
```

### user_preferences

```sql
phone_number: VARCHAR(20) PRIMARY KEY
preferred_language: VARCHAR(10)  -- en, hi, hinglish
preferred_time_slot: VARCHAR(50)  -- MORNING, AFTERNOON, EVENING
preferred_doctor: VARCHAR(255)
appointment_reminders: BOOLEAN
reminder_minutes: INTEGER
```

---

## Troubleshooting

### Issue: AI not responding

**Check**:
```bash
# Verify API key is set
echo $GEMINI_API_KEY
echo $OPENAI_API_KEY

# Check logs
npm run dev
# Look for "Error extracting intent"
```

**Solution**:
- Verify API key in .env
- Check API quota/limits on provider dashboard
- Test directly: `curl /api/ai/process-message`

### Issue: Audio not transcribing

**Check**:
- OPENAI_API_KEY is required for Whisper
- Audio URL is publicly accessible
- Audio format is supported

**Test**:
```bash
curl -X POST http://localhost:3000/api/ai/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://...",
    "language": "hi"
  }'
```

### Issue: Hinglish not understood

**Solution**:
- Use Gemini API (better for Hinglish)
- Ensure language code in prompt matches user input
- Add training examples to `aiService.js`

---

## Production Deployment

### Environment Variables for Production

```env
NODE_ENV=production
AI_PROVIDER=gemini  # More reliable for Hindi/Hinglish
GEMINI_API_KEY=****
OPENAI_API_KEY=****  # Backup for voice transcription
SUPABASE_SERVICE_KEY=****
```

### Recommended Settings

```env
CONVERSATION_HISTORY_LIMIT=5
CONTEXT_RETENTION_DAYS=30
LOG_LEVEL=warn
ENABLE_CONTEXTUAL_MEMORY=true
ENABLE_SMART_SLOT_MATCHING=true
```

### Rate Limiting

Add to your deployment:
```javascript
// In server.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per 15 minutes
});

app.use('/api/ai/', limiter);
```

---

## Performance Optimization

### Cache Intent Extraction

```javascript
// In aiService.js
const nodeCache = require('node-cache');
const cache = new nodeCache({ stdTTL: 600 }); // 10 minutes

async extractIntent(message) {
  const cached = cache.get(message);
  if (cached) return cached;
  
  const result = // ... AI call
  cache.set(message, result);
  return result;
}
```

### Batch Message Processing

```bash
# Handle multiple messages in queue
npm run start:worker
```

---

## API Costs Estimation

| Provider | Model | Pricing | Monthly Cost (1000 calls) |
|----------|-------|---------|---------------------------|
| **Gemini** | Pro | Free tier: 60 calls/min | $0 |
| **OpenAI** | GPT-3.5 | $0.0015 / 1K tokens | ~$1-5 |
| **Whisper** | Whisper-1 | $0.02 / 60 sec | ~$5-20 |

---

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load test
npm run test:load
```

---

## Support

For issues:
1. Check logs: `npm run dev`
2. Test endpoint directly with curl
3. Verify database connection
4. Check API key validity

---

**Version**: 2.0 with AI
**Last Updated**: March 2026
