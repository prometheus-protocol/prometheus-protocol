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

  async generateResponse(
    prompt: string,
    context?: ConversationContext,
    functions?: AIFunction[],
    mcpServers?: MCPServer[],
  ): Promise<string | AIFunctionCall[]> {
    openaiLogger.info('generateResponse called', {
      metadata: {
        functionsCount: functions?.length || 0,
        mcpServersCount: mcpServers?.length || 0,
        promptLength: prompt.length,
      },
    });

    // Try OpenAI native MCP if we have servers and no local functions
    if (
      mcpServers &&
      mcpServers.length > 0 &&
      (!functions || functions.length === 0)
    ) {
      openaiLogger.info(
        `Using native MCP functionality with ${mcpServers.length} servers`,
      );

      try {
        const mcpTools = mcpServers.map((server) => ({
          type: 'mcp' as const,
          server_label: this.sanitizeServerLabel(server.name || server.id),
          server_description: server.description,
          server_url: server.url,
          require_approval: 'never' as const,
        }));

        openaiLogger.debug('Created MCP tools', {
          metadata: {
            tools: mcpTools.map((t) => `${t.server_label}: ${t.server_url}`),
          },
        });

        // Build conversation context for responses API
        let conversationContext = this.getSystemPrompt() + '\n\n';

        // Add conversation history if available
        if (context?.history) {
          openaiLogger.debug(
            `Adding ${context.history.length} history messages to context`,
          );
          for (const msg of context.history.slice(-10)) {
            conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
          }
        }

        conversationContext += `User: ${prompt}`;

        const response = await this.client.responses.create({
          model: this.config.model || 'gpt-4',
          tools: mcpTools,
          input: conversationContext,
        });

        openaiLogger.info('Native MCP response received', {
          metadata: { outputLength: response.output_text?.length || 0 },
        });

        return (
          response.output_text ||
          'I processed your request but did not generate any output.'
        );
      } catch (error) {
        openaiLogger.error(
          'Native MCP failed, falling back to traditional approach',
          error as Error,
        );
        // Fall through to traditional approach
      }
    }

    // Traditional approach with manual function handling
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(functions),
      },
    ];

    // Add conversation history if available
    if (context?.history) {
      openaiLogger.debug(`Adding ${context.history.length} history messages`);
      for (const msg of context.history.slice(-10)) {
        // Keep last 10 messages for context
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current prompt
    messages.push({
      role: 'user',
      content: prompt,
    });

    const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams =
      {
        model: this.config.model || 'gpt-3.5-turbo',
        messages,
        max_completion_tokens: this.config.maxTokens || 1000,
        temperature: this.config.temperature || 0.7,
      };

    // Add function definitions if provided
    if (functions && functions.length > 0) {
      openaiLogger.debug('Adding function definitions to OpenAI call', {
        metadata: {
          functionCount: functions.length,
          functions: functions.map((f) => f.name),
        },
      });

      completionParams.tools = functions.map((func) => ({
        type: 'function',
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters,
        },
      }));
      completionParams.tool_choice = 'auto';
    } else {
      openaiLogger.debug('No functions provided to OpenAI');
    }

    openaiLogger.info(
      `Calling OpenAI API with model ${completionParams.model}`,
    );

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('OpenAI API timeout after 60 seconds')),
          60_000,
        ),
      );

      const apiPromise = this.client.chat.completions.create(completionParams);

      const completion = (await Promise.race([
        apiPromise,
        timeoutPromise,
      ])) as OpenAI.Chat.Completions.ChatCompletion;

      openaiLogger.info('API call successful', {
        metadata: { choicesCount: completion.choices?.length || 0 },
      });

      const choice = completion.choices[0];
      if (!choice) {
        openaiLogger.warn('No choice returned from API');
        return 'Sorry, I could not generate a response.';
      }

      openaiLogger.debug('Choice details', {
        metadata: {
          finishReason: choice.finish_reason,
          toolCallsCount: choice.message.tool_calls?.length || 0,
        },
      });

      // Check if the model wants to call functions
      if (choice.message.tool_calls) {
        openaiLogger.info(
          `Processing ${choice.message.tool_calls.length} tool calls`,
        );
        const functionCalls: AIFunctionCall[] = choice.message.tool_calls.map(
          (toolCall) => {
            openaiLogger.debug('Tool call', {
              metadata: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            });
            return {
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments),
              id: toolCall.id, // Include the tool call ID for continuing conversation
            };
          },
        );
        return functionCalls;
      }

      const textResponse =
        choice.message.content || 'Sorry, I could not generate a response.';
      openaiLogger.info('Returning text response', {
        metadata: { responseLength: textResponse.length },
      });
      return textResponse;
    } catch (error) {
      openaiLogger.error('API call failed', error as Error);

      // Check if it's a model-related error
      if (error instanceof Error) {
        if (
          error.message.includes('model') ||
          error.message.includes('gpt-5')
        ) {
          openaiLogger.error('Model error - GPT-5 may not be available yet');
          return 'Sorry, the AI model (GPT-5) is not available. Please check the configuration or try a different model.';
        }
        if (error.message.includes('timeout')) {
          openaiLogger.error('Request timed out after 30 seconds');
          return 'Sorry, the AI request timed out. Please try again.';
        }
      }

      return 'Sorry, I could not generate a response due to an API error.';
    }
  }

  async continueConversationWithToolResults(
    originalPrompt: string,
    context: ConversationContext | undefined,
    functions: AIFunction[],
    toolCalls: AIFunctionCall[],
    toolResults: any[],
    userId?: string,
  ): Promise<string> {
    openaiLogger.info('continueConversationWithToolResults called', {
      metadata: {
        toolCallsCount: toolCalls.length,
        toolResultsCount: toolResults.length,
        promptLength: originalPrompt.length,
        userId,
      },
    });

    // Build the message history including the original prompt, assistant tool calls, and tool results
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(functions),
      },
    ];

    // Add conversation history if available
    if (context?.history) {
      openaiLogger.debug(`Adding ${context.history.length} history messages`);
      for (const msg of context.history.slice(-10)) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Add the original user prompt
    messages.push({
      role: 'user',
      content: originalPrompt,
    });

    // Add the assistant's tool calls response
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls.map((call, index) => ({
        id: call.id || `call_${index}`,
        type: 'function' as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments),
        },
      })),
    });

    // Add the tool results
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      const result = toolResults[i];

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

      messages.push({
        role: 'tool',
        content: resultContent,
        tool_call_id: toolCall.id || `call_${i}`,
      });
    }

    const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams =
      {
        model: this.config.model || 'gpt-3.5-turbo',
        messages,
        max_completion_tokens: this.config.maxTokens || 1000,
        temperature: this.config.temperature || 0.7,
      };

    // Include functions in case the AI wants to make more tool calls
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
        return 'Sorry, I could not generate a response.';
      }

      // Check if the model wants to make additional tool calls
      if (choice.message.tool_calls) {
        openaiLogger.info(
          `AI wants to make ${choice.message.tool_calls.length} additional tool calls`,
        );

        // Convert tool calls to AIFunctionCall format and throw to let service layer handle
        const additionalCalls: AIFunctionCall[] = choice.message.tool_calls.map(
          (toolCall) => ({
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
            id: toolCall.id,
          }),
        );

        // Create a special error that indicates additional tool calls are needed
        const error = new Error('ADDITIONAL_TOOL_CALLS_NEEDED');
        (error as any).toolCalls = additionalCalls;
        (error as any).currentMessages = messages;
        (error as any).completionParams = completionParams;
        throw error;
      }

      const textResponse =
        choice.message.content ||
        'I processed your request but did not generate a response.';

      openaiLogger.info('Conversation continuation successful', {
        metadata: { responseLength: textResponse.length },
      });

      return textResponse;
    } catch (error) {
      // Re-throw special errors that need to be handled at the service layer
      if (
        error instanceof Error &&
        error.message === 'ADDITIONAL_TOOL_CALLS_NEEDED'
      ) {
        throw error;
      }

      openaiLogger.error(
        'Failed to continue conversation with tool results',
        error as Error,
      );
      return 'Sorry, I encountered an error while processing the tool results.';
    }
  }

  private getSystemPrompt(functions?: AIFunction[]): string {
    let basePrompt = `You are an AI assistant for Prometheus Protocol Discord. You help users interact with their connected MCP (Model Context Protocol) tools and servers.

Key Capabilities:
- Access connected MCP servers and their tools for enhanced functionality
- Execute tool functions to retrieve information and perform actions
- Provide helpful responses based on available information and tool results

For monitoring and task management, users should use the dedicated \`/tasks\` command.

You can help users by:
- Using their connected MCP tools to get information
- Answering questions based on tool results
- Explaining what tools are available and how to use them

Available MCP tools depend on what servers the user has connected via \`/mcp connect\`.`;

    if (functions && functions.length > 0) {
      basePrompt += `\n\nAvailable functions: ${functions.map((f) => f.name).join(', ')}`;
    }

    return basePrompt;
  }

  private sanitizeServerLabel(label: string): string {
    // OpenAI requires server labels to:
    // - Start with a letter
    // - Contain only letters, digits, hyphens, and underscores
    // - Be reasonably short

    // Remove or replace invalid characters
    let sanitized = label
      .replace(/[^a-zA-Z0-9\-_]/g, '_') // Replace invalid chars with underscore
      .replace(/^[^a-zA-Z]/, 'server_') // Ensure it starts with a letter
      .substring(0, 50); // Limit length

    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(sanitized)) {
      sanitized = 'server_' + sanitized;
    }

    return sanitized;
  }

  public async continueWithAdditionalResults(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams,
    toolCalls: AIFunctionCall[],
    toolResults: any[],
  ): Promise<string> {
    openaiLogger.info('continueWithAdditionalResults called', {
      metadata: {
        toolCallsCount: toolCalls.length,
        toolResultsCount: toolResults.length,
      },
    });

    // Add the assistant's tool calls to the message history
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls.map((call, index) => ({
        id: call.id || `call_${index}`,
        type: 'function' as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments),
        },
      })),
    });

    // Add the tool results
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      const result = toolResults[i];

      let resultContent = '';
      if (result.error) {
        resultContent = `Error: ${result.error}`;
      } else if (result.content && Array.isArray(result.content)) {
        resultContent = result.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n');
      } else if (result.message) {
        resultContent = result.message;
      } else {
        resultContent = JSON.stringify(result);
      }

      messages.push({
        role: 'tool',
        content: resultContent,
        tool_call_id: toolCall.id || `call_${i}`,
      });
    }

    // Make the final API call
    try {
      const finalCompletion = (await this.client.chat.completions.create({
        ...completionParams,
        messages,
        stream: false, // Ensure we don't use streaming
      })) as OpenAI.Chat.Completions.ChatCompletion;

      const finalChoice = finalCompletion.choices[0];
      if (!finalChoice) {
        return 'Sorry, I could not generate a final response.';
      }

      // For now, just return the text response (no more recursive calls to avoid infinite loops)
      const finalResponse =
        finalChoice.message.content ||
        'I processed your additional requests but did not generate a response.';

      openaiLogger.info('Additional tool call continuation successful', {
        metadata: { responseLength: finalResponse.length },
      });

      return finalResponse;
    } catch (error) {
      openaiLogger.error(
        'Failed to continue with additional results',
        error as Error,
      );
      return 'Sorry, I encountered an error while processing the additional tool results.';
    }
  }
}

export class LLMService {
  private provider: LLMProvider;
  private mcpService?: MCPService;

  constructor(config: ConfigManager, mcpService?: MCPService) {
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

  async generateResponse(
    prompt: string,
    context?: ConversationContext,
    functions?: AIFunction[],
    userId?: string,
  ): Promise<string | AIFunctionCall[]> {
    llmLogger.info('generateResponse called', {
      userId,
      metadata: { promptLength: prompt.length },
    });

    // Combine local AI functions with MCP tools if available
    let allFunctions = functions || [];
    let mcpServers: MCPServer[] = [];

    llmLogger.debug(`Starting with ${allFunctions.length} local functions`);

    if (this.mcpService && userId) {
      llmLogger.debug('MCP service available, loading tools for user', {
        userId,
      });
      try {
        // Get connected MCP servers and convert to MCPServer format
        const connections = await this.mcpService.getUserConnections(userId);
        mcpServers = connections
          .filter((conn) => conn.status === 'connected')
          .map((conn) => ({
            id: conn.server_id,
            name: conn.server_name,
            description: `Connected MCP server: ${conn.server_name}`,
            url: conn.url,
            author: 'Unknown',
            version: '1.0.0',
            tags: [],
            auth_type: 'none' as const,
            hosted_on: 'external' as const,
          }));

        llmLogger.info('Found connected MCP servers', {
          userId,
          metadata: {
            serverCount: mcpServers.length,
            servers: mcpServers.map((s) => `${s.name} (${s.url})`),
          },
        });

        // Also load functions for fallback if native MCP fails
        const mcpFunctions =
          await this.mcpService.convertToolsToOpenAIFunctions(userId);
        llmLogger.debug('Loaded MCP functions as fallback', {
          userId,
          metadata: {
            functionCount: mcpFunctions.length,
            functions: mcpFunctions.map((f) => f.name),
          },
        });
        allFunctions = [...allFunctions, ...mcpFunctions];
      } catch (error) {
        llmLogger.error('Failed to load MCP tools for user', error as Error, {
          userId,
        });
      }
    } else {
      llmLogger.debug('MCP not available', {
        metadata: { hasService: !!this.mcpService, hasUserId: !!userId },
      });
    }

    llmLogger.info('Function summary', {
      userId,
      metadata: {
        totalFunctions: allFunctions.length,
        mcpServers: mcpServers.length,
        functionNames: allFunctions.map((f) => f.name),
      },
    });

    const result = await this.provider.generateResponse(
      prompt,
      context,
      allFunctions,
      mcpServers,
    );

    if (Array.isArray(result)) {
      llmLogger.info('AI returned function calls', {
        userId,
        metadata: {
          callCount: result.length,
          calls: result.map(
            (fc) => `${fc.name}(${JSON.stringify(fc.arguments)})`,
          ),
        },
      });
    } else {
      llmLogger.info('AI returned text response', {
        userId,
        metadata: { responseLength: result.length },
      });
    }

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

  async continueConversationWithToolResults(
    originalPrompt: string,
    context: ConversationContext | undefined,
    functions: AIFunction[],
    toolCalls: AIFunctionCall[],
    toolResults: any[],
    userId?: string,
  ): Promise<string> {
    llmLogger.info('continueConversationWithToolResults called', {
      userId,
      metadata: {
        toolCallsCount: toolCalls.length,
        toolResultsCount: toolResults.length,
        promptLength: originalPrompt.length,
      },
    });

    try {
      // Use the OpenAI provider's method to continue the conversation
      if (this.provider instanceof OpenAIProvider) {
        return await this.provider.continueConversationWithToolResults(
          originalPrompt,
          context,
          functions,
          toolCalls,
          toolResults,
          userId,
        );
      } else {
        throw new Error(
          'continueConversationWithToolResults not supported by current provider',
        );
      }
    } catch (error) {
      // Check if this is a request for additional tool calls
      if (
        error instanceof Error &&
        error.message === 'ADDITIONAL_TOOL_CALLS_NEEDED'
      ) {
        const additionalCalls = (error as any).toolCalls as AIFunctionCall[];
        const currentMessages = (error as any).currentMessages;
        const completionParams = (error as any).completionParams;

        llmLogger.info('Handling additional tool calls', {
          userId,
          metadata: { additionalCallsCount: additionalCalls.length },
        });

        // Execute the additional tool calls
        const additionalResults: any[] = [];
        for (const toolCall of additionalCalls) {
          try {
            llmLogger.debug(
              `Executing additional tool call: ${toolCall.name}`,
              { userId },
            );
            const result = await this.handleFunctionCall(toolCall, userId!);
            additionalResults.push(result);
          } catch (callError) {
            llmLogger.error(
              `Additional tool call failed: ${toolCall.name}`,
              callError as Error,
              { userId },
            );
            additionalResults.push({
              error: `Failed to execute ${toolCall.name}`,
            });
          }
        }

        // Continue the conversation with the additional results
        if (this.provider instanceof OpenAIProvider) {
          return await this.provider.continueWithAdditionalResults(
            currentMessages,
            completionParams,
            additionalCalls,
            additionalResults,
          );
        }
      }

      throw error;
    }
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
