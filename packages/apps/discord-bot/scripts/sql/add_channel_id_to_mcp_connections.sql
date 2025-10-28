-- Add channel_id to mcp_connections table for channel-scoped MCP server connections
-- This allows users to have different MCP server setups per Discord channel

-- Add channel_id column (nullable for backward compatibility)
ALTER TABLE mcp_connections 
ADD COLUMN IF NOT EXISTS channel_id TEXT;

-- Drop the old unique constraint
ALTER TABLE mcp_connections 
DROP CONSTRAINT IF EXISTS mcp_connections_user_id_server_id_key;

-- Add new unique constraint with channel_id
ALTER TABLE mcp_connections 
ADD CONSTRAINT mcp_connections_user_channel_server_unique 
UNIQUE (user_id, channel_id, server_id);

-- Add index for efficient queries by user_id + channel_id
CREATE INDEX IF NOT EXISTS idx_mcp_connections_user_channel 
ON mcp_connections(user_id, channel_id);

-- Update any existing records to use a default channel_id (optional - for migration of existing data)
UPDATE mcp_connections 
SET channel_id = 'default' 
WHERE channel_id IS NULL;

-- Make channel_id NOT NULL after populating existing records
ALTER TABLE mcp_connections 
ALTER COLUMN channel_id SET NOT NULL;

COMMENT ON COLUMN mcp_connections.channel_id IS 'Discord channel ID - allows users to have different MCP server configurations per channel';
