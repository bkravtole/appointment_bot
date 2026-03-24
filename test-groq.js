require('dotenv').config({ path: 'd:/appointment/.env' });
const aiService = require('./src/services/aiService');

async function testGroq() {
  console.log('--- Testing Groq Integration ---');
  console.log('AI Provider:', process.env.AI_PROVIDER);
  console.log('Groq Model:', process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');

  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
    console.error('❌ Error: GROQ_API_KEY is not set in .env');
    return;
  }

  try {
    console.log('\n1. Testing Intent Extraction...');
    const intent = await aiService.extractIntent('I want to book an appointment for tomorrow at 10am for a checkup');
    console.log('Result:', JSON.stringify(intent, null, 2));

    console.log('\n2. Testing Response Generation...');
    const response = await aiService.generateResponse(intent, [
      { date: '2026-03-25', time: '10:00', time24: '10:00' }
    ], 'en');
    console.log('Result:', response);

    console.log('\n✅ Groq integration test completed successfully!');
  } catch (error) {
    console.error('\n❌ Groq integration test failed:', error);
  }
}

testGroq();
