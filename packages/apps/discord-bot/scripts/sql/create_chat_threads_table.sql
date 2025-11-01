-- Migration: Create chat_threads table for thread-based conversations
-- This enables the bot to maintain conversation context in Discord threads

-- Create chat_threads table
CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL UNIQUE,
  channel_id text NOT NULL,
  user_id text NOT NULL,
  conversation_history jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_threads_thread_id ON chat_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_user_id ON chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_is_active ON chat_threads(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_threads_last_activity ON chat_threads(last_activity);

-- Add comments
COMMENT ON TABLE chat_threads IS 'Stores Discord thread conversations for context-aware chat';
COMMENT ON COLUMN chat_threads.thread_id IS 'Discord thread ID (unique identifier)';
COMMENT ON COLUMN chat_threads.channel_id IS 'Parent channel ID where thread was created';
COMMENT ON COLUMN chat_threads.user_id IS 'Discord user ID who initiated the thread';
COMMENT ON COLUMN chat_threads.conversation_history IS 'Array of message objects with role and content';
COMMENT ON COLUMN chat_threads.is_active IS 'Whether the thread is still active (false when archived)';
COMMENT ON COLUMN chat_threads.last_activity IS 'Timestamp of last message in thread';
