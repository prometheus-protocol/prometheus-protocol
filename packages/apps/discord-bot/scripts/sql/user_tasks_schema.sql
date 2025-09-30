-- User Tasks Table Schema
-- This table stores monitoring tasks that users create for periodic AI prompts

CREATE TABLE IF NOT EXISTS public.user_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    interval INTEGER NOT NULL, -- in minutes
    description TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_run TIMESTAMPTZ NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_enabled ON public.user_tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_user_tasks_created_at ON public.user_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_user_tasks_last_run ON public.user_tasks(last_run);

-- Enable RLS (Row Level Security)
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Service role can access all user_tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "Users can access their own tasks" ON public.user_tasks;

-- Create policy to allow service role full access
CREATE POLICY "Service role can access all user_tasks" ON public.user_tasks
    FOR ALL USING (auth.role() = 'service_role');

-- Create policy for authenticated users to only see their own tasks
CREATE POLICY "Users can access their own tasks" ON public.user_tasks
    FOR ALL USING (auth.uid()::text = user_id);

-- Grant permissions to service role
GRANT ALL ON public.user_tasks TO service_role;
GRANT ALL ON public.user_tasks TO authenticated;