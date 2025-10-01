-- Add error_state column to alert_configs table
-- This column stores error state information to prevent spam when alerts fail

-- Add the error_state column as JSONB to store structured error information
ALTER TABLE alert_configs 
ADD COLUMN IF NOT EXISTS error_state JSONB;

-- Add index for error state queries
CREATE INDEX IF NOT EXISTS idx_alert_configs_error_state ON alert_configs USING GIN (error_state);

-- Add comment for documentation
COMMENT ON COLUMN alert_configs.error_state IS 'JSON object storing error state information including error type, message, count, and timestamps';

-- Example error_state structure:
-- {
--   "hasError": true,
--   "errorType": "permission" | "auth" | "other",
--   "errorMessage": "Bot does not have permission to send messages in channel",
--   "errorCount": 3,
--   "lastErrorDate": "2023-10-01T12:00:00Z",
--   "disabledDueToError": true
-- }