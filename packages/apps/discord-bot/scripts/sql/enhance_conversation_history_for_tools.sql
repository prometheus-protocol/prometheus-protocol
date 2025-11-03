-- Migration: Enhance conversation_history to support full message types including tool calls
-- This enables the bot to persist and reconstruct complete conversation history with all tool interactions

-- Add new columns to support tool messages
ALTER TABLE conversation_history 
  ADD COLUMN IF NOT EXISTS tool_call_id text NULL,
  ADD COLUMN IF NOT EXISTS tool_calls jsonb NULL,
  ADD COLUMN IF NOT EXISTS tool_name text NULL;

-- Update the check constraint to include 'tool' message type
ALTER TABLE conversation_history 
  DROP CONSTRAINT IF EXISTS conversation_history_message_type_check;

ALTER TABLE conversation_history 
  ADD CONSTRAINT conversation_history_message_type_check 
  CHECK (message_type IN ('user', 'assistant', 'system', 'tool'));

-- Create index for tool_call_id lookups
CREATE INDEX IF NOT EXISTS idx_conversation_history_tool_call_id 
  ON conversation_history(tool_call_id) 
  WHERE tool_call_id IS NOT NULL;

-- Add comments for clarity
COMMENT ON COLUMN conversation_history.tool_call_id IS 'ID linking tool result messages to their corresponding tool_call in assistant message';
COMMENT ON COLUMN conversation_history.tool_calls IS 'Array of tool calls made by assistant (stored on assistant message)';
COMMENT ON COLUMN conversation_history.tool_name IS 'Name of the tool being invoked (stored on tool result message)';
COMMENT ON COLUMN conversation_history.function_calls IS 'DEPRECATED: Legacy column for function calls, use tool_calls instead';
COMMENT ON COLUMN conversation_history.function_results IS 'DEPRECATED: Legacy column for function results, use tool messages instead';
