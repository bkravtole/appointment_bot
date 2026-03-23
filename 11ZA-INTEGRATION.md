# 11za Integration Guide - Complete Flow

## Overview

Here's how messages flow from WhatsApp to your bot and back to WhatsApp:

```
User sends WhatsApp message
    ↓
11za Webhook receives it
    ↓
POST /api/ai/11za-webhook
    ↓
Extract phone + message
    ↓
aiController.processMessage() [AI Processing]
    ↓
elevenLabsSendService.sendMessage() [AUTO SEND via 11za API]
    ↓
Response arrives on WhatsApp ✅
```

---

## Setup Steps

### Step 1: Get 11za Credentials

Go to **11za Dashboard**:
1. Create account at https://11za.in
2. Create a new business account / phone number
3. Get these credentials:
   - **API Token** (AuthToken)
   - **Phone ID** (your WhatsApp business phone number)

### Step 2: Configure .env

Add to your `.env` file:

```env
# 11za WhatsApp Integration
ELEVENLABS_TOKEN=your-11za-api-token-here
ELEVENLABS_PHONE_ID=your-phone-id-here
ELEVENLABS_ORIGIN_WEBSITE=https://engees.in
```

### Step 3: Setup Webhook in 11za

In 11za Dashboard → Webhook Settings:

```
Webhook URL: https://your-domain.com/api/ai/11za-webhook
Method: POST
Event: Message Received
```

---

## How It Works - Complete Flow

### Flow 1: Text Message → WhatsApp Response

```
1. User: "Kal appointment book karo"
    ↓
2. 11za receives and forwards to webhook:
   POST /api/ai/11za-webhook
   {
     "sendto": "+919876543210",
     "text": { "body": "Kal appointment book karo" }
   }
    ↓
3. Our server receives webhook:
   - Extracts phone: +919876543210
   - Extracts message: "Kal appointment book karo"
    ↓
4. AI Processing:
   aiController.processMessage()
   → Gemini/OpenAI analyzes
   → Extracts: intent=BOOK, date=tomorrow
    ↓
5. Get available slots:
   googleCalendarService.getAvailableSlots()
   → Returns: [{id: "...", time12: "04:30 PM", time24: "16:30"}]
    ↓
6. AUTO SEND to WhatsApp:
   elevenLabsSendService.sendSlotOptions()
   → Calls 11za API
   → Sends: "Available slots: 1. 04:00 PM  2. 04:30 PM"
    ↓
7. User receives on WhatsApp:
   "Available slots:
    1. 04:00 PM
    2. 04:30 PM
    
    Reply with slot number (1 or 2)"
```

### Flow 2: Audio Message → Transcription → Response

```
1. User: Sends voice message "Doctor ko kab time mil sakta hai?"
    ↓
2. 11za forwards to webhook with audio URL:
   {
     "sendto": "+919876543210",
     "audio": { "url": "https://11za.com/audio/voice.ogg" }
   }
    ↓
3. Our server:
   → Detects audio URL
   → audioService.transcribeAudioFromUrl()
   → Calls OpenAI Whisper API
   → Returns text: "Doctor ko kab time mil sakta hai?"
    ↓
4. Treat as normal text message:
   → AI extracts intent: QUERY
   → Find available slots
    ↓
5. AUTO SEND response slots back
```

---

## API Integration Details

### 11za API Endpoints Used

**1. Send Text Message**
```bash
POST https://api.11za.in/api/v1/whatsapp/sendMessage
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "sendto": "+919876543210",
  "authToken": "your-token",
  "originWebsite": "https://engees.in",
  "contentType": "text",
  "text": "Your appointment slots..."
}
```

**2. Send Interactive List Menu**
```bash
POST https://api.11za.in/api/v1/whatsapp/sendMessage

{
  "sendto": "+919876543210",
  "contentType": "interactive",
  "interactive": {
    "type": "list",
    "body": { "text": "Select a slot" },
    "action": {
      "button": "View Options",
      "sections": [{
        "rows": [
          { "id": "slot_1", "title": "04:00 PM" },
          { "id": "slot_2", "title": "04:30 PM" }
        ]
      }]
    }
  }
}
```

**3. Send Quick Reply Buttons**
```bash
POST https://api.11za.in/api/v1/whatsapp/sendMessage

{
  "sendto": "+919876543210",
  "contentType": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Confirm this slot?" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "yes", "title": "Yes" } },
        { "type": "reply", "reply": { "id": "no", "title": "No" } }
      ]
    }
  }
}
```

---

## Available Service Methods

We've created `elevenLabsSendService.js` with these methods:

### 1. Send Text Message
```javascript
await elevenLabsSendService.sendTextMessage(
  "+919876543210",
  "Your appointment is confirmed!"
);
```

### 2. Send Slot Options
```javascript
await elevenLabsSendService.sendSlotOptions(
  "+919876543210",
  [
    { id: "1", time12: "04:00 PM", time24: "16:00" },
    { id: "2", time12: "04:30 PM", time24: "16:30" }
  ],
  "hinglish"
);
```

### 3. Send Appointment Confirmation
```javascript
await elevenLabsSendService.sendAppointmentConfirmation(
  "+919876543210",
  {
    date: "2026-03-24",
    time: "16:30",
    doctorName: "Dr. Sharma",
    location: "New Delhi",
    treatment: "Malaria Check"
  },
  "hinglish"
);
```

### 4. Send Quick Replies
```javascript
await elevenLabsSendService.sendQuickReply(
  "+919876543210",
  "Is this time okay?",
  [
    { id: "yes", title: "Yes, confirm!" },
    { id: "no", title: "No, show other slots" }
  ]
);
```

### 5. Send Media
```javascript
await elevenLabsSendService.sendMedia(
  "+919876543210",
  "https://example.com/prescription.pdf",
  "document",
  "Your prescription"
);
```

---

## Webhook Payload Format

### What 11za Sends To Your Webhook

**Text Message**:
```json
{
  "sendto": "+919876543210",
  "authToken": "11za-token",
  "originWebsite": "https://11za.in",
  "contentType": "text",
  "text": {
    "body": "Kal appointment book karo"
  }
}
```

**Audio Message**:
```json
{
  "sendto": "+919876543210",
  "contentType": "audio",
  "audio": {
    "url": "https://11za-storage.s3.amazonaws.com/audio-voice-123.ogg",
    "mimeType": "audio/ogg"
  }
}
```

**Button Click**:
```json
{
  "sendto": "+919876543210",
  "contentType": "button",
  "button": {
    "payload": "slot_1",
    "text": "04:00 PM"
  }
}
```

---

## Response Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                   11za WhatsApp                      │
│         (User sends message on WhatsApp)             │
└────────────────    │                ────────────────┘
                     │
                     ↓ (Webhook HTTP POST)
┌─────────────────────────────────────────────────────┐
│        Your Server: /api/ai/11za-webhook             │
│  1. Extract phone & message                          │
│  2. AI Processing (Intent, Slots)                    │
│  3. Auto-send response via 11za API                  │
└────────────────    │                ────────────────┘
                     │
                     ↓ (11za SendMessage API)
┌─────────────────────────────────────────────────────┐
│               11za WhatsApp API                      │
│         (Send message back to user)                  │
└────────────────    │                ────────────────┘
                     │
                     ↓ (Message delivery)
┌─────────────────────────────────────────────────────┐
│           User's WhatsApp (Response)                 │
│      "Available slots: 1. 4 PM  2. 4:30 PM"         │
└─────────────────────────────────────────────────────┘
```

---

## Testing the Integration

### Test 1: Manual Webhook Test
```bash
curl -X POST http://localhost:3000/api/ai/11za-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "sendto": "+919876543210",
    "authToken": "test-token",
    "text": {
      "body": "Kal appointment chahiye"
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "phoneNumber": "+919876543210",
  "aiProcessing": {
    "intent": "BOOK",
    "confidence": 90
  },
  "whatsappDelivery": {
    "success": true,
    "messageId": "11za-msg-123",
    "recipient": "+919876543210"
  }
}
```

### Test 2: Real WhatsApp

1. Save 11za WhatsApp number to your phone
2. Send message: "Kal 3 baje appointment book karo"
3. Wait 2-3 seconds
4. Response arrives! ✅

---

## Common Issues & Solutions

### Issue 1: Messages not sending
```
Error in console: "11za credentials not configured"
```
**Solution**: Check .env file has:
```env
ELEVENLABS_TOKEN=your-token
ELEVENLABS_PHONE_ID=your-phone-id
```

### Issue 2: 401 Unauthorized from 11za API
```
Error: "Unauthorized"
```
**Solution**: Verify token is correct in:
- 11za Dashboard
- Your .env file
- No extra spaces/quotes

### Issue 3: Webhook not receiving messages
```
11za logs show: "No webhook configured"
```
**Solution**: 
1. Go to 11za Dashboard → Settings
2. Set webhook URL: `https://your-domain.com/api/ai/11za-webhook`
3. Restart your server
4. Test with real message

### Issue 4: Slow response (>5 seconds)
```
User sees delay before response
```
**Solution**: 
- Check API key rate limits
- Optimize AI provider (Use Gemini for speed)
- Add caching for repeated questions

---

## Multi-Turn Conversation Example

```
Turn 1:
User:     "Doctor ke liye appointment chahiye"
Bot:      "Kaunse din? Morning/Afternoon/Evening?"
Context:  { intent: "BOOK" }

Turn 2:
User:     "Kal shaam"
Bot:      "Available slots: 4 PM, 4:30 PM, 5 PM"
Context:  { intent: "BOOK", date: "2026-03-24", time: "EVENING" }

Turn 3:
User:     "4:30 PM"
Bot:      "Appointment booked for 4:30 PM tomorrow! ✅"
Context:  { intent: "CONFIRM", date: "2026-03-24", time: "16:30" }
           Saved to DB
```

---

## Production Deployment Checklist

- [ ] .env file configured with real 11za credentials
- [ ] 11za webhook URL updated to production URL
- [ ] API keys stored securely (not in git)
- [ ] Rate limiting implemented
- [ ] Error logging setup
- [ ] Database backups configured
- [ ] SSL certificate on domain
- [ ] Load testing completed

---

## Cost Estimation

### 11za Pricing
- **Business Account**: ~₹500-2000/month
- **Message Rate**: ~₹0.5-2 per message (incoming)
- **API Calls**: Unlimited

### AI Costs (monthly, 1000 users)
- **Gemini**: Free tier or $1-5
- **Whisper**: ~₹100-500 (audio transcription)
- **Total**: ~₹600-2500/month

---

## Next Steps

1. ✅ Get 11za credentials
2. ✅ Update .env file
3. ✅ Configure webhook in 11za
4. ✅ Test with curl commands
5. ✅ Test with real WhatsApp
6. ✅ Deploy to production

---

**Your bot is now fully integrated with 11za WhatsApp!** 🚀

Messages will automatically be sent back to users after AI processing.
