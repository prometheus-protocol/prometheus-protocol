# MCP Connection Testing Plan

## Test Environment Setup
1. `DISABLE_SCHEDULER=true` in `.env` (already set)
2. Fresh server restart between major test phases
3. Monitor logs for errors and connection pool state

## Phase 1: Basic Connection Lifecycle

### Test 1.1: Fresh Connection
- [ ] Restart server (empty connection pool)
- [ ] Run `/mcp list` - should show existing DB connections
- [ ] Ask agent "what tools do you have?" - should list MCP tools
- [ ] **Expected**: Auto-reconnect happens, tools work
- [ ] Check logs for: "Connection not in memory, checking database and reconnecting..."

### Test 1.2: Manual Reconnect
- [ ] Run `/mcp connect <url>` with a new server
- [ ] Immediately use a tool from that server
- [ ] **Expected**: Connection established, tool works
- [ ] Check database: single record for that connection

### Test 1.3: Disconnect and Reconnect
- [ ] Run `/mcp disconnect <server>`
- [ ] Try to use a tool from that server
- [ ] **Expected**: Auto-reconnect triggers
- [ ] Verify status changes: disconnected → reconnecting → connected

## Phase 2: Tool Invocation Error Handling

### Test 2.1: Transient Network Error Simulation
- [ ] Establish connection
- [ ] Temporarily block network (or pause MCP server if possible)
- [ ] Invoke a tool
- [ ] **Expected**: Error logged, connection stays alive (not killed)
- [ ] Restore network
- [ ] Try same tool again
- [ ] **Expected**: Tool works, connection recovered

### Test 2.2: Invalid Tool Arguments
- [ ] Invoke a tool with wrong argument types
- [ ] **Expected**: Error returned to user, connection stays alive
- [ ] Immediately try same tool with correct arguments
- [ ] **Expected**: Tool works

### Test 2.3: Tool Timeout
- [ ] Invoke a slow tool (if available)
- [ ] **Expected**: Timeout handled gracefully, connection stays alive
- [ ] Try another tool
- [ ] **Expected**: Works normally

## Phase 3: Database Integrity

### Test 3.1: Connection Record Not Corrupted on Error
- [ ] Before: Query database, note tools count and server_name
  ```sql
  SELECT server_id, server_name, jsonb_array_length(tools::jsonb) as tool_count, status 
  FROM mcp_connections WHERE user_id = 'YOUR_USER_ID';
  ```
- [ ] Trigger a tool error (invalid args or network issue)
- [ ] After: Query database again
- [ ] **Expected**: tools count unchanged, server_name unchanged, status may be 'error' but tools preserved

### Test 3.2: No Duplicate Records Created
- [ ] Count records before: `SELECT COUNT(*) FROM mcp_connections WHERE user_id = 'YOUR_USER_ID' AND server_url = 'YOUR_URL';`
- [ ] Restart server multiple times
- [ ] Use tools several times (triggering auto-reconnect)
- [ ] Count records after
- [ ] **Expected**: Count unchanged (no duplicates)

### Test 3.3: Partial Update Works Correctly
- [ ] Establish connection (tools populated)
- [ ] Trigger error scenario
- [ ] Query: `SELECT status, error_message, tools, server_name FROM mcp_connections WHERE server_id = 'YOUR_SERVER_ID';`
- [ ] **Expected**: status = 'error', error_message set, tools array NOT empty, server_name NOT canister ID

## Phase 4: Concurrent Operations

### Test 4.1: Multiple Tool Calls Simultaneously
- [ ] Use agent to invoke 3+ tools in parallel (e.g., "check my wallet balance, get my watchlist, and check market status")
- [ ] **Expected**: All tools execute (may be concurrent), no connection corruption
- [ ] Check logs for concurrency limit messages

### Test 4.2: Reconnect During Tool Execution
- [ ] Start long-running tool
- [ ] While it's running, restart server
- [ ] Try to invoke another tool
- [ ] **Expected**: New connection established, old operation fails gracefully

### Test 4.3: Multiple Users Simultaneously
- [ ] Have 2+ Discord users connect to MCP servers
- [ ] Both invoke tools at same time
- [ ] **Expected**: No cross-contamination, each user's tools work independently

## Phase 5: Edge Cases

### Test 5.1: Server Restart Mid-Conversation
- [ ] Start conversation with agent
- [ ] Restart dev server
- [ ] Continue conversation, ask to use a tool
- [ ] **Expected**: Auto-reconnect works, conversation continues

### Test 5.2: Invalid Server URL in Database
- [ ] Manually corrupt a connection's server_url in database
- [ ] Try to use tool from that connection
- [ ] **Expected**: Clear error message, doesn't crash server

### Test 5.3: Tool Exists in DB But Not on Server
- [ ] Connect to server
- [ ] Manually edit database to add fake tool to tools array
- [ ] Try to invoke the fake tool
- [ ] **Expected**: MCP SDK returns tool not found, handled gracefully

### Test 5.4: OAuth Flow Interruption
- [ ] Start connecting to OAuth-protected server
- [ ] Close OAuth window mid-flow
- [ ] **Expected**: Connection status = 'AUTH_PENDING', no corruption

## Phase 6: Thread and Channel Context

### Test 6.1: Tools in Thread Match Parent Channel
- [ ] Connect MCP server in channel A
- [ ] Create thread with `/chat` in channel A
- [ ] In thread, ask "what tools do you have?"
- [ ] **Expected**: Shows tools from channel A

### Test 6.2: Thread After Server Restart
- [ ] Create thread, use tools successfully
- [ ] Restart server
- [ ] Continue in same thread, use tools
- [ ] **Expected**: Auto-reconnect works, thread context preserved

### Test 6.3: Multiple Channels Different Servers
- [ ] Connect server X in channel A
- [ ] Connect server Y in channel B
- [ ] Create thread in channel A, use tools
- [ ] Create thread in channel B, use tools
- [ ] **Expected**: Each thread sees only its channel's servers

## Phase 7: Scheduled Tasks (with scheduler enabled)

### Test 7.1: Task Executes After Restart
- [ ] Remove `DISABLE_SCHEDULER=true`
- [ ] Create scheduled task using MCP tool
- [ ] Restart server
- [ ] Wait for task to trigger
- [ ] **Expected**: Auto-reconnect happens, task executes successfully

### Test 7.2: Task Context Awareness
- [ ] Create task in thread
- [ ] Task should have conversation history
- [ ] **Expected**: Task "remembers" what it's monitoring

## Validation Queries

Run these SQL queries during testing to verify database state:

### Check for Corrupted Records
```sql
-- Should return 0 rows after fixes
SELECT * FROM mcp_connections 
WHERE tools::text = '[]' 
  AND status = 'connected';
```

### Check for Duplicates
```sql
-- Should return 0 rows
SELECT user_id, channel_id, server_url, COUNT(*) as count
FROM mcp_connections
GROUP BY user_id, channel_id, server_url
HAVING COUNT(*) > 1;
```

### Monitor Connection Status Distribution
```sql
SELECT status, COUNT(*) as count
FROM mcp_connections
GROUP BY status
ORDER BY count DESC;
```

### Recent Connection Activity
```sql
SELECT 
  server_name,
  status,
  jsonb_array_length(tools::jsonb) as tool_count,
  error_message,
  connected_at,
  updated_at
FROM mcp_connections
WHERE user_id = 'YOUR_USER_ID'
ORDER BY updated_at DESC
LIMIT 10;
```

## Success Criteria

✅ All tests pass without errors
✅ No connection records corrupted (tools preserved, correct server_name)
✅ No duplicate connection records created
✅ Auto-reconnect works reliably after server restart
✅ Transient errors don't kill connections
✅ Database integrity maintained throughout all operations
✅ Thread/channel context always correct
✅ Logs show clear diagnostic information

## Known Issues to Watch For

1. **"Connection object not in map during error"** - Should NOT appear anymore
2. **Empty tools array** - Should only be empty for new/pending connections
3. **server_name = canister ID** - Should always be human-readable title
4. **Duplicate connection IDs** - Each user+channel+server should have exactly one record
5. **Status stuck on 'error'** - Should recover on next use
