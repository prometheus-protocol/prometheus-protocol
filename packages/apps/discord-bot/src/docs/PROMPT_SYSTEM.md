# Structured Prompt System

Inspired by VS Code's `@vscode/prompt-tsx` architecture, this is a lightweight prompt building system tailored for our Discord MCP agent.

## Key Concepts from VS Code's System

### 1. **Component-Based Prompts**
VS Code uses JSX components (`<SystemMessage>`, `<UserMessage>`, `<Tag>`) to structure prompts. We adapted this to a builder pattern suitable for TypeScript without JSX.

### 2. **Priority-Based Ordering**
Sections have priorities - higher priority content appears closer to the user message, which models pay more attention to.

### 3. **Dynamic Context Injection**
- Current date/time
- User's OS and shell
- Workspace structure
- Available tools
- Repository context

### 4. **Tool-Aware Prompting**
Instructions adapt based on which tools are available. For example, different editing instructions for `edit_file` vs `replace_string`.

### 5. **Reminder Instructions**
Critical reminders are repeated near the user message for better adherence.

## Our Implementation

### PromptBuilder Class

```typescript
const prompt = PromptBuilder.buildStandard({
  utcTime: new Date().toISOString(),
  userTimezone: 'America/New_York',
  userLocalTime: 'Friday, November 1, 2025 at 6:30:00 PM EDT',
  availableTools: [...],
  mcpToolNames: ['blast', 'cycleops'],
  hasConversationHistory: true,
  isTaskExecution: false,
});
```

### Sections (by priority)

| Priority | Section | Purpose |
|----------|---------|---------|
| 100 | Identity | Core capabilities and role |
| 150 | Execution Context | Task vs chat mode |
| 200 | Time Context | UTC + user's local time |
| 250 | Tools Context | Available tools list |
| 300 | Behavior Guidelines | How to act |
| 400 | Tool Usage Rules | Critical tool rules |
| 500 | Timezone Guidance | Time handling |
| 800 | Task Reminders | Task-specific rules |

Higher priority = closer to user message = more attention from model

## Usage Examples

### Standard Chat
```typescript
const prompt = PromptBuilder.buildStandard(context);
```

### Task Execution (no conversation history)
```typescript
const prompt = PromptBuilder.buildTaskExecution(context);
```

### Custom Build
```typescript
const builder = new PromptBuilder(context);
builder
  .addIdentity()
  .addTimeContext()
  .addToolUsageRules();
  
const prompt = builder.build();
```

## Key Differences from VS Code

1. **No JSX** - We use a builder pattern instead
2. **Simpler Context** - Discord-specific (no workspace files, git, etc.)
3. **MCP Focus** - Emphasizes MCP tool usage and task scheduling
4. **Timezone Priority** - Critical for our task system
5. **No Token Management** - VS Code handles complex token budgets; we keep it simple

## Integration Points

### LLM Service
Replace `getSystemPrompt()` with:
```typescript
private async getSystemPrompt(userId: string, availableTools: AIFunction[]): Promise<string> {
  const userTimezone = await this.getUserTimezone(userId);
  const mcpTools = await this.mcpService.getToolNames(userId);
  const timeContext = buildTimeContext(userTimezone);
  
  return PromptBuilder.buildStandard({
    utcTime: timeContext.utcTime,
    userTimezone,
    userLocalTime: timeContext.userLocalTime,
    availableTools,
    mcpToolNames: mcpTools,
    hasConversationHistory: true,
  });
}
```

### Scheduler (Task Execution)
```typescript
const prompt = PromptBuilder.buildTaskExecution({
  utcTime: new Date().toISOString(),
  userTimezone: user.timezone,
  userLocalTime: formatTime(user.timezone),
  availableTools: await this.getTools(userId),
  mcpToolNames: await this.mcpService.getToolNames(userId),
  isTaskExecution: true,
});
```

## Benefits

✅ **Maintainability** - Sections are modular and easy to update  
✅ **Consistency** - All prompts follow the same structure  
✅ **Testability** - Easy to test individual sections  
✅ **Flexibility** - Can mix and match sections as needed  
✅ **Type Safety** - Full TypeScript support  
✅ **Priority Control** - Fine-grained control over section ordering  

## Future Enhancements

- [ ] Token budgeting (like VS Code's `PromptSizing`)
- [ ] Caching support (like VS Code's cache breakpoints)
- [ ] Template variables
- [ ] Section conditionals based on model capabilities
- [ ] Performance metrics tracking
