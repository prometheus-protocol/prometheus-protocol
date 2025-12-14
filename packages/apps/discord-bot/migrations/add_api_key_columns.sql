-- Migration: Add API key support to mcp_connections table
-- Date: 2025-12-14
-- Description: Adds optional api_key_header and api_key_value columns for servers that use API key authentication instead of OAuth

-- Add api_key_header column (stores the header name like 'x-api-key', 'Authorization', etc.)
ALTER TABLE mcp_connections 
ADD COLUMN IF NOT EXISTS api_key_header TEXT;

-- Add api_key_value column (stores the actual API key value)
ALTER TABLE mcp_connections 
ADD COLUMN IF NOT EXISTS api_key_value TEXT;

-- Add comment to document the columns
COMMENT ON COLUMN mcp_connections.api_key_header IS 'Optional custom header name for API key authentication (e.g., x-api-key, Authorization)';
COMMENT ON COLUMN mcp_connections.api_key_value IS 'Optional API key value for authentication. Used when the server does not support OAuth.';
