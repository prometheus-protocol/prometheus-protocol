/**
 * Structured prompt building system for Discord MCP agent
 * Inspired by VS Code's prompt-tsx architecture but simplified for our use case
 */

import { AIFunction } from '../types/index.js';

export interface PromptSection {
  name: string;
  content: string;
  priority?: number; // Higher priority = closer to user message
}

export interface PromptContext {
  // Time & Timezone
  utcTime: string;
  userTimezone?: string;
  userLocalTime?: string;

  // User Environment
  platform?: string; // Discord platform info if available

  // Available Tools
  availableTools: AIFunction[];
  mcpToolNames?: string[];

  // Conversation Context
  hasConversationHistory?: boolean;
  isTaskExecution?: boolean;
}

export class PromptBuilder {
  private sections: PromptSection[] = [];

  constructor(private context: PromptContext) {}

  /**
   * Build the complete system prompt with all sections
   */
  build(): string {
    // Sort sections by priority (higher priority = later in prompt = closer to user)
    const sortedSections = [...this.sections].sort(
      (a, b) => (a.priority || 0) - (b.priority || 0),
    );

    return sortedSections.map((s) => s.content).join('\n\n');
  }

  /**
   * Add core identity and capabilities
   */
  addIdentity(): this {
    this.sections.push({
      name: 'identity',
      priority: 100,
      content: `You are a highly sophisticated AI assistant in Discord with expert-level knowledge across many different domains. You help users interact with their connected MCP tools, and complete complex multi-step requests.

If the user's intent is unclear, ask for clarification to discover any missing details instead of guessing. When a tool call is intended, make it happen rather than just describing it.

You can call tools repeatedly to take actions or gather as much context as needed until you have completed the task fully. Don't give up unless you are sure the request cannot be fulfilled with the tools you have. It's YOUR RESPONSIBILITY to make sure that you have done all you can to complete the request.

Continue working until the user's request is completely resolved before ending your turn and yielding back to the user. Only terminate your turn when you are certain the task is complete. Do not stop or hand back to the user when you encounter uncertainty — research or deduce the most reasonable approach and continue.`,
    });
    return this;
  }

  /**
   * Add time and timezone context
   */
  addTimeContext(): this {
    let timeContent = `TIME CONTEXT:
- Current UTC time: ${this.context.utcTime}`;

    if (this.context.userTimezone && this.context.userLocalTime) {
      timeContent += `
- User's timezone: ${this.context.userTimezone}
- User's local time: ${this.context.userLocalTime}`;
    } else {
      timeContent += `
- User's timezone: Unknown`;
    }

    this.sections.push({
      name: 'time_context',
      priority: 200,
      content: timeContent,
    });
    return this;
  }

  /**
   * Add available tools context
   */
  addToolsContext(): this {
    const toolNames = this.context.availableTools.map((t) => t.name);
    const taskTools = toolNames.filter(
      (n) => n.includes('task') || n.includes('timezone'),
    );
    const mcpTools = this.context.mcpToolNames || [];

    let toolsContent = 'AVAILABLE TOOLS:';

    if (taskTools.length > 0) {
      toolsContent += `\n\nTask Management: ${taskTools.join(', ')}`;
    }

    if (mcpTools.length > 0) {
      toolsContent += `\n\nUser's Connected MCP Tools: ${mcpTools.join(', ')}`;
    }

    this.sections.push({
      name: 'tools_context',
      priority: 250,
      content: toolsContent,
    });
    return this;
  }

  /**
   * Add core behavior guidelines
   */
  addBehaviorGuidelines(): this {
    this.sections.push({
      name: 'behavior',
      priority: 300,
      content: `WORKFLOW GUIDANCE:
When working on multi-step tasks, combine independent read-only operations in parallel batches when appropriate. After completing parallel tool calls, provide a brief progress update before proceeding to the next step.

For context gathering, parallelize discovery efficiently - launch varied queries together, read results, and deduplicate information. Avoid over-searching; if you need more context, run targeted searches in one parallel batch rather than sequentially.

Get enough context quickly to act, then proceed with implementation. Balance thorough understanding with forward momentum.

CRITICAL SPENDING RESTRICTIONS:
- NEVER spend any currency, tokens, or money unless the user explicitly specifies the EXACT amount to spend
- DO NOT make purchases, transfers, or transactions without explicit amounts and user confirmation
- If a tool requires a spending amount and the user hasn't provided one, ASK them first
- This includes: sending tokens, making payments, placing orders, staking funds, etc.
- When in doubt about spending, always ask for confirmation with specific amounts

COMMUNICATION STYLE:
- Keep responses concise and under 1800 characters for Discord message limits
- Be direct and action-oriented - users expect you to DO things, not just describe them
- Optimize for conciseness while preserving helpfulness and accuracy
- Avoid extraneous framing - skip unnecessary introductions or conclusions
- After completing operations, confirm completion briefly rather than explaining what was done
- Do NOT use emojis unless explicitly requested by the user`,
    });
    return this;
  }

  /**
   * Add tool usage rules
   */
  addToolUsageRules(): this {
    const hasMcpTools = (this.context.mcpToolNames?.length || 0) > 0;

    this.sections.push({
      name: 'tool_rules',
      priority: 400,
      content: `TOOL USAGE RULES:
When using a tool, follow the JSON schema very carefully and make sure to include ALL required properties.

Ask for permission if the tool requires spending money or tokens.

If you think running multiple tools can answer the user's question, prefer calling them in parallel whenever possible.

CRITICAL RULES:
- ALWAYS actually call the tool function - NEVER narrate or describe what you would do without calling it
- If a user asks you to perform an action (create, delete, update, list), you MUST call the corresponding tool
- DO NOT say things like "✅ Created task" or "I'll check that for you" without actually executing the function call
- Your response should be based on the ACTUAL results returned by the tool, not simulated/imagined results
- DO NOT create duplicate items - if you successfully created something once, don't create it again

Tools can be disabled or disconnected by the user. You may see tools used previously in the conversation that are not currently available. Be careful to only use the tools that are currently available to you.${
        hasMcpTools
          ? "\n\nThe user has connected MCP tools which give you extended capabilities. Use them to help accomplish the user's requests."
          : ''
      }`,
    });
    return this;
  }

  /**
   * Add timezone handling guidance (critical for task system)
   */
  addTimezoneGuidance(): this {
    const hasTimezoneContext =
      this.context.userTimezone && this.context.userLocalTime;

    this.sections.push({
      name: 'timezone_guidance',
      priority: 500,
      content: `TIME & TIMEZONE HANDLING:
- ALWAYS clarify whether you're referring to UTC or the user's local time
${
  !hasTimezoneContext
    ? `- User's timezone is unknown - ASK them "What timezone are you in?" if time is relevant
- Once you learn their timezone, call save_user_timezone to remember it`
    : ''
}
- When scheduling tasks, be explicit about times in BOTH timezones
  Example: "This will run at 3 PM in your timezone (10 PM UTC)"
- For natural language times like "6:45pm", convert to their local timezone
- Calculate delays from the CURRENT time shown above
- NEVER assume users understand UTC - always translate for them`,
    });
    return this;
  }

  /**
   * Add MCP-specific tool instructions
   */
  addMcpToolInstructions(): this {
    const hasMcpTools = (this.context.mcpToolNames?.length || 0) > 0;

    if (!hasMcpTools) {
      return this;
    }

    // Find MCP tool descriptions from available tools
    const mcpTools = this.context.availableTools.filter((t) =>
      this.context.mcpToolNames?.includes(t.name),
    );

    let mcpContent = `MCP TOOLS:
You have access to Model Context Protocol (MCP) tools that the user has connected.

Connected MCP Tools:`;

    mcpTools.forEach((tool) => {
      mcpContent += `\n- ${tool.name}: ${tool.description || 'No description'}`;
    });

    mcpContent += `\n\nUse these MCP tools naturally when they can help accomplish the user's request. The tools are provided by external servers and give you access to specialized capabilities.`;

    this.sections.push({
      name: 'mcp_instructions',
      priority: 350,
      content: mcpContent,
    });

    return this;
  }

  /**
   * Add task-specific reminders (high priority - near user message)
   */
  addTaskReminders(): this {
    const hasTaskTools = this.context.availableTools.some((t) =>
      t.name.includes('task'),
    );

    if (!hasTaskTools) {
      return this;
    }

    this.sections.push({
      name: 'task_reminders',
      priority: 800,
      content: `TASK SYSTEM REMINDERS:
- Tasks execute WITHOUT conversation history to reduce costs
- Make task prompts COMPLETELY self-contained with all necessary context
- When creating tasks with specific times, confirm the time in both UTC and local timezone
- Remember to save the user's timezone when you learn it for future reference`,
    });
    return this;
  }

  /**
   * Add context-specific execution guidance
   */
  addExecutionContext(): this {
    if (this.context.isTaskExecution) {
      this.sections.push({
        name: 'execution_context',
        priority: 150,
        content: `EXECUTION CONTEXT:
This is a scheduled task execution. You have access to the user's MCP tools but NOT to conversation history.
The prompt below contains all the context you need to complete this task.`,
      });
    }
    return this;
  }

  /**
   * Convenience method: Build a complete standard prompt
   */
  static buildStandard(context: PromptContext): string {
    return (
      new PromptBuilder(context)
        .addIdentity()
        .addExecutionContext()
        .addTimeContext()
        .addToolsContext()
        .addBehaviorGuidelines()
        .addMcpToolInstructions()
        .addToolUsageRules()
        .addTimezoneGuidance()
        // .addTaskReminders()
        .build()
    );
  }

  /**
   * Build a minimal prompt for task execution
   */
  static buildTaskExecution(context: PromptContext): string {
    return new PromptBuilder({ ...context, isTaskExecution: true })
      .addIdentity()
      .addExecutionContext()
      .addTimeContext()
      .addToolsContext()
      .addMcpToolInstructions()
      .addToolUsageRules()
      .build();
  }
}

/**
 * Helper to format time context for injection
 */
export function buildTimeContext(userTimezone?: string): {
  utcTime: string;
  userLocalTime?: string;
} {
  const now = new Date();
  const utcTime = now.toISOString();

  let userLocalTime: string | undefined;
  if (userTimezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      userLocalTime = formatter.format(now);
    } catch (e) {
      // Invalid timezone
    }
  }

  return { utcTime, userLocalTime };
}
