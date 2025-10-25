-- Add recurring column to user_tasks table
-- This allows tracking whether a task should repeat or run once

ALTER TABLE public.user_tasks 
ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT true;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_user_tasks_recurring ON public.user_tasks(recurring);
