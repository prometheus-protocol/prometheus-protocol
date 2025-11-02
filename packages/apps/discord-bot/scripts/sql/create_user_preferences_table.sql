-- Create user_preferences table to store user-specific settings like timezone
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id TEXT PRIMARY KEY,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Add comment describing the table
COMMENT ON TABLE public.user_preferences IS 'Stores user-specific preferences like timezone, notification settings, etc.';
COMMENT ON COLUMN public.user_preferences.user_id IS 'Discord user ID';
COMMENT ON COLUMN public.user_preferences.preferences IS 'JSON object containing user preferences (timezone, etc.)';

-- Enable Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
