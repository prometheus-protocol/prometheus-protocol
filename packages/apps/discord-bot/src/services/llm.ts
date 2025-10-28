import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
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
      // Use 'required' to force the model to use one of the provided tools
      // This prevents the model from narrating instead of calling tools
      completionParams.tool_choice = 'required';
      // Disable parallel tool calls - execute one tool at a time
      completionParams.parallel_tool_calls = false;
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

export class AnthropicProvider implements LLMProvider {
  name = 'Anthropic';
  private client: Anthropic;
  private config: ReturnType<ConfigManager['getLLM']>;

  supports = {
    streaming: true,
    functions: true,
    vision: true,
  };

  constructor(config: ConfigManager) {
    this.config = config.getLLM();
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
    });
  }

  // New method using Anthropic's beta tool runner
  async generateWithToolRunner(
    messages: Anthropic.MessageParam[],
    systemPrompt: string,
    functions: AIFunction[],
    functionExecutor: (name: string, args: any) => Promise<any>,
    onToolCall?: (toolName: string) => Promise<void>,
  ): Promise<string> {
    try {
      // Convert AIFunction[] to beta tools
      const tools = functions.map((func) =>
        betaTool({
          name: func.name,
          description: func.description,
          inputSchema: func.parameters as any,
          run: async (input: any) => {
            if (onToolCall) {
              await onToolCall(func.name);
            }

            llmLogger.info(`Tool runner executing: ${func.name}`, {
              arguments: JSON.stringify(input),
            });

            const result = await functionExecutor(func.name, input);

            // Handle different result formats
            // MCP tools return: { content: [...], structuredContent: {...}, isError: false }
            // Task management returns: { message: "..." } or { error: "..." }
            if (result.content && Array.isArray(result.content)) {
              // MCP format - return the content array directly
              return result.content;
            } else if (result.error) {
              // Error format - return as string
              return `Error: ${result.error}`;
            } else if (result.message) {
              // Task management format - return as string
              return result.message;
            } else {
              // Fallback - stringify the result
              return JSON.stringify(result);
            }
          },
        }),
      );

      llmLogger.info(
        `Starting tool runner with ${tools.length} tools available`,
      );

      const runner = this.client.beta.messages.toolRunner({
        model: this.config.model || 'claude-sonnet-4-5-20250929',
        max_tokens: this.config.maxTokens || 1500,
        temperature: this.config.temperature || 0.7,
        system: systemPrompt,
        messages: messages,
        tools: tools,
        tool_choice: { type: 'auto' }, // Let Claude decide when to use tools
      });

      let iterationCount = 0;
      const maxIterations = 25;

      for await (const message of runner) {
        iterationCount++;

        if (iterationCount > maxIterations) {
          llmLogger.warn('Tool runner reached max iterations', {
            iterations: iterationCount,
          });
          break;
        }

        llmLogger.info(`Tool runner iteration ${iterationCount}`, {
          stopReason: message.stop_reason,
          contentBlocks: message.content.length,
        });

        // Check if Claude is done (no more tool uses)
        if (message.stop_reason === 'end_turn') {
          // Extract text from content blocks
          const textContent = message.content
            .filter((block) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');

          llmLogger.info('Tool runner finished with text response', {
            iterations: iterationCount,
            responseLength: textContent.length,
          });

          return textContent || 'Request completed.';
        }
      }

      // If we exit the loop without a final text response, await the final message
      const finalMessage = await runner;
      const textContent = finalMessage.content
        .filter((block) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      llmLogger.info('Tool runner completed', {
        iterations: iterationCount,
        responseLength: textContent.length,
      });

      return textContent || 'Request completed.';
    } catch (error) {
      llmLogger.error('Anthropic tool runner failed', error as Error);
      throw error;
    }
  }

  async generateChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    functions?: AIFunction[],
  ): Promise<OpenAI.Chat.Completions.ChatCompletion.Choice> {
    try {
      // Convert OpenAI format to Anthropic format
      const anthropicMessages: Anthropic.MessageParam[] = messages
        .filter((m) => m.role !== 'system') // System message handled separately
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content:
            typeof m.content === 'string'
              ? m.content
              : JSON.stringify(m.content),
        }));

      const systemMessage = messages.find((m) => m.role === 'system');

      const params: Anthropic.MessageCreateParams = {
        model: this.config.model || 'claude-sonnet-4-5-20250929',
        max_tokens: this.config.maxTokens || 1500,
        temperature: this.config.temperature || 0.7,
        messages: anthropicMessages,
        ...(systemMessage && {
          system:
            typeof systemMessage.content === 'string'
              ? systemMessage.content
              : JSON.stringify(systemMessage.content),
        }),
      };

      // Add tools if provided
      if (functions && functions.length > 0) {
        params.tools = functions.map((func) => ({
          name: func.name,
          description: func.description,
          input_schema: func.parameters,
        }));
        // Use 'any' to force Claude to use one of the provided tools
        // This prevents Claude from narrating instead of calling tools
        params.tool_choice = { type: 'any', disable_parallel_tool_use: true };
      }

      const response = await this.client.messages.create(params);

      // Convert Anthropic response to OpenAI format
      const content = response.content
        .map((block) => {
          if (block.type === 'text') {
            return block.text;
          } else if (block.type === 'tool_use') {
            return null; // Handle tool calls separately
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      const toolCalls = response.content
        .filter((block) => block.type === 'tool_use')
        .map((block: any) => ({
          id: block.id,
          type: 'function' as const,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        }));

      // Return in OpenAI format
      const choice: OpenAI.Chat.Completions.ChatCompletion.Choice = {
        index: 0,
        message: {
          role: 'assistant',
          content: content || null,
          refusal: null,
          ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
        },
        finish_reason:
          response.stop_reason === 'end_turn' ? 'stop' : 'tool_calls',
        logprobs: null,
      };

      return choice;
    } catch (error) {
      llmLogger.error('Anthropic API call failed', error as Error);
      throw error;
    }
  }
}

export class LLMService {
  private provider: LLMProvider;
  private mcpService?: MCPService;
  private config: ConfigManager;
  private taskFunctions?: any; // TaskManagementFunctions

  constructor(
    config: ConfigManager,
    mcpService?: MCPService,
    taskFunctions?: any,
  ) {
    this.config = config;
    this.taskFunctions = taskFunctions;
    // Factory pattern - can easily add other providers
    switch (config.getLLM().provider) {
      case 'openai':
        this.provider = new OpenAIProvider(config);
        break;
      case 'anthropic':
        this.provider = new AnthropicProvider(config);
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

    // Ensure we have a compatible provider (OpenAI or Anthropic) to access the tool loop method
    if (
      !(this.provider instanceof OpenAIProvider) &&
      !(this.provider instanceof AnthropicProvider)
    ) {
      throw new Error(
        'Tool-calling loop is only supported for OpenAI and Anthropic providers.',
      );
    }

    // Load all available functions including MCP tools
    const allFunctions = await this.getAllFunctions(userId, context?.channelId);

    llmLogger.info('Functions loaded for tool loop', {
      userId,
      channelId: context?.channelId,
      totalFunctions: allFunctions.length,
    });

    // If using Anthropic provider, use the new tool runner
    if (this.provider instanceof AnthropicProvider) {
      return await this.generateResponseWithToolRunner(
        prompt,
        context,
        userId,
        statusCallback,
        allFunctions,
      );
    }

    // Otherwise use the existing manual loop for OpenAI
    return await this.generateResponseManual(
      prompt,
      context,
      userId,
      statusCallback,
      allFunctions,
    );
  }

  // New method using Anthropic's tool runner
  private async generateResponseWithToolRunner(
    prompt: string,
    context?: ConversationContext,
    userId?: string,
    statusCallback?: (status: string) => Promise<void>,
    allFunctions?: AIFunction[],
  ): Promise<string> {
    if (!(this.provider instanceof AnthropicProvider)) {
      throw new Error('Tool runner only works with Anthropic provider');
    }

    // Build messages in Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = [];

    if (context?.history) {
      anthropicMessages.push(
        ...context.history.map((msg) => ({
          role:
            msg.role === 'assistant'
              ? ('assistant' as const)
              : ('user' as const),
          content: msg.content,
        })),
      );
    }

    anthropicMessages.push({
      role: 'user',
      content: prompt,
    });

    const systemPrompt = this.getSystemPrompt();

    // Create a function executor that routes to the appropriate handler
    const functionExecutor = async (name: string, args: any) => {
      return await this.handleFunctionCall(
        { name, arguments: args, id: 'tool-runner' },
        userId!,
        context,
      );
    };

    // Optional callback for tool invocations
    const onToolCall = async (toolName: string) => {
      if (statusCallback && allFunctions) {
        // Get display name for the tool
        const func = allFunctions.find((f) => f.name === toolName);
        let displayName = toolName;

        if (func?.title) {
          displayName = func.title;
        } else if (this.mcpService && userId) {
          displayName = await this.mcpService.getToolDisplayName(
            userId,
            toolName,
            context?.channelId || 'default',
          );
        }

        // Don't show status for respond_to_user
        if (toolName !== 'respond_to_user') {
          await statusCallback(`🔧 ${displayName}`);
        }
      }
    };

    try {
      const response = await this.provider.generateWithToolRunner(
        anthropicMessages,
        systemPrompt,
        allFunctions || [],
        functionExecutor,
        onToolCall,
      );

      return this.truncateResponse(response);
    } catch (error) {
      llmLogger.error('Tool runner failed', error as Error, { userId });
      return this.truncateResponse(
        'Sorry, I encountered an error while processing your request.',
      );
    }
  }

  // Existing manual loop method (for OpenAI)
  private async generateResponseManual(
    prompt: string,
    context?: ConversationContext,
    userId?: string,
    statusCallback?: (status: string) => Promise<void>,
    allFunctions?: AIFunction[],
  ): Promise<string | AIFunctionCall[]> {
    // Initialize conversation history
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
        if (
          !(this.provider instanceof OpenAIProvider) &&
          !(this.provider instanceof AnthropicProvider)
        ) {
          throw new Error('Unsupported provider');
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
          const contentValue = assistantMessage.content;
          const contentType = typeof contentValue;

          llmLogger.info('Loop finished. Returning text response.', {
            userId,
            contentType,
            contentValue: String(contentValue).substring(0, 100),
            responseLength: (contentValue || '').length,
          });

          // Handle null, undefined, empty string, or literal "null" string
          const finalResponse =
            contentValue &&
            contentValue !== 'null' &&
            contentValue.trim() !== ''
              ? contentValue
              : 'Request completed.';

          // Smart truncation as safety net for Discord's 2000 character limit
          return this.truncateResponse(finalResponse);
        }

        // TOOL CALLS PRESENT: Execute them with concurrency control
        llmLogger.info(
          `Executing ${assistantMessage.tool_calls.length} tool calls with concurrency limit.`,
          { userId },
        );

        // Show the assistant's reasoning if present
        if (statusCallback && assistantMessage.content) {
          await statusCallback(`💭 ${assistantMessage.content}`);
        }

        if (statusCallback && allFunctions) {
          // Get display names (titles) for tools, excluding respond_to_user
          const toolDisplayNames = await Promise.all(
            assistantMessage.tool_calls
              .filter((tc: any) => tc.function.name !== 'respond_to_user')
              .map(async (tc: any) => {
                // Check if this is one of our built-in functions (task management)
                const builtInFunc = allFunctions.find(
                  (f: AIFunction) => f.name === tc.function.name,
                );
                if (builtInFunc?.title) {
                  return builtInFunc.title;
                }

                // Otherwise check MCP tools
                if (this.mcpService) {
                  return await this.mcpService.getToolDisplayName(
                    userId!,
                    tc.function.name,
                    context?.channelId || 'default',
                  );
                }
                return tc.function.name;
              }),
          );

          // Only show tool status if there are actual tools (not just respond_to_user)
          if (toolDisplayNames.length > 0) {
            const toolList =
              toolDisplayNames.length > 3
                ? `${toolDisplayNames.slice(0, 3).join(', ')} and ${toolDisplayNames.length - 3} more`
                : toolDisplayNames.join(', ');
            await statusCallback(`🔧 ${toolList}`);
          }
        }

        // Create task functions for each tool call
        const toolTasks = assistantMessage.tool_calls.map((toolCall: any) => {
          return async () => {
            const functionCall: AIFunctionCall = {
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments),
              id: toolCall.id,
            };

            const result = await this.handleFunctionCall(
              functionCall,
              userId!,
              context,
            );

            // Check if this is the special end-loop marker
            if (result.__END_LOOP__) {
              return {
                __END_LOOP__: true,
                message: result.message,
              };
            }

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

        // Check if any tool result is the end-loop marker
        const endLoopResult = toolResults.find((r: any) => r.__END_LOOP__);
        if (endLoopResult) {
          llmLogger.info('Tool loop ended by respond_to_user call', { userId });
          return this.truncateResponse((endLoopResult as any).message);
        }

        // Filter out any end-loop markers and add remaining tool results to history
        const validToolResults = toolResults.filter(
          (r: any) => !r.__END_LOOP__,
        ) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        messages.push(...validToolResults);

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
  private async getAllFunctions(
    userId?: string,
    channelId?: string,
  ): Promise<AIFunction[]> {
    let allFunctions: AIFunction[] = [];

    // For Anthropic provider using tool runner, we don't need respond_to_user
    // The tool runner handles conversation ending automatically
    const needsRespondToUser = !(this.provider instanceof AnthropicProvider);

    // Add the special respond_to_user function (only for OpenAI/manual loop)
    if (needsRespondToUser) {
      allFunctions.push({
        name: 'respond_to_user',
        title: 'Send Response',
        description:
          'Send your final response to the user. Use this when you have gathered all necessary information and are ready to answer. This will end the tool loop and deliver your message.',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description:
                'Your complete response to the user. Be helpful, concise, and friendly.',
            },
          },
          required: ['message'],
        },
      });
    }

    // Add task management functions (always available)
    if (this.taskFunctions) {
      try {
        const taskFuncs = this.taskFunctions.getFunctions();
        allFunctions = [...allFunctions, ...taskFuncs];
        llmLogger.info('Loaded task management functions', {
          count: taskFuncs.length,
        });
      } catch (error) {
        llmLogger.error(
          'Failed to load task management functions',
          error as Error,
        );
      }
    }

    // Add MCP tools (user-specific and channel-specific)
    if (this.mcpService && userId) {
      try {
        llmLogger.info('Loading MCP functions for LLM', {
          userId,
          channelId,
          channelIdOrDefault: channelId || 'default',
        });
        const mcpFunctions =
          await this.mcpService.convertToolsToOpenAIFunctions(
            userId,
            channelId || 'default',
          );
        llmLogger.info('MCP functions loaded', {
          userId,
          channelId,
          mcpFunctionCount: mcpFunctions.length,
          functionNames: mcpFunctions.map((f) => f.name),
        });
        allFunctions = [...allFunctions, ...mcpFunctions];
      } catch (error) {
        llmLogger.error(
          'Failed to load MCP functions for user',
          error as Error,
          { userId, channelId },
        );
      }
    }
    return allFunctions;
  }

  private getSystemPrompt(): string {
    let basePrompt = `You are an AI assistant in Discord. You help users interact with their connected tools.

Key Capabilities:
- Execute tool functions to retrieve information and perform actions
- Provide helpful responses based on available information and tool results

You can help users by:
- Answering questions based on tool results
- Explaining what tools are available and how to use them

IMPORTANT GUIDELINES:
- Keep responses concise and under 1800 characters to fit Discord message limits
- Be direct and focused - summarize key points
- Use tools to gather information as needed
- After each tool call, analyze the results to determine if more information is needed
- When you have all the information needed to answer the user, provide your complete response

CRITICAL TOOL USAGE RULES:
- ALWAYS actually call the tool function - NEVER narrate or describe what you would do without calling it
- If a user asks you to perform an action (create, delete, update, list), you MUST call the corresponding tool
- DO NOT say things like "✅ Created task" or "🔧 List My Tasks" without actually executing the function call
- Your response should be based on the ACTUAL results returned by the tool, not simulated/imagined results
- DO NOT create duplicate items - if you successfully created something once, don't create it again`;

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
    context?: ConversationContext,
  ): Promise<any> {
    llmLogger.info('handleFunctionCall called', {
      userId,
      metadata: {
        name: functionCall.name,
        arguments: JSON.stringify(functionCall.arguments),
      },
    });

    // Check if this is the special respond_to_user function
    if (functionCall.name === 'respond_to_user') {
      llmLogger.info('Responding to user - ending tool loop', { userId });
      // Return a special marker that signals the loop should end
      return {
        __END_LOOP__: true,
        message: functionCall.arguments.message,
      };
    }

    // Check if this is a task management function
    if (this.taskFunctions) {
      const taskFunctionNames = [
        'create_task',
        'list_my_tasks',
        'update_task',
        'delete_task',
        'check_task_status',
      ];

      if (taskFunctionNames.includes(functionCall.name)) {
        llmLogger.debug('Routing function call to task management', {
          userId,
          functionName: functionCall.name,
        });
        try {
          const result = await this.taskFunctions.executeFunction(
            functionCall.name,
            functionCall.arguments,
            {
              userId,
              channelId: context?.channelId || '',
              threadId: context?.threadId, // Pass thread ID for task alerts
              history: context?.history || [],
            },
          );
          llmLogger.info('Task management function call succeeded', { userId });
          return result;
        } catch (error) {
          llmLogger.error(
            'Task management function call failed',
            error as Error,
            { userId },
          );
          return {
            error: `Failed to execute task management function: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }
    }

    // All other function calls are routed to MCP service
    if (this.mcpService) {
      llmLogger.debug('Routing function call to MCP service', {
        userId,
        channelId: context?.channelId,
      });
      try {
        const result = await this.mcpService.handleMCPFunctionCall(
          functionCall.name,
          functionCall.arguments,
          userId,
          context?.channelId || 'default',
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

    llmLogger.warn('No MCP service available to handle function call', {
      userId,
    });
    throw new Error(
      `Unable to execute function: ${functionCall.name} (no MCP service available)`,
    );
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
