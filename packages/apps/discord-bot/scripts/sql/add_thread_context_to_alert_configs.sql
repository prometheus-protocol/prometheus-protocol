-- Add thread context columns to alert_configs
-- This allows tasks to maintain context from threads and post alerts to specific threads

-- Add target_channel_id column (where to post alerts)
ALTER TABLE alert_configs 
ADD COLUMN IF NOT EXISTS target_channel_id VARCHAR(255);

-- Add thread_id column (for loading thread history)
ALTER TABLE alert_configs 
ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255);

-- Add index for thread_id lookups
CREATE INDEX IF NOT EXISTS idx_alert_configs_thread_id ON alert_configs(thread_id);

-- Comments for documentation
COMMENT ON COLUMN alert_configs.target_channel_id IS 'Specific channel or thread ID where alerts should be posted (can differ from channel_id which is used for MCP tool access)';
COMMENT ON COLUMN alert_configs.thread_id IS 'Thread ID if task was created in a thread, used for loading thread-specific conversation history';
