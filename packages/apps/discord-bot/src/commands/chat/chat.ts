import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  ChannelType,
} from 'discord.js';
import {
  BaseCommand,
  CommandContext,
  CommandResponse,
  CommandCategory,
  AIFunctionCall,
  DatabaseService,
  ConversationMessage,
} from '../../types/index.js';
import { LLMService } from '../../services/llm.js';
import { chatLogger } from '../../utils/logger.js';
import { ErrorHandler, AuthenticationError } from '../../utils/errors.js';
import { startSession, endSession } from './stop.js';
import { getToolChannelId } from '../../utils/channel-helpers.js';

export class ChatCommand extends BaseCommand {
  name = 'chat';
  description =
    'Chat with an AI assistant that has access to your connected MCP tools';
  category = CommandCategory.CHAT;

  constructor(
    private llmService: LLMService,
    private database: DatabaseService,
  ) {
    super();
  }

  getSlashCommand(): SlashCommandBuilder | SlashCommandOptionsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName('message')
          .setDescription('Your message to the AI')
          .setRequired(true),
      )
      .setContexts([
        InteractionContextType.BotDM,
        InteractionContextType.Guild,
        InteractionContextType.PrivateChannel,
      ]); // Enable this command in DMs
  }

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const prompt = interaction.options.getString('message', true);

    console.log('🔍 Chat executeSlash called:', {
      interactionId: interaction.id,
      isDeferred: interaction.deferred,
      isReplied: interaction.replied,
      userId: interaction.user.id,
    });

    // Reply immediately with brief acknowledgment
    try {
      await interaction.reply({
        content: `� *Processing your request...*`,
        fetchReply: true,
      });
      console.log('✅ Successfully replied:', interaction.id);
    } catch (error) {
      console.error('❌ Failed to reply:', error);
      return;
    }

    chatLogger.info('Chat slash command executed', {
      userId: interaction.user.id,
      prompt: prompt.substring(0, 100),
    });

    try {
      // Check if this is in a guild channel (not DM)
      if (interaction.inGuild() && interaction.channel) {
        // Check if channel supports threads
        if ('threads' in interaction.channel) {
          // Create a thread name from the prompt (max 100 chars for Discord)
          const threadName =
            prompt.length > 100 ? prompt.substring(0, 97) + '...' : prompt;

          chatLogger.info('Creating thread for conversation', {
            channelId: interaction.channelId,
            threadName,
          });

          const thread = await interaction.channel.threads.create({
            name: threadName,
            autoArchiveDuration: 10080, // Archive after 7 days (1 week) of inactivity
            reason: `Chat conversation started by ${interaction.user.tag}`,
          });

          chatLogger.info('Thread created successfully', {
            threadId: thread.id,
            channelId: interaction.channelId,
          });

          // Store thread in database
          await this.database.createChatThread({
            thread_id: thread.id,
            channel_id: interaction.channelId,
            user_id: interaction.user.id,
          });

          chatLogger.info('Thread stored in database', {
            threadId: thread.id,
          });

          // Truncate prompt for display if too long
          const displayPrompt =
            prompt.length > 80 ? prompt.substring(0, 77) + '...' : prompt;

          // Update the original reply with the prompt and link to the thread
          await interaction.editReply({
            content: `💬 **"${displayPrompt}"**\n\nContinue in <#${thread.id}>`,
          });

          // Create a context object for processing
          // Use getToolChannelId for tool access (shared 'dm' for all DMs), thread.id for alerts
          const context: CommandContext = {
            interaction,
            args: [],
            userId: interaction.user.id,
            channelId: getToolChannelId(interaction), // Shared 'dm' for DMs, actual channel for guilds
            guildId: interaction.guildId || undefined,
            threadId: thread.id, // Store thread ID in context for task creation
          };

          // Generate the AI response with empty history since this is a new thread
          // Create a status callback that tracks tool invocations
          let statusMessage: any = null;
          let toolInvocations: string[] = [];
          const statusCallback = async (status: string) => {
            try {
              // Add new tool invocation to the list
              toolInvocations.push(status);

              // Build the combined message with all tool invocations
              const combinedStatus = toolInvocations.join('\n');

              if (statusMessage) {
                // Edit existing status message to show all invocations
                await statusMessage.edit(combinedStatus);
              } else {
                // Create first status message
                statusMessage = await thread.send(combinedStatus);
              }
            } catch (error) {
              chatLogger.warn('Failed to send status update to thread', {
                error,
              });
            }
          };

          const response = await this.executeInternal(
            context,
            prompt,
            statusCallback, // Send tool execution updates to thread
            [], // Empty history - new thread starts fresh
            true, // Skip conversation save - thread manages its own history
          );

          // Keep the status message visible for transparency
          // Don't delete it - users should see what tools were used

          // Send the response to the thread
          if (response) {
            await thread.send({
              content: response.content || undefined,
              embeds: response.embeds || undefined,
              files: response.files || undefined,
              components: response.components || undefined,
            });

            // Send additional messages if the response was split
            if (
              response.additionalMessages &&
              response.additionalMessages.length > 0
            ) {
              for (const additionalMessage of response.additionalMessages) {
                await thread.send({
                  content: additionalMessage,
                });
              }
            }

            // Store the conversation turn in thread history
            // Store the full response (all parts combined) for context
            const fullResponse = response.additionalMessages
              ? [response.content, ...response.additionalMessages].join('\n\n')
              : response.content || '';

            await this.database.updateThreadHistory(thread.id, {
              role: 'user',
              content: prompt,
            });
            await this.database.updateThreadHistory(thread.id, {
              role: 'assistant',
              content: fullResponse,
            });
          }
        } else {
          // Channel doesn't support threads, fall back to follow-up
          chatLogger.info('Channel does not support threads, using follow-up', {
            channelId: interaction.channelId,
          });

          const context: CommandContext = {
            interaction,
            args: [],
            userId: interaction.user.id,
            channelId: getToolChannelId(interaction), // Shared 'dm' for DMs, actual channel for guilds
            guildId: interaction.guildId || undefined,
          };

          const response = await this.executeInternal(context, prompt);

          if (response) {
            await interaction.followUp({
              content: response.content || undefined,
              embeds: response.embeds || undefined,
              files: response.files || undefined,
              components: response.components || undefined,
            });

            // Send additional messages if the response was split
            if (
              response.additionalMessages &&
              response.additionalMessages.length > 0
            ) {
              for (const additionalMessage of response.additionalMessages) {
                await interaction.followUp({
                  content: additionalMessage,
                });
              }
            }
          }
        }
      } else {
        // Handle DM or non-guild context - use traditional follow-up
        chatLogger.info('Processing in DM context', {
          userId: interaction.user.id,
        });

        const context: CommandContext = {
          interaction,
          args: [],
          userId: interaction.user.id,
          channelId: getToolChannelId(interaction), // Shared 'dm' for all DMs
          guildId: interaction.guildId || undefined,
        };

        // Call the existing execute method
        const response = await this.executeInternal(context, prompt);

        // Send the final response as a follow-up message
        if (response) {
          await interaction.followUp({
            content: response.content || undefined,
            embeds: response.embeds || undefined,
            files: response.files || undefined,
            components: response.components || undefined,
          });

          // Send additional messages if the response was split
          if (
            response.additionalMessages &&
            response.additionalMessages.length > 0
          ) {
            for (const additionalMessage of response.additionalMessages) {
              await interaction.followUp({
                content: additionalMessage,
              });
            }
          }
        }
      }
    } catch (error) {
      chatLogger.error(
        'Error in chat slash command',
        error instanceof Error ? error : new Error(String(error)),
      );

      await interaction.followUp({
        content:
          'Sorry, I encountered an error while processing your request. Please try again later.',
      });
    }
  }

  private async executeInternal(
    context: CommandContext,
    prompt: string,
    statusCallback?: (status: string) => Promise<void>,
    overrideHistory?: ConversationMessage[], // Optional: override history (for new threads)
    skipConversationSave?: boolean, // Optional: skip saving to conversation_history table (for threads)
  ): Promise<CommandResponse> {
    chatLogger.info('Chat command executed', {
      userId: context.userId,
      prompt: prompt.substring(0, 100),
    });

    if (!prompt.trim()) {
      chatLogger.warn('Empty prompt provided');
      return {
        content: 'Please provide a message to chat with the AI.',
        ephemeral: true,
      };
    }

    // Start tracking this session for interrupt capability
    startSession(context.userId, context.channelId);

    try {
      // Since we're only supporting slash commands now, we don't need to check
      // - the interaction is always deferred in executeSlash before calling this

      // No longer include task management functions in chat
      // Task management is now handled by the dedicated /tasks command
      chatLogger.info(
        'Chat command no longer includes task management functions',
      );

      // Load conversation history from database (or use override for new threads)
      const history =
        overrideHistory !== undefined
          ? overrideHistory
          : await this.database.getConversationHistory(
              context.userId,
              context.channelId,
              50, // Keep last 50 messages for context
            );
      chatLogger.info('Loaded conversation history', {
        userId: context.userId,
        channelId: context.channelId,
        historyCount: history.length,
        isOverride: overrideHistory !== undefined,
      });

      // Generate response from LLM with status updates
      chatLogger.info('Calling LLM service', { userId: context.userId });

      // No initial status update needed - user message is already visible

      const response = await this.llmService.generateResponse(
        prompt,
        {
          userId: context.userId,
          channelId: context.channelId,
          threadId: context.threadId, // Pass thread ID for task alerts
          history: history, // Use actual conversation history
        },
        context.userId, // Pass userId for MCP integration
        // Pass callback for status updates
        statusCallback ||
          (async (status: string) => {
            if (context.interaction) {
              try {
                // Status already includes emoji from LLM service
                await context.interaction.followUp({ content: status });
              } catch (error) {
                // If update fails, log but don't break the flow
                chatLogger.warn('Failed to send status update', {
                  status,
                  error,
                });
              }
            }
          }),
      );

      // Handle different response types
      // New format: { response: string, messages: Message[] } (both providers)
      // Deprecated format: AIFunctionCall[] (no longer used)
      let finalResponse: string;
      let turnMessages: any[] | undefined;

      if (typeof response === 'object' && 'response' in response) {
        // Structured response with full message history (both OpenAI and Anthropic)
        finalResponse = response.response;
        turnMessages = response.messages;
        chatLogger.info('Received structured response with message history', {
          responseLength: finalResponse.length,
          messageCount: turnMessages?.length || 0,
        });
      } else if (Array.isArray(response)) {
        // Deprecated function call format (should not happen anymore)
        chatLogger.warn(
          'Received deprecated function call array format - this should not happen',
        );
        return await this.handleFunctionCalls(response, context, prompt);
      } else {
        throw new Error('Unexpected response format from LLM service');
      }

      chatLogger.info('Returning text response', {
        length: finalResponse.length,
        preview: finalResponse.substring(0, 100),
      });

      // Split response into multiple messages if needed
      const messageParts = this.splitIntoMessages(finalResponse);

      // Save conversation to database (unless we're in a thread that manages its own history)
      if (!skipConversationSave) {
        if (turnMessages) {
          // Save complete message history including tool calls
          await this.saveConversationWithMessages(
            context,
            turnMessages,
            prompt,
          );
        } else {
          // Shouldn't happen with current implementation, but fallback to legacy save
          chatLogger.warn(
            'No turn messages provided, falling back to legacy save',
          );
          await this.saveConversationTurn(context, prompt, finalResponse);
        }
      }

      // Return the first part as the primary response
      // Additional parts will be sent as follow-ups
      return {
        content: messageParts[0],
        additionalMessages:
          messageParts.length > 1 ? messageParts.slice(1) : undefined,
      };
    } catch (error) {
      chatLogger.error(
        'Error in chat command',
        error instanceof Error ? error : new Error(String(error)),
      );

      return {
        content:
          'Sorry, I encountered an error while processing your request. Please try again later.',
        ephemeral: true,
      };
    } finally {
      // Clean up session tracking
      endSession(context.userId, context.channelId);
    }
  }

  private async handleFunctionCalls(
    functionCalls: AIFunctionCall[],
    context: CommandContext,
    originalPrompt: string,
  ): Promise<CommandResponse> {
    chatLogger.info('Processing function calls', {
      count: functionCalls.length,
    });
    const functionResults = [];

    for (const functionCall of functionCalls) {
      chatLogger.info('Processing function call', { name: functionCall.name });

      try {
        const result = await this.executeFunctionCall(functionCall, context);
        chatLogger.info('Function call completed', {
          name: functionCall.name,
          success: result.success,
        });
        functionResults.push(result);
      } catch (error) {
        chatLogger.error(
          'Function call failed',
          error instanceof Error ? error : new Error(String(error)),
          {
            name: functionCall.name,
          },
        );
        functionResults.push({
          success: false,
          message: `Failed to execute ${functionCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return await this.processResults(
      functionCalls,
      functionResults,
      context,
      originalPrompt,
    );
  }

  private async executeFunctionCall(
    functionCall: AIFunctionCall,
    context: CommandContext,
  ): Promise<any> {
    // Check if this is an MCP function call
    if (functionCall.name.startsWith('mcp__')) {
      chatLogger.info('Executing MCP function', { name: functionCall.name });
      return await this.handleMCPFunction(functionCall, context);
    } else {
      // Task management functions are no longer available in chat
      // They should be used via the dedicated /tasks command
      chatLogger.warn('Non-MCP function call attempted in chat', {
        name: functionCall.name,
      });
      return {
        success: false,
        message: `Task management functions are no longer available in chat. Please use the \`/tasks\` command instead.`,
      };
    }
  }

  private async handleMCPFunction(
    functionCall: AIFunctionCall,
    context: CommandContext,
  ): Promise<any> {
    try {
      const mcpResult = await this.llmService.handleFunctionCall(
        functionCall,
        context.userId,
      );

      chatLogger.info('MCP function result received', {
        name: functionCall.name,
        hasError: !!mcpResult.error,
      });

      // Format MCP result for user display
      if (mcpResult.error) {
        // Check if this is an OAuth authorization error
        if (
          mcpResult.error === 'OAUTH_AUTHORIZATION_REQUIRED' &&
          mcpResult.auth_url
        ) {
          return {
            success: false,
            message: `🔐 **Authorization Required**\n\n${mcpResult.message}\n\n**[Click here to authorize](${mcpResult.auth_url})**\n\nAfter authorizing, try your command again.`,
            requiresAuth: true,
            authUrl: mcpResult.auth_url,
          };
        } else {
          return { success: false, message: mcpResult.error };
        }
      } else {
        // Extract the actual content from MCP result
        const content = this.extractMCPContent(mcpResult);
        return {
          success: true,
          message: `🌤️ **Weather Result:**\n${content}`,
        };
      }
    } catch (error) {
      chatLogger.error(
        'MCP function call failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          name: functionCall.name,
        },
      );
      throw error;
    }
  }

  private extractMCPContent(mcpResult: any): string {
    if (mcpResult.structuredContent) {
      // Use structured content if available
      if (typeof mcpResult.structuredContent === 'object') {
        // If it's an object with a 'report' field, use that
        if (mcpResult.structuredContent.report) {
          return mcpResult.structuredContent.report;
        } else {
          return JSON.stringify(mcpResult.structuredContent, null, 2);
        }
      } else {
        return String(mcpResult.structuredContent);
      }
    } else if (mcpResult.content && Array.isArray(mcpResult.content)) {
      // Extract text from content array
      const textContent = mcpResult.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('\n');

      // Try to parse as JSON if it looks like JSON
      try {
        const parsed = JSON.parse(textContent);
        return parsed.report || JSON.stringify(parsed, null, 2);
      } catch {
        return textContent;
      }
    } else {
      return JSON.stringify(mcpResult, null, 2);
    }
  }

  private async processResults(
    functionCalls: AIFunctionCall[],
    functionResults: any[],
    context: CommandContext,
    originalPrompt: string,
  ): Promise<CommandResponse> {
    const successResults = functionResults.filter((r) => r.success);
    const errorResults = functionResults.filter((r) => !r.success);

    chatLogger.info('Function execution summary', {
      successCount: successResults.length,
      errorCount: errorResults.length,
    });

    // Check for auth errors first
    const authErrors = errorResults.filter(
      (r) => 'requiresAuth' in r && r.requiresAuth,
    );
    if (authErrors.length > 0) {
      let message = '';
      authErrors.forEach((r) => {
        message += r.message + '\n\n';
      });

      chatLogger.info('Returning auth-required response');
      await this.saveConversationTurn(context, originalPrompt, message);
      return { content: message.trim() };
    }

    // Use the new loop-based approach instead of generateContextualResponse
    return await this.processWithLoop(
      functionCalls,
      functionResults,
      context,
      originalPrompt,
    );
  }

  private buildFunctionContext(
    functionCalls: AIFunctionCall[],
    functionResults: any[],
    successResults: any[],
    errorResults: any[],
  ): string {
    let functionResultsContext = '';

    if (successResults.length > 0) {
      functionResultsContext += 'Function call results:\n\n';
      for (let i = 0; i < functionCalls.length; i++) {
        const functionCall = functionCalls[i];
        const result = functionResults[i];
        if (result.success) {
          // Extract actual data from structured results
          let resultData = '';

          // Handle AIFunctionResult interface
          if ('data' in result && result.data) {
            resultData =
              typeof result.data === 'string'
                ? result.data
                : JSON.stringify(result.data, null, 2);
          } else if (
            result.message &&
            !result.message.includes('🌤️') &&
            !result.message.includes('✅')
          ) {
            // Use message if it doesn't contain formatting emojis
            resultData = result.message;
          } else {
            resultData = JSON.stringify(result, null, 2);
          }

          functionResultsContext += `${functionCall.name}(${JSON.stringify(functionCall.arguments)}): ${resultData}\n\n`;
        }
      }
    }

    if (errorResults.length > 0) {
      functionResultsContext += 'Function call errors:\n';
      errorResults.forEach((r, i) => {
        functionResultsContext += `Error: ${r.message}\n`;
      });
    }

    return functionResultsContext;
  }

  private async processWithLoop(
    initialFunctionCalls: AIFunctionCall[],
    initialFunctionResults: any[],
    context: CommandContext,
    originalPrompt: string,
  ): Promise<CommandResponse> {
    chatLogger.info('Processing with loop-based approach');

    const conversationHistory: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: Date;
    }> = [{ role: 'user', content: originalPrompt, timestamp: new Date() }];

    // Add initial function results to conversation
    let functionResultsContext = this.buildFunctionContext(
      initialFunctionCalls,
      initialFunctionResults,
      initialFunctionResults.filter((r) => r.success),
      initialFunctionResults.filter((r) => !r.success),
    );

    if (functionResultsContext) {
      conversationHistory.push({
        role: 'assistant',
        content: `Tool results:\n${functionResultsContext}`,
        timestamp: new Date(),
      });
    }

    const maxIterations = 5; // Prevent infinite loops
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      chatLogger.info(`Loop iteration ${iteration}/${maxIterations}`);

      try {
        // Get the last user message or a summary prompt for follow-up iterations
        const currentPrompt =
          iteration === 1
            ? `Based on the tool results above, provide a helpful response to the user's request: "${originalPrompt}"`
            : 'Continue processing based on the conversation above.';

        const response = await this.llmService.generateResponse(
          currentPrompt,
          {
            userId: context.userId,
            channelId: context.channelId,
            history: conversationHistory.slice(-10), // Keep recent context
          },
          context.userId,
        );

        // Handle different response types
        let textResponse: string | undefined;

        if (typeof response === 'string') {
          // String response - we're done
          textResponse = response;
        } else if (typeof response === 'object' && 'response' in response) {
          // Structured response with message history - we're done
          textResponse = response.response;
        } else if (Array.isArray(response)) {
          // Deprecated array format - execute function calls
          const functionCalls = response as AIFunctionCall[];
          if (functionCalls.length > 0) {
            chatLogger.info(
              `Executing ${functionCalls.length} additional function calls in iteration ${iteration}`,
            );

            const newFunctionResults = [];
            for (const functionCall of functionCalls) {
              try {
                const result = await this.executeFunctionCall(
                  functionCall,
                  context,
                );
                newFunctionResults.push(result);
              } catch (error) {
                chatLogger.error(
                  'Function call failed in loop',
                  error instanceof Error ? error : new Error(String(error)),
                );
                newFunctionResults.push({
                  success: false,
                  message: `Failed to execute ${functionCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
              }
            }

            // Add new function results to conversation history
            const newResultsContext = this.buildFunctionContext(
              functionCalls,
              newFunctionResults,
              newFunctionResults.filter((r) => r.success),
              newFunctionResults.filter((r) => !r.success),
            );

            if (newResultsContext) {
              conversationHistory.push({
                role: 'assistant',
                content: `Additional tool results:\n${newResultsContext}`,
                timestamp: new Date(),
              });
            }
            // Continue loop
            continue;
          } else {
            // Empty array - treat as completed
            textResponse = 'I processed your request successfully.';
          }
        }

        // If we have a text response, we're done
        if (textResponse) {
          chatLogger.info('Loop completed with text response', {
            iterations: iteration,
            responseLength: textResponse.length,
          });
          await this.saveConversationTurn(
            context,
            originalPrompt,
            textResponse,
          );
          return { content: textResponse };
        }

        // This shouldn't happen, but just in case
        chatLogger.warn('Unexpected response format in loop', { iteration });
      } catch (error) {
        chatLogger.error(
          'Error in loop iteration',
          error instanceof Error ? error : new Error(String(error)),
        );
        const errorMessage = `I encountered an error while processing your request (iteration ${iteration}).`;
        await this.saveConversationTurn(context, originalPrompt, errorMessage);
        return { content: errorMessage };
      }
    }

    // If we exit the loop due to max iterations, provide a summary
    chatLogger.warn('Loop exited due to max iterations reached');
    const summaryMessage =
      'I processed multiple steps of your request but reached the maximum processing limit. The actions have been completed.';
    await this.saveConversationTurn(context, originalPrompt, summaryMessage);
    return { content: summaryMessage };
  }

  /**
   * Split a long response into multiple Discord-compatible messages
   * Tries to split at natural boundaries (paragraphs, sentences, words)
   */
  private splitIntoMessages(
    response: string,
    maxLength: number = 1950,
  ): string[] {
    if (response.length <= maxLength) {
      return [response];
    }

    chatLogger.info(
      'Response exceeds Discord limit, splitting into multiple messages',
      {
        originalLength: response.length,
        maxLength,
        estimatedParts: Math.ceil(response.length / maxLength),
      },
    );

    const messages: string[] = [];
    let remaining = response;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        messages.push(remaining);
        break;
      }

      // Find a good split point within the max length
      const chunk = remaining.substring(0, maxLength);

      // Try to find natural break points
      const lastParagraph = chunk.lastIndexOf('\n\n');
      const lastNewline = chunk.lastIndexOf('\n');
      const lastSentence = Math.max(
        chunk.lastIndexOf('. '),
        chunk.lastIndexOf('! '),
        chunk.lastIndexOf('? '),
      );
      const lastComma = chunk.lastIndexOf(', ');
      const lastSpace = chunk.lastIndexOf(' ');

      let splitPoint = maxLength;

      // Prefer paragraph breaks (best for readability)
      if (lastParagraph > maxLength * 0.5) {
        splitPoint = lastParagraph + 2; // Include the \n\n
      }
      // Then single newlines
      else if (lastNewline > maxLength * 0.6) {
        splitPoint = lastNewline + 1;
      }
      // Then sentence endings
      else if (lastSentence > maxLength * 0.6) {
        splitPoint = lastSentence + 2; // Include the punctuation and space
      }
      // Then commas
      else if (lastComma > maxLength * 0.7) {
        splitPoint = lastComma + 2;
      }
      // Finally, word boundaries
      else if (lastSpace > maxLength * 0.7) {
        splitPoint = lastSpace + 1;
      }

      messages.push(remaining.substring(0, splitPoint).trim());
      remaining = remaining.substring(splitPoint).trim();
    }

    chatLogger.info(`Split response into ${messages.length} messages`);
    return messages;
  }

  /**
   * @deprecated Use splitIntoMessages instead
   * Legacy function kept for backward compatibility
   */
  private ensureDiscordLimit(
    response: string,
    maxLength: number = 1950,
  ): string {
    const messages = this.splitIntoMessages(response, maxLength);
    if (messages.length > 1) {
      chatLogger.warn(
        'ensureDiscordLimit called but response needs multiple messages',
      );
    }
    return messages[0];
  }

  private async saveConversationTurn(
    context: CommandContext,
    userMessage: string,
    aiResponse: string,
  ): Promise<void> {
    try {
      chatLogger.info('Saving conversation turn to database');

      await this.database.saveConversationTurn(
        context.userId,
        context.channelId,
        userMessage,
        aiResponse,
      );

      chatLogger.info('Conversation turn saved successfully');
    } catch (error) {
      chatLogger.error(
        'Failed to save conversation',
        error instanceof Error ? error : new Error(String(error)),
      );
      // Don't throw - conversation saving failure shouldn't break the command
    }
  }

  // New method: Save conversation with full message history including tool calls
  private async saveConversationWithMessages(
    context: CommandContext,
    messages: any[], // OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    userPrompt: string,
  ): Promise<void> {
    try {
      chatLogger.info('Saving conversation with full message history', {
        messageCount: messages.length,
      });

      // Convert OpenAI message format to our ConversationMessage format
      const now = new Date();
      const conversationMessages: ConversationMessage[] = messages.map(
        (msg, index) => {
          const baseMessage: ConversationMessage = {
            role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
            content: typeof msg.content === 'string' ? msg.content : null,
            timestamp: new Date(now.getTime() + index), // Ensure ordering
          };

          // Handle assistant messages with tool calls
          if (msg.role === 'assistant' && msg.tool_calls) {
            baseMessage.tool_calls = msg.tool_calls.map((tc: any) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            }));
          }

          // Handle tool result messages
          if (msg.role === 'tool') {
            baseMessage.tool_call_id = msg.tool_call_id;
            // Extract tool name from the tool_call_id or message content
            // Tool names are typically in the format: mcp_servername_toolname
            baseMessage.tool_name = msg.tool_call_id?.split('_')[0] || 'tool';
          }

          return baseMessage;
        },
      );

      await this.database.saveMessages(
        context.userId,
        context.channelId,
        conversationMessages,
      );

      chatLogger.info('Conversation with message history saved successfully');
    } catch (error) {
      chatLogger.error(
        'Failed to save conversation with messages',
        error instanceof Error ? error : new Error(String(error)),
      );
      // Don't throw - conversation saving failure shouldn't break the command
    }
  }
}
