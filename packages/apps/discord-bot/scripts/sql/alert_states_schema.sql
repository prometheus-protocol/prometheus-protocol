-- Alert States Table
-- This table stores execution state/results for alert runs

CREATE TABLE IF NOT EXISTS alert_states (
    id SERIAL PRIMARY KEY,                          -- Auto-incrementing primary key
    alert_id VARCHAR(255) NOT NULL,                 -- Reference to alert_configs.id
    data JSONB NOT NULL,                            -- Execution result data
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,    -- Execution timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Foreign key constraint (optional, depends on your setup)
-- ALTER TABLE alert_states ADD CONSTRAINT fk_alert_states_config 
-- FOREIGN KEY (alert_id) REFERENCES alert_configs(id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_states_alert_id ON alert_states(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_states_timestamp ON alert_states(timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_states_alert_id_timestamp ON alert_states(alert_id, timestamp DESC);

-- RLS (Row Level Security) policies if needed
-- ALTER TABLE alert_states ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE alert_states IS 'Stores execution states and results for alert runs';
COMMENT ON COLUMN alert_states.alert_id IS 'Reference to the alert configuration that generated this state';
COMMENT ON COLUMN alert_states.data IS 'JSON data containing the execution result or state information';
COMMENT ON COLUMN alert_states.timestamp IS 'When this alert execution occurred';