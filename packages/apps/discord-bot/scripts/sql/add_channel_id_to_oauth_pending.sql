-- Migration: Add channel_id to oauth_pending table
-- This allows OAuth flows to maintain channel context throughout the authorization process
-- Run in Supabase SQL editor

-- Add channel_id column with default value 'default' for backward compatibility
ALTER TABLE oauth_pending 
ADD COLUMN IF NOT EXISTS channel_id text NOT NULL DEFAULT 'default';

-- Add an index for faster lookups by channel_id
CREATE INDEX IF NOT EXISTS idx_oauth_pending_channel ON oauth_pending(channel_id);

-- Add a composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_oauth_pending_user_channel ON oauth_pending(user_id, channel_id);

-- Update the unique constraint to include channel_id (optional - depends on your requirements)
-- If you want users to be able to have multiple pending OAuth flows for the same server in different channels:
-- ALTER TABLE oauth_pending DROP CONSTRAINT IF EXISTS oauth_pending_server_id_user_id_key;
-- ALTER TABLE oauth_pending ADD CONSTRAINT oauth_pending_server_user_channel_key UNIQUE(server_id, user_id, channel_id);

-- Note: If you keep the existing unique(server_id, user_id) constraint, 
-- users can only have one pending OAuth flow per server regardless of channel.
-- This might be acceptable depending on your use case.
