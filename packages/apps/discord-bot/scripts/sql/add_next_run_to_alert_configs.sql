-- Migration: Add next_run column to alert_configs table
-- This supports the new setTimeout-based scheduler that tracks when tasks should execute

-- Add next_run column to alert_configs
ALTER TABLE alert_configs 
  ADD COLUMN IF NOT EXISTS next_run timestamptz NULL;

-- Create index for efficient querying of upcoming tasks
CREATE INDEX IF NOT EXISTS idx_alert_configs_next_run 
  ON alert_configs(next_run) 
  WHERE enabled = true AND next_run IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN alert_configs.next_run IS 'Scheduled time for next task execution (used by setTimeout-based scheduler)';
