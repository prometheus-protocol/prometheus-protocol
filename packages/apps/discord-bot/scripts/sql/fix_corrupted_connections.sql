-- Fix corrupted MCP connection records
-- These records have empty tools and wrong server names due to the updateConnectionStatus bug

-- Step 1: Identify and delete corrupted records that have good alternatives
-- A corrupted record has:
--   - tools = '[]' (empty)
--   - server_name looks like a canister ID (contains dashes and random chars)
--   - status = 'error'
--   - error_message contains "Connection object not in map"

-- First, let's see what we're dealing with (run this to preview):
SELECT 
    id,
    user_id,
    channel_id,
    server_id,
    server_name,
    status,
    jsonb_array_length(tools::jsonb) as tool_count,
    error_message,
    connected_at,
    updated_at
FROM mcp_connections
WHERE 
    tools::text = '[]' 
    AND status = 'error'
    AND (error_message LIKE '%Connection object not in map%' OR error_message = 'fetch failed')
ORDER BY user_id, server_url;

-- Step 2: Delete corrupted records where a good version exists for the same user+channel+url
-- This finds records with empty tools and errors, where a better record exists
DELETE FROM mcp_connections
WHERE id IN (
    SELECT c1.id
    FROM mcp_connections c1
    WHERE 
        c1.tools::text = '[]'
        AND c1.status IN ('error', 'disconnected')
        AND EXISTS (
            -- Check if there's a better record for the same user+channel+url
            SELECT 1 
            FROM mcp_connections c2
            WHERE 
                c2.user_id = c1.user_id
                AND c2.channel_id = c1.channel_id
                AND c2.server_url = c1.server_url
                AND c2.id != c1.id
                AND c2.tools::text != '[]'
                AND c2.status = 'connected'
        )
);

-- Step 3: For remaining corrupted records with no good alternative, 
-- we'll keep them but they should reconnect properly with the fix in place.
-- You could optionally reset them to a clean state:

-- OPTIONAL: Reset remaining corrupted records to 'disconnected' state
-- so they can reconnect cleanly
UPDATE mcp_connections
SET 
    status = 'disconnected',
    error_message = 'Cleaned up after updateConnectionStatus bug - please reconnect'
WHERE 
    tools::text = '[]'
    AND status = 'error'
    AND (error_message LIKE '%Connection object not in map%' OR error_message = 'fetch failed');

-- Step 4: Verify cleanup
SELECT 
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN tools::text = '[]' THEN 1 END) as empty_tools_count
FROM mcp_connections
GROUP BY status
ORDER BY status;
