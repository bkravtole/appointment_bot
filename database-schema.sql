-- WhatsApp Appointment Bot - Database Schema
-- Run this SQL script in your Supabase or PostgreSQL database

-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  appointment_time TIMESTAMP,
  status VARCHAR(50) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_phone_number 
ON public.appointments(phone_number);

CREATE INDEX IF NOT EXISTS idx_appointments_event_id 
ON public.appointments(event_id);

CREATE INDEX IF NOT EXISTS idx_appointments_status 
ON public.appointments(status);

CREATE INDEX IF NOT EXISTS idx_appointments_created_at 
ON public.appointments(created_at DESC);

-- Create users table (optional - for storing user preferences)
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  user_name VARCHAR(255),
  email VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'UTC',
  language VARCHAR(10) DEFAULT 'en',
  preferences JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone_number 
ON public.users(phone_number);

CREATE INDEX IF NOT EXISTS idx_users_is_active 
ON public.users(is_active);

-- Create audit_log table for tracking all actions
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20),
  action VARCHAR(255),
  details JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_phone_number 
ON public.audit_log(phone_number);

CREATE INDEX IF NOT EXISTS idx_audit_log_action 
ON public.audit_log(action);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at 
ON public.audit_log(created_at DESC);

-- Enable Row Level Security (optional)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (PUBLIC access - modify for your use case)
CREATE POLICY "Allow read access to all"
ON public.appointments FOR SELECT
USING (true);

CREATE POLICY "Allow insert for authenticated users"
ON public.appointments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users"
ON public.appointments FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users"
ON public.appointments FOR DELETE
USING (true);

-- Create stored procedures for common operations (optional)

-- Procedure to get upcoming appointments
CREATE OR REPLACE FUNCTION get_upcoming_appointments(limit_count INT DEFAULT 10)
RETURNS TABLE (
  id BIGINT,
  phone_number VARCHAR,
  user_name VARCHAR,
  appointment_time TIMESTAMP,
  status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.phone_number,
    a.user_name,
    a.appointment_time,
    a.status
  FROM public.appointments a
  WHERE a.appointment_time > NOW()
  AND a.status = 'confirmed'
  ORDER BY a.appointment_time ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Procedure to get recent appointments
CREATE OR REPLACE FUNCTION get_recent_appointments(hours INT DEFAULT 2)
RETURNS TABLE (
  id BIGINT,
  phone_number VARCHAR,
  user_name VARCHAR,
  appointment_time TIMESTAMP,
  status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.phone_number,
    a.user_name,
    a.appointment_time,
    a.status
  FROM public.appointments a
  WHERE a.appointment_time > NOW() - INTERVAL '1 hour' * hours
  AND a.status = 'confirmed'
  ORDER BY a.appointment_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Procedure to log actions
CREATE OR REPLACE FUNCTION log_action(
  p_phone_number VARCHAR,
  p_action VARCHAR,
  p_details JSONB DEFAULT NULL,
  p_status VARCHAR DEFAULT 'success'
)
RETURNS TABLE (id BIGINT) AS $$
DECLARE
  v_log_id BIGINT;
BEGIN
  INSERT INTO public.audit_log (phone_number, action, details, status)
  VALUES (p_phone_number, p_action, p_details, p_status)
  RETURNING audit_log.id INTO v_log_id;
  
  RETURN QUERY SELECT v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Create a view for appointment statistics
CREATE OR REPLACE VIEW appointment_stats AS
SELECT 
  DATE(appointment_time) as appointment_date,
  COUNT(*) as total_appointments,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
FROM public.appointments
WHERE appointment_time IS NOT NULL
GROUP BY DATE(appointment_time)
ORDER BY appointment_date DESC;

-- Grant permissions (adjust based on your setup)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.appointments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.appointments TO authenticated;
GRANT SELECT ON TABLE public.users TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.users TO authenticated;

-- Add comments to tables for documentation
COMMENT ON TABLE public.appointments IS 'Stores appointment bookings with phone numbers and calendar event IDs';
COMMENT ON COLUMN public.appointments.phone_number IS 'User WhatsApp phone number (unique)';
COMMENT ON COLUMN public.appointments.event_id IS 'Google Calendar event ID';
COMMENT ON COLUMN public.appointments.status IS 'Appointment status: confirmed, cancelled, completed';

COMMENT ON TABLE public.users IS 'User preferences and metadata';
COMMENT ON TABLE public.audit_log IS 'Audit trail of all appointment-related actions';

-- Sample data for testing (comment out after initial setup)
-- INSERT INTO public.appointments (phone_number, event_id, user_name, status)
-- VALUES ('+1234567890', 'event_123', 'Test User', 'confirmed');
