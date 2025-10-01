import OpenAI from 'openai';
import {
  LLMProvider,
  ConversationContext,
  AIFunction,
  AIFunctionCall,
  MCPServer,
} from '../types/index.js';
import { ConfigManager } from '../config/index.js';
import { MCPService } from './mcp/index.js';
import { openaiLogger, llmLogger } from '../utils/logger.js';

export class OpenAIProvider implements LLMProvider {
  name = 'OpenAI';
  private client: OpenAI;
  private config: ReturnType<ConfigManager['getLLM']>;

  supports = {
    streaming: true,
    functions: true,
    vision: true,
  };

  constructor(config: ConfigManager) {
    this.config = config.getLLM();
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
    });
  }

  // This is now the PRIMARY method for this class.
  async generateChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    functions?: AIFunction[],
  ): Promise<OpenAI.Chat.Completions.ChatCompletion.Choice> {
    const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams =
      {
        model: this.config.model || 'gpt-4-turbo',
        messages,
        max_completion_tokens: this.config.maxTokens || 1500,
        temperature: this.config.temperature || 0.7,
      };

    if (functions && functions.length > 0) {
      completionParams.tools = functions.map((func) => ({
        type: 'function',
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters,
        },
      }));
      completionParams.tool_choice = 'auto';
    }

    try {
      const completion =
        await this.client.chat.completions.create(completionParams);
      const choice = completion.choices[0];

      if (!choice) {
        throw new Error('OpenAI API returned no choice.');
      }
      return choice;
    } catch (error) {
      openaiLogger.error('OpenAI API call failed', error as Error);
      // Re-throw the error to be handled by the LLMService
      throw error;
    }
  }
}

export class LLMService {
  private provider: LLMProvider;
  private mcpService?: MCPService;
  private config: ConfigManager;

  constructor(config: ConfigManager, mcpService?: MCPService) {
    this.config = config;
    // Factory pattern - can easily add other providers
    switch (config.getLLM().provider) {
      case 'openai':
        this.provider = new OpenAIProvider(config);
        break;
      default:
        throw new Error(
          `Unsupported LLM provider: ${config.getLLM().provider}`,
        );
    }

    this.mcpService = mcpService;
  }

  // This is now the main entry point and contains the loop.
  async generateResponse(
    prompt: string,
    context?: ConversationContext,
    userId?: string,
    statusCallback?: (status: string) => Promise<void>,
  ): Promise<string | AIFunctionCall[]> {
    llmLogger.info('generateResponse called, starting tool-calling loop', {
      userId,
      metadata: { promptLength: prompt.length },
    });

    // Ensure we have the OpenAI provider to access the new method
    if (!(this.provider instanceof OpenAIProvider)) {
      throw new Error(
        'Tool-calling loop is only supported for OpenAI provider.',
      );
    }

    // 1. Prepare available functions (local + MCP)
    if (statusCallback) {
      await statusCallback('Loading your connected tools...');
    }

    // Load all available functions including MCP tools
    const allFunctions = await this.getAllFunctions(userId);

    llmLogger.info('Functions loaded for tool loop', {
      userId,
      totalFunctions: allFunctions.length,
      mcpFunctions: allFunctions.length,
    });

    // 2. Initialize conversation history
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.getSystemPrompt() },
    ];
    if (context?.history) {
      messages.push(
        ...context.history.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      );
    }
    messages.push({ role: 'user', content: prompt });

    const maxIterations = 100; // Safety break

    for (let i = 0; i < maxIterations; i++) {
      llmLogger.info(`Tool loop iteration ${i + 1}/${maxIterations}`, {
        userId,
      });

      try {
        // 3. Call the LLM with the current conversation history
        if (statusCallback) {
          await statusCallback(
            i === 0 ? 'Thinking...' : `Continuing analysis (step ${i + 1})...`,
          );
        }
        const choice = await this.provider.generateChatCompletion(
          messages,
          allFunctions,
        );
        const assistantMessage = choice.message;
        messages.push(assistantMessage); // Add assistant's response to history

        // 4. Check for tool calls
        if (
          !assistantMessage.tool_calls ||
          assistantMessage.tool_calls.length === 0
        ) {
          // NO TOOL CALLS: We are done. Return the text response.
          llmLogger.info('Loop finished. Returning text response.', {
            userId,
            responseLength: (assistantMessage.content || '').length,
          });
          const finalResponse =
            assistantMessage.content || 'Request completed.';

          // Smart truncation as safety net for Discord's 2000 character limit
          return this.truncateResponse(finalResponse);
        }

        // TOOL CALLS PRESENT: Execute them with concurrency control
        llmLogger.info(
          `Executing ${assistantMessage.tool_calls.length} tool calls with concurrency limit.`,
          { userId },
        );

        if (statusCallback) {
          const toolNames = assistantMessage.tool_calls.map(
            (tc) => tc.function.name,
          );
          const toolList =
            toolNames.length > 3
              ? `${toolNames.slice(0, 3).join(', ')} and ${toolNames.length - 3} more`
              : toolNames.join(', ');
          await statusCallback(`Executing tools: ${toolList}...`);
        }

        // Create task functions for each tool call
        const toolTasks = assistantMessage.tool_calls.map((toolCall) => {
          return async () => {
            const functionCall: AIFunctionCall = {
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments),
              id: toolCall.id,
            };

            const result = await this.handleFunctionCall(functionCall, userId!);

            // Format the result for the 'tool' role message
            let resultContent = '';
            if (result.error) {
              resultContent = `Error: ${result.error}`;
            } else if (result.content && Array.isArray(result.content)) {
              // Handle MCP content format
              resultContent = result.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text)
                .join('\n');
            } else if (result.message) {
              resultContent = result.message;
            } else {
              resultContent = JSON.stringify(result);
            }

            return {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: resultContent,
            };
          };
        });

        // Execute with concurrency limit (configurable via LLM_TOOL_CONCURRENCY_LIMIT env var)
        const concurrencyLimit = this.config.getLLM().toolConcurrencyLimit || 3;
        const toolResults = await this.executeWithConcurrencyLimit(
          toolTasks,
          concurrencyLimit,
        );
        messages.push(...toolResults); // Add tool results to history

        // The loop will continue with the updated message history...
      } catch (error) {
        llmLogger.error(
          `Error in tool loop iteration ${i + 1}`,
          error as Error,
          { userId },
        );
        return this.truncateResponse(
          'Sorry, I encountered an error while processing your request.',
        );
      }
    }

    llmLogger.warn('Loop exited due to max iterations.', { userId });
    return this.truncateResponse(
      'I performed several actions but reached the processing limit. The tasks have been completed.',
    );
  }

  // Helper to consolidate function loading logic
  private async getAllFunctions(userId?: string): Promise<AIFunction[]> {
    let allFunctions: AIFunction[] = [];
    if (this.mcpService && userId) {
      try {
        const mcpFunctions =
          await this.mcpService.convertToolsToOpenAIFunctions(userId);
        allFunctions = [...allFunctions, ...mcpFunctions];
      } catch (error) {
        llmLogger.error(
          'Failed to load MCP functions for user',
          error as Error,
          { userId },
        );
      }
    }
    return allFunctions;
  }

  private getSystemPrompt(): string {
    let basePrompt = `You are an AI assistant for Prometheus Protocol Discord. You help users interact with their connected tools.

Key Capabilities:
- Execute tool functions to retrieve information and perform actions
- Provide helpful responses based on available information and tool results

You can help users by:
- Answering questions based on tool results
- Explaining what tools are available and how to use them

IMPORTANT: Keep your responses concise and under 1800 characters to fit Discord message limits. Be direct and focused. If you need to provide detailed information, summarize the key points and offer to provide more details if asked.`;

    return basePrompt;
  }

  // Execute promises with controlled concurrency to avoid overwhelming MCP servers
  private async executeWithConcurrencyLimit<T>(
    tasks: (() => Promise<T>)[],
    concurrencyLimit: number = 3,
  ): Promise<T[]> {
    const results: T[] = new Array(tasks.length);

    llmLogger.info(
      `Starting batch processing of ${tasks.length} tasks with concurrency limit ${concurrencyLimit} (configurable via LLM_TOOL_CONCURRENCY_LIMIT)`,
    );

    // Process tasks in batches
    for (let i = 0; i < tasks.length; i += concurrencyLimit) {
      const batch = tasks.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map((task, batchIndex) =>
        task().then((result) => ({ index: i + batchIndex, result })),
      );

      const batchResults = await Promise.all(batchPromises);

      // Store results in correct positions
      batchResults.forEach(({ index, result }) => {
        results[index] = result;
      });

      llmLogger.debug(
        `Completed batch ${Math.floor(i / concurrencyLimit) + 1}/${Math.ceil(tasks.length / concurrencyLimit)}`,
        {
          batchSize: batch.length,
          totalTasks: tasks.length,
        },
      );
    }

    return results;
  }

  // Smart truncation for Discord's 2000 character limit
  private truncateResponse(response: string, maxLength: number = 1950): string {
    if (response.length <= maxLength) {
      return response;
    }

    llmLogger.warn('Response too long, truncating', {
      originalLength: response.length,
      maxLength,
    });

    // Try to find a good truncation point (end of sentence, paragraph, etc.)
    const truncated = response.substring(0, maxLength);

    // Look for the last sentence ending
    const lastSentence = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?'),
    );

    // Look for the last paragraph break
    const lastParagraph = truncated.lastIndexOf('\n\n');

    // Choose the best truncation point
    let cutPoint = maxLength - 50; // Default fallback

    if (lastParagraph > maxLength * 0.7) {
      cutPoint = lastParagraph;
    } else if (lastSentence > maxLength * 0.7) {
      cutPoint = lastSentence + 1;
    } else {
      // Find the last word boundary
      const lastSpace = truncated.lastIndexOf(' ', maxLength - 50);
      if (lastSpace > maxLength * 0.7) {
        cutPoint = lastSpace;
      }
    }

    const result =
      response.substring(0, cutPoint).trim() + '... *(response truncated)*';

    llmLogger.info('Response truncated', {
      originalLength: response.length,
      truncatedLength: result.length,
      cutPoint,
    });

    return result;
  }

  // Handle both local AI function calls and MCP tool calls
  async handleFunctionCall(
    functionCall: AIFunctionCall,
    userId: string,
  ): Promise<any> {
    llmLogger.info('handleFunctionCall called', {
      userId,
      metadata: {
        name: functionCall.name,
        arguments: JSON.stringify(functionCall.arguments),
      },
    });

    // Check if this is an MCP function call
    if (functionCall.name.startsWith('mcp__') && this.mcpService) {
      llmLogger.debug('Detected MCP function call, routing to MCP service', {
        userId,
      });
      try {
        const result = await this.mcpService.handleMCPFunctionCall(
          functionCall.name,
          functionCall.arguments,
          userId,
        );
        llmLogger.info('MCP function call succeeded', { userId });
        return result;
      } catch (error) {
        llmLogger.error('MCP function call failed', error as Error, { userId });
        return {
          error: `Failed to execute MCP tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    llmLogger.warn(
      'Not an MCP function call (prefix check failed or no MCP service)',
      { userId },
    );
    // Handle local AI functions (existing implementation)
    throw new Error(`Unknown function: ${functionCall.name}`);
  }

  async getMCPFunctions(userId: string): Promise<AIFunction[]> {
    if (!this.mcpService) {
      return [];
    }

    try {
      return await this.mcpService.convertToolsToOpenAIFunctions(userId);
    } catch (error) {
      llmLogger.error('Failed to load MCP functions', error as Error, {
        userId,
      });
      return [];
    }
  }

  getProvider(): LLMProvider {
    return this.provider;
  }
}
