import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import {
  BaseCommand,
  CommandContext,
  CommandResponse,
  CommandCategory,
  AIFunctionCall,
  DatabaseService,
} from '../../types/index.js';
import { LLMService } from '../../services/llm.js';
import { chatLogger } from '../../utils/logger.js';
import { ErrorHandler, AuthenticationError } from '../../utils/errors.js';

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
      );
  }

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const prompt = interaction.options.getString('message', true);

    console.log('🔍 Chat executeSlash called:', {
      interactionId: interaction.id,
      isDeferred: interaction.deferred,
      isReplied: interaction.replied,
      userId: interaction.user.id,
    });

    // Acknowledge the interaction immediately - before any other processing
    try {
      await interaction.deferReply();
      console.log(
        '✅ Successfully deferred reply for interaction:',
        interaction.id,
      );
    } catch (error) {
      console.error('❌ Failed to defer reply:', error);
      console.log('🔍 Interaction state when defer failed:', {
        interactionId: interaction.id,
        isDeferred: interaction.deferred,
        isReplied: interaction.replied,
        createdTimestamp: interaction.createdTimestamp,
        age: Date.now() - interaction.createdTimestamp,
      });
      return;
    }

    chatLogger.info('Chat slash command executed', {
      userId: interaction.user.id,
      prompt: prompt.substring(0, 100),
    });

    try {
      // Create a context object compatible with the existing execute method
      const context: CommandContext = {
        interaction,
        args: [],
        userId: interaction.user.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId || undefined,
      };

      // Call the existing execute method
      const response = await this.executeInternal(context, prompt);

      // Send the response using editReply since we deferred
      if (response) {
        await interaction.editReply({
          content: response.content || undefined,
          embeds: response.embeds || undefined,
          files: response.files || undefined,
          components: response.components || undefined,
        });
      } else {
        await interaction.editReply({ content: '✅ Done.' });
      }
    } catch (error) {
      chatLogger.error(
        'Error in chat slash command',
        error instanceof Error ? error : new Error(String(error)),
      );

      await interaction.editReply({
        content:
          'Sorry, I encountered an error while processing your request. Please try again later.',
      });
    }
  }

  private async executeInternal(
    context: CommandContext,
    prompt: string,
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

    try {
      // Since we're only supporting slash commands now, we don't need to check
      // - the interaction is always deferred in executeSlash before calling this

      // No longer include task management functions in chat
      // Task management is now handled by the dedicated /tasks command
      const functions: any[] = [];
      chatLogger.info(
        'Chat command no longer includes task management functions',
      );

      // Load conversation history from database
      const history = await this.database.getConversationHistory(
        context.userId,
        context.channelId,
        10, // Keep last 10 messages for context
      );
      chatLogger.info('Loaded conversation history', {
        userId: context.userId,
        channelId: context.channelId,
        historyCount: history.length,
      });

      // Generate response from LLM
      chatLogger.info('Calling LLM service', { userId: context.userId });
      const response = await this.llmService.generateResponse(
        prompt,
        {
          userId: context.userId,
          channelId: context.channelId,
          history: history, // Use actual conversation history
        },
        functions,
        context.userId, // Pass userId for MCP integration
      );

      const isFunction = Array.isArray(response);
      chatLogger.info('LLM response received', {
        type: isFunction ? 'function_calls' : 'text',
        functionCount: isFunction ? response.length : 0,
      });

      // Handle function calls or text response
      if (Array.isArray(response)) {
        return await this.handleFunctionCalls(response, context, prompt);
      } else {
        // Regular text response
        chatLogger.info('Returning text response', {
          length: response.length,
          preview: response.substring(0, 100),
        });

        // Save conversation to database
        await this.saveConversationTurn(context, prompt, response);
        return { content: response };
      }
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

    // Build context for AI response
    let functionResultsContext = this.buildFunctionContext(
      functionCalls,
      functionResults,
      successResults,
      errorResults,
    );

    if (functionResultsContext) {
      return await this.generateContextualResponse(
        functionResultsContext,
        originalPrompt,
        context,
      );
    }

    // Fallback if no function results context
    const message =
      "I attempted to process your request but didn't get any results.";
    chatLogger.info('No function results context, using fallback response');
    await this.saveConversationTurn(context, originalPrompt, message);
    return { content: message };
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

  private async generateContextualResponse(
    functionResultsContext: string,
    originalPrompt: string,
    context: CommandContext,
  ): Promise<CommandResponse> {
    chatLogger.info('Generating contextual response based on function results');

    const contextualPrompt = `Based on the following function call results, provide a helpful and natural response to the user's original request: "${originalPrompt}"\n\n${functionResultsContext}\n\nProvide a conversational response that summarizes and interprets the results for the user.`;

    try {
      const contextualResponse = await this.llmService.generateResponse(
        contextualPrompt,
        {
          userId: context.userId,
          channelId: context.channelId,
          history: [], // Don't include full history for this follow-up call
        },
        [], // No functions for the follow-up response
        context.userId,
      );

      const finalResponse = Array.isArray(contextualResponse)
        ? 'I processed your request but encountered an issue generating the response.'
        : contextualResponse;

      chatLogger.info('Generated contextual response', {
        length: finalResponse.length,
        preview: finalResponse.substring(0, 200),
      });
      await this.saveConversationTurn(context, originalPrompt, finalResponse);
      return { content: finalResponse };
    } catch (error) {
      chatLogger.error(
        'Failed to generate contextual response',
        error instanceof Error ? error : new Error(String(error)),
      );

      // Fallback to original formatted response
      const successResults = this.extractSuccessResults(functionResultsContext);
      const errorResults = this.extractErrorResults(functionResultsContext);

      let fallbackMessage = '';
      if (successResults.length > 0) {
        fallbackMessage += successResults.join('\n\n');
      }
      if (errorResults.length > 0) {
        if (fallbackMessage) fallbackMessage += '\n\n';
        fallbackMessage += '❌ **Errors:**\n' + errorResults.join('\n');
      }

      await this.saveConversationTurn(context, originalPrompt, fallbackMessage);
      return { content: fallbackMessage };
    }
  }

  private extractSuccessResults(context: string): string[] {
    // Simple extraction - in a real implementation, you'd parse this properly
    return [];
  }

  private extractErrorResults(context: string): string[] {
    // Simple extraction - in a real implementation, you'd parse this properly
    return [];
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
}
