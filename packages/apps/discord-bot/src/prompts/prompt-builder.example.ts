/**
 * Example usage of the PromptBuilder system
 * 
 * This shows how to integrate the structured prompt system into the existing LLM service
 */

import { PromptBuilder, buildTimeContext } from './prompt-builder.js';
import { AIFunction } from '../types/index.js';

// Example 1: Standard chat conversation
async function buildChatPrompt(
  userId: string,
  availableTools: AIFunction[],
  mcpToolNames: string[],
  userTimezone?: string,
) {
  const timeContext = buildTimeContext(userTimezone);

  const prompt = PromptBuilder.buildStandard({
    utcTime: timeContext.utcTime,
    userTimezone: userTimezone,
    userLocalTime: timeContext.userLocalTime,
    availableTools: availableTools,
    mcpToolNames: mcpToolNames,
    hasConversationHistory: true,
    isTaskExecution: false,
  });

  return prompt;
}

// Example 2: Scheduled task execution
async function buildTaskExecutionPrompt(
  availableTools: AIFunction[],
  mcpToolNames: string[],
  userTimezone?: string,
) {
  const timeContext = buildTimeContext(userTimezone);

  const prompt = PromptBuilder.buildTaskExecution({
    utcTime: timeContext.utcTime,
    userTimezone: userTimezone,
    userLocalTime: timeContext.userLocalTime,
    availableTools: availableTools,
    mcpToolNames: mcpToolNames,
    hasConversationHistory: false,
    isTaskExecution: true,
  });

  return prompt;
}

// Example 3: Custom prompt with specific sections
async function buildCustomPrompt() {
  const timeContext = buildTimeContext('America/New_York');

  const builder = new PromptBuilder({
    utcTime: timeContext.utcTime,
    userTimezone: 'America/New_York',
    userLocalTime: timeContext.userLocalTime,
    availableTools: [],
    mcpToolNames: ['blast', 'cycleops'],
  });

  // Chain the standard sections
  builder
    .addIdentity()
    .addTimeContext()
    .addBehaviorGuidelines();

  // Build the final prompt
  return builder.build();
}

// Integration point in LLM service:
// Replace the hardcoded getSystemPrompt() method with:
/*
private async getSystemPrompt(
  userId: string,
  availableTools: AIFunction[],
  isTaskExecution: boolean = false
): Promise<string> {
  // Fetch user timezone from preferences
  let userTimezone: string | undefined;
  try {
    const prefs = await this.database.getUserPreferences(userId);
    userTimezone = prefs.timezone;
  } catch (e) {
    // Continue without timezone
  }

  // Get MCP tool names
  const mcpToolNames = await this.mcpService.getToolNames(userId);

  const timeContext = buildTimeContext(userTimezone);

  if (isTaskExecution) {
    return PromptBuilder.buildTaskExecution({
      utcTime: timeContext.utcTime,
      userTimezone: userTimezone,
      userLocalTime: timeContext.userLocalTime,
      availableTools: availableTools,
      mcpToolNames: mcpToolNames,
      hasConversationHistory: false,
      isTaskExecution: true,
    });
  }

  return PromptBuilder.buildStandard({
    utcTime: timeContext.utcTime,
    userTimezone: userTimezone,
    userLocalTime: timeContext.userLocalTime,
    availableTools: availableTools,
    mcpToolNames: mcpToolNames,
    hasConversationHistory: true,
    isTaskExecution: false,
  });
}
*/

export { buildChatPrompt, buildTaskExecutionPrompt, buildCustomPrompt };
