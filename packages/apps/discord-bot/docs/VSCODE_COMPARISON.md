# VS Code vs Our Prompt System - Side by Side

## Architecture Comparison

### VS Code (JSX-based)
```tsx
<AgentPrompt>
  <SystemMessage>
    <CopilotIdentityRules />
    <SafetyRules />
  </SystemMessage>
  <UserMessage>
    <GlobalAgentContext>
      <UserOSPrompt />
      <UserShellPrompt />
      <WorkspaceStructure />
    </GlobalAgentContext>
  </UserMessage>
  <AgentConversationHistory />
  <AgentUserMessage>
    <CurrentDatePrompt />
    <ChatVariables />
    <ToolReferencesHint />
    <ReminderInstructions />
  </AgentUserMessage>
</AgentPrompt>
```

### Ours (Builder Pattern)
```typescript
new PromptBuilder(context)
  .addIdentity()              // ~ CopilotIdentityRules
  .addTimeContext()           // ~ CurrentDatePrompt
  .addToolsContext()          // ~ ToolReferencesHint
  .addBehaviorGuidelines()    // ~ Base instructions
  .addToolUsageRules()        // ~ Editing reminders
  .addTimezoneGuidance()      // Discord-specific
  .addTaskReminders()         // Discord-specific
  .build();
```

## Key Patterns We Adopted

### 1. Priority-Based Ordering (✅ Adopted)

**VS Code:**
```tsx
<AgentUserMessage priority={900} flexGrow={2}>
  <ChatVariables priority={898} />
  <ReminderInstructions priority={800} />
</AgentUserMessage>
```

**Ours:**
```typescript
sections.push({
  name: 'task_reminders',
  priority: 800,  // Higher = closer to user message
  content: '...'
});
```

### 2. Dynamic Context Injection (✅ Adopted)

**VS Code:**
```tsx
class CurrentDatePrompt extends PromptElement {
  render() {
    return <>The current date is {new Date().toLocaleDateString()}.</>
  }
}
```

**Ours:**
```typescript
addTimeContext(): this {
  const content = `TIME CONTEXT:
- Current UTC time: ${this.context.utcTime}
- User's timezone: ${this.context.userTimezone}`;
  // ...
}
```

### 3. Tool-Aware Instructions (✅ Adopted)

**VS Code:**
```tsx
function getEditingReminder(
  hasEditFileTool: boolean,
  hasReplaceStringTool: boolean
) {
  if (hasReplaceStringTool) {
    return "Include 3-5 lines of context...";
  }
}
```

**Ours:**
```typescript
addTaskReminders(): this {
  const hasTaskTools = this.context.availableTools
    .some(t => t.name.includes('task'));
  
  if (!hasTaskTools) return this;
  
  this.sections.push({...});
}
```

### 4. Reminder Instructions Near User Message (✅ Adopted)

**VS Code:**
```tsx
<ReminderInstructions>
  {/* Critical reminders repeated right next to user message */}
  <KeepGoingReminder />
  {getEditingReminder()}
  <NotebookReminderInstructions />
</ReminderInstructions>
```

**Ours:**
```typescript
.addTaskReminders()  // priority: 800 (high)
.addTimezoneGuidance()  // priority: 500
```

## Features We Didn't Adopt (Yet)

### 1. Token Budgeting ❌
**VS Code has:**
```tsx
<TokenLimit max={sizing.tokenBudget / 6} flexGrow={3}>
  <ChatVariables />
</TokenLimit>
```

**Why we skipped:** Added complexity. OpenAI/Anthropic handle truncation well enough for our use case.

### 2. Cache Breakpoints ❌
**VS Code has:**
```tsx
{this.props.enableCacheBreakpoints && (
  <cacheBreakpoint type={CacheType} />
)}
```

**Why we skipped:** Requires provider-specific implementation. Could add later for Anthropic's prompt caching.

### 3. Frozen Content ❌
**VS Code has:**
```tsx
class FrozenContentUserMessage extends PromptElement {
  // Reuses cached rendered content from previous turn
}
```

**Why we skipped:** Conversation history is simpler in Discord. No need for complex caching yet.

### 4. Image Support ❌
**VS Code has:**
```tsx
<Image src={part.imageUrl.url} detail={part.imageUrl.detail} />
```

**Why we skipped:** Discord bot is text-only currently. Could add for image attachments.

## Discord-Specific Additions

### 1. Timezone Context (New!)
```typescript
addTimezoneGuidance(): this {
  // VS Code only has current date
  // We have: UTC time, user timezone, local time
  // Plus guidance on asking for timezone
}
```

### 2. Task Execution Mode (New!)
```typescript
addExecutionContext(): this {
  if (this.context.isTaskExecution) {
    // Special instructions for tasks
    // No conversation history available
  }
}
```

### 3. MCP Tool Integration (New!)
```typescript
addToolsContext(): this {
  // Separate task tools from MCP tools
  // List user's connected MCP servers
}
```

## What We Learned

1. **Proximity Matters** - Instructions near user message get more attention
2. **Tool-Aware Prompts** - Adjust instructions based on available capabilities  
3. **Structured > Monolithic** - Modular sections beat one giant prompt
4. **Dynamic Context** - Current time, available tools, user prefs should be injected
5. **Reminders Work** - Repeating critical rules near the end helps adherence

## Migration Path

### Phase 1: Drop-in Replacement (Current)
Replace `getSystemPrompt()` with `PromptBuilder.buildStandard()`

### Phase 2: Per-Provider Optimization
```typescript
if (provider === 'anthropic') {
  builder.addCacheBreakpoints();
}
if (provider === 'openai') {
  builder.addOpenAISpecificRules();
}
```

### Phase 3: Token Management
```typescript
builder
  .addIdentity({ tokenBudget: 500 })
  .addTimeContext({ tokenBudget: 100 })
  .build({ maxTokens: 4000 });
```

### Phase 4: Advanced Features
- Prompt caching with cache keys
- Tool call batching hints
- Multi-turn optimization
- Frozen content reuse
