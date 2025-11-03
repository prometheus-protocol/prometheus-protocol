# Conversation History Refactor

## Overview

This refactor addresses the issue where the Discord bot was only storing the final output of each message and discarding tool call type messages. The bot now persists the exact messages including tool use and invocation results, and rebuilds them prior to LLM generation.

## Changes Made

### 1. Database Schema (`enhance_conversation_history_for_tools.sql`)

Added support for all OpenAI/Anthropic message types:

- **New columns:**
  - `tool_call_id` (text): Links tool result messages to their corresponding tool_call in assistant message
  - `tool_calls` (jsonb): Array of tool calls made by assistant (stored on assistant message)
  - `tool_name` (text): Name of the tool being invoked (stored on tool result message)

- **Updated constraint:**
  - Extended `message_type` enum to include `'tool'` in addition to `'user'`, `'assistant'`, `'system'`

- **Note:** Legacy columns `function_calls` and `function_results` are deprecated but kept for backward compatibility

### 2. TypeScript Types (`src/types/services.ts`)

#### Enhanced ConversationMessage Interface

```typescript
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null; // Now nullable for assistant messages with tool_calls
  timestamp: Date;
  // For assistant messages with tool calls
  tool_calls?: ToolCall[];
  // For tool result messages
  tool_call_id?: string;
  tool_name?: string;
}
```

#### New ToolCall Interface

```typescript
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}
```

#### Updated DatabaseService Interface

- Added `saveMessages()` method for saving complete message sequences
- Updated `updateThreadHistory()` to support tool call metadata
- Kept legacy methods for backward compatibility

### 3. LLM Service (`src/services/llm.ts`)

#### Return Type Enhancement

- **Both OpenAI and Anthropic** now use manual loop and return:
  ```typescript
  {
    response: string;
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  }
  ```

#### Message History Reconstruction

- `generateResponseManual()` now properly converts stored messages back to provider format:
  - User messages → user role
  - Assistant messages with tool_calls → assistant role with tool_calls array
  - Tool messages → converted to provider-specific format (Anthropic uses tool_result in user messages)

#### Message Tracking

- Tracks `turnStartIndex` to identify which messages were added during the current turn
- Only returns NEW messages (not the entire history) to avoid duplicate storage

#### Anthropic Tool Message Conversion

- Tool results are converted to Anthropic's expected format:
  - OpenAI tool role → Anthropic user message with tool_result content blocks
  - Maintains tool_use_id for proper result association

### 4. Database Service (`src/services/database.ts`)

#### New Method: `saveMessages()`

```typescript
async saveMessages(
  userId: string,
  channelId: string,
  messages: ConversationMessage[],
): Promise<void>
```

- Saves complete message sequences including tool calls and results
- Handles all message types: user, assistant, system, tool
- Properly serializes tool_calls to JSON
- Maintains tool_call_id and tool_name for tool messages

#### Enhanced: `getConversationHistory()`

- Now reconstructs complete message objects with tool metadata
- Parses `tool_calls` JSON back into objects
- Includes `tool_call_id` and `tool_name` for tool messages
- Returns messages in OpenAI-compatible format

#### Updated: Thread Methods

- `getChatThread()` and `updateThreadHistory()` now support the enhanced message format
- Thread conversation history can store tool calls and results

### 5. Chat Command (`src/commands/chat/chat.ts`)

#### New Method: `saveConversationWithMessages()`

```typescript
private async saveConversationWithMessages(
  context: CommandContext,
  messages: any[], // OpenAI message format
  userPrompt: string,
): Promise<void>
```

- Converts OpenAI message format to our ConversationMessage format
- Handles all message types including tool calls and results
- Uses the new `saveMessages()` database method

#### Response Handling

The chat command now handles the structured response format:

1. **Structured** `{ response: string, messages: [] }` (Both providers) - uses new save method
2. **Array** (deprecated function calls) - backward compatibility

### 6. Anthropic Provider Enhancement (`src/services/llm.ts`)

The Anthropic provider's `generateChatCompletion` was enhanced to:

- Convert tool messages to Anthropic's format (tool_result content blocks)
- Handle assistant messages with tool_use content blocks
- Properly reconstruct tool call sequences from stored history
- Both providers now use the same manual loop for consistent message tracking

## Migration Guide

### Database Migration

Run the SQL migration script:

```bash
# Execute in your Supabase SQL editor
cat scripts/sql/enhance_conversation_history_for_tools.sql
```

### Behavior Changes

1. **Conversation persistence:**
   - OLD: Only user prompts and final assistant responses were saved
   - NEW: All messages including assistant tool calls and tool results are persisted

2. **History reconstruction:**
   - OLD: History only contained text messages
   - NEW: History includes tool_calls metadata, enabling proper context restoration

3. **LLM continuity:**
   - OLD: LLM couldn't see what tools were called in previous turns
   - NEW: LLM has full visibility into past tool usage and results

## Backward Compatibility

- Legacy `saveConversationTurn()` method still works for simple text conversations
- Old `function_calls` and `function_results` columns maintained but deprecated
- Existing conversation history remains accessible
- Anthropic tool runner continues to use simplified format until enhanced

## Testing Recommendations

1. **Verify message persistence:**
   - Use `/chat` command with MCP tools
   - Check `conversation_history` table for tool messages
   - Confirm `tool_calls` and `tool_call_id` are populated

2. **Test history reconstruction:**
   - Have a conversation with tool usage
   - Send follow-up message
   - Verify LLM receives reconstructed tool calls in context

3. **Thread conversations:**
   - Create a thread with `/chat`
   - Use tools within the thread
   - Verify thread history includes tool metadata

4. **Backward compatibility:**
   - Test with Anthropic provider (should use legacy format)
   - Verify old conversations still load correctly

## Future Enhancements

1. **Message deduplication:**
   - Consider tracking message IDs to prevent duplicates
   - Useful for retry scenarios

2. **Message pruning:**
   - Enhanced pruning logic that keeps related tool call sequences together
   - Don't orphan tool results from their assistant messages

3. **Query optimization:**
   - Add composite indexes for common query patterns
   - Consider message batching for large conversations

4. **Streaming support:**
   - Extend to support streaming responses while still capturing full history
   - Buffer messages during streaming and save at completion

## Notes

- The refactor maintains full backward compatibility with existing conversations
- Performance impact is minimal - only additional columns and JSON serialization
- The approach is extensible for future message types (e.g., images, files)
- Tool call metadata enables better debugging and conversation analysis
