-- Alert Configurations Table
-- This table stores persistent alert configurations for the Discord bot scheduler

CREATE TABLE IF NOT EXISTS alert_configs (
    id VARCHAR(255) PRIMARY KEY,                    -- Unique alert identifier
    name VARCHAR(255) NOT NULL,                     -- Human-readable alert name
    description TEXT,                               -- Alert description
    channel_id VARCHAR(255) NOT NULL,               -- Discord channel ID for notifications
    interval INTEGER NOT NULL,                      -- Interval in milliseconds
    enabled BOOLEAN NOT NULL DEFAULT true,          -- Whether the alert is active
    prompt TEXT NOT NULL,                           -- AI prompt to execute
    last_run TIMESTAMP WITH TIME ZONE,              -- Last execution timestamp
    last_data JSONB,                                -- Last execution data
    error_state JSONB,                              -- Error state information (prevents spam)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_configs_channel_id ON alert_configs(channel_id);
CREATE INDEX IF NOT EXISTS idx_alert_configs_last_run ON alert_configs(last_run);
CREATE INDEX IF NOT EXISTS idx_alert_configs_error_state ON alert_configs USING GIN (error_state);

-- RLS (Row Level Security) policies if needed
-- ALTER TABLE alert_configs ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE alert_configs IS 'Stores persistent alert configurations for the Discord bot scheduler system';
COMMENT ON COLUMN alert_configs.id IS 'Unique identifier for the alert, typically userId_timestamp_random format';
COMMENT ON COLUMN alert_configs.name IS 'Human-readable name for the alert';
COMMENT ON COLUMN alert_configs.description IS 'Detailed description of what the alert does';
COMMENT ON COLUMN alert_configs.channel_id IS 'Discord channel ID where notifications will be sent';
COMMENT ON COLUMN alert_configs.interval IS 'Execution interval in milliseconds';
COMMENT ON COLUMN alert_configs.enabled IS 'Whether the alert is currently active and scheduled';
COMMENT ON COLUMN alert_configs.prompt IS 'AI prompt that will be executed with MCP tools';
COMMENT ON COLUMN alert_configs.last_run IS 'Timestamp of the last successful execution';
COMMENT ON COLUMN alert_configs.last_data IS 'JSON data from the last execution result';
COMMENT ON COLUMN alert_configs.error_state IS 'JSON object storing error state information including error type, message, count, and timestamps';