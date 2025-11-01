-- Add recurring column to alert_configs table
-- This allows tracking whether a task should repeat or run once

ALTER TABLE public.alert_configs 
ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT true;

-- Create index for efficient filtering of one-shot tasks
CREATE INDEX IF NOT EXISTS idx_alert_configs_recurring ON public.alert_configs(recurring);
