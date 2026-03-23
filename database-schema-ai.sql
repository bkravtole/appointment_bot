/**
 * Supabase Database Schema Migration
 * Run these SQL commands in your Supabase SQL Editor
 * 
 * Tables:
 * 1. appointments - Main appointment bookings
 * 2. conversation_context - AI conversation history and context
 */

-- ============================================
-- Table 1: Appointments (existing)
-- ============================================
-- CREATE TABLE appointments (
--   id BIGSERIAL PRIMARY KEY,
--   phone_number VARCHAR(20) UNIQUE,
--   event_id VARCHAR(255),
--   user_name VARCHAR(255),
--   appointment_time TIMESTAMP,
--   status VARCHAR(50),
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- INDEX on phone_number for faster queries
-- CREATE INDEX idx_appointments_phone ON appointments(phone_number);

-- ============================================
-- Table 2: Conversation Context (NEW)
-- ============================================

CREATE TABLE conversation_context (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  intent JSONB, -- Stores extracted intent data
  message_type VARCHAR(50), -- BOOK, QUERY, CANCEL, CONFIRM, IDLE
  state VARCHAR(50) DEFAULT 'IDLE', -- User's current state
  last_context JSONB, -- Previous context for continuity
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEX on phone_number for faster lookups
CREATE INDEX idx_conversation_phone ON conversation_context(phone_number);

-- INDEX on created_at for sorting/cleanup queries
CREATE INDEX idx_conversation_created ON conversation_context(created_at DESC);

-- ============================================
-- Table 3: AI Preferences (NEW)
-- ============================================

CREATE TABLE user_preferences (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  preferred_language VARCHAR(10) DEFAULT 'hinglish', -- en, hi, hinglish
  preferred_time_slot VARCHAR(50), -- MORNING, AFTERNOON, EVENING
  preferred_doctor VARCHAR(255),
  appointment_reminders BOOLEAN DEFAULT TRUE,
  reminder_minutes INTEGER DEFAULT 30, -- Remind X minutes before
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEX on phone_number
CREATE INDEX idx_preferences_phone ON user_preferences(phone_number);

-- ============================================
-- Table 4: Doctor List (NEW)
-- ============================================

CREATE TABLE doctors (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  specialization VARCHAR(255),
  availability_start TIMESTAMP,
  availability_end TIMESTAMP,
  max_appointments_per_day INTEGER DEFAULT 10,
  google_calendar_id VARCHAR(255), -- If using multiple calendars
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEX for faster searches
CREATE INDEX idx_doctors_name ON doctors(name);

-- ============================================
-- Sample Data for Testing
-- ============================================

-- Insert sample conversation context
-- INSERT INTO conversation_context (phone_number, message, intent, message_type, state)
-- VALUES (
--   '+919876543210',
--   'Kal shaam book kardo',
--   '{"intent":"BOOK","date":"NEXT_DAY","time":"EVENING","confidence":90}',
--   'BOOK',
--   'AWAITING_CONFIRMATION'
-- );

-- Insert sample doctor
-- INSERT INTO doctors (name, specialization, max_appointments_per_day)
-- VALUES ('Dr. Sharma', 'General Medicine', 15);

-- Insert sample user preferences
-- INSERT INTO user_preferences (phone_number, preferred_language, preferred_time_slot)
-- VALUES ('+919876543210', 'hinglish', 'EVENING');

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================

-- ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service account full access
-- CREATE POLICY "Service account full access" ON conversation_context
--   FOR ALL USING (auth.role() = 'service_role');

-- Create policy to allow users to see only their own conversations
-- CREATE POLICY "Users see own conversations" ON conversation_context
--   FOR SELECT USING (
--     phone_number = current_user_phone() -- Requires custom function
--   );
