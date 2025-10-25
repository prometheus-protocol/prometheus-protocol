import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigManager } from '../config/index.js';
import {
  DatabaseService,
  ConversationContext,
  ConversationMessage,
  UserTaskData,
  SavedMCPConnection,
  AlertConfig,
} from '../types/index.js';
import { dbLogger } from '../utils/logger.js';
import { oauthSecurityService } from './oauth-security.service.js';

export class SupabaseService implements DatabaseService {
  private client: SupabaseClient;

  constructor(config: ConfigManager) {
    const dbConfig = config.getDatabase();
    this.client = createClient(dbConfig.supabaseUrl, dbConfig.supabaseKey);
  }

  async saveConversation(context: ConversationContext): Promise<void> {
    // Save each message in the context
    for (const message of context.history) {
      await this.client.from('conversation_history').insert({
        user_id: context.userId,
        channel_id: context.channelId,
        message_type: message.role,
        content: message.content,
        created_at: message.timestamp.toISOString(),
      });
    }
  }

  async saveConversationTurn(
    userId: string,
    channelId: string,
    userMessage: string,
    assistantMessage: string,
    functionCalls?: any[],
    functionResults?: any[],
  ): Promise<void> {
    const conversationEntries = [];

    // Save user message
    conversationEntries.push({
      user_id: userId,
      channel_id: channelId,
      message_type: 'user',
      content: userMessage,
      function_calls: null,
      function_results: null,
    });

    // Save assistant response
    conversationEntries.push({
      user_id: userId,
      channel_id: channelId,
      message_type: 'assistant',
      content: assistantMessage,
      function_calls: functionCalls ? JSON.stringify(functionCalls) : null,
      function_results: functionResults
        ? JSON.stringify(functionResults)
        : null,
    });

    const { error } = await this.client
      .from('conversation_history')
      .insert(conversationEntries);

    if (error) {
      dbLogger.error('Error saving conversation turn:', error);
      throw error;
    }

    // Prune old messages to keep only the last 50 (async, don't await to avoid blocking)
    this.pruneOldMessages(userId, channelId, 50).catch((err) => {
      dbLogger.warn('Failed to prune old messages (non-blocking)', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  async getConversationHistory(
    userId: string,
    channelId: string,
    limit: number = 20,
  ): Promise<ConversationMessage[]> {
    const { data, error } = await this.client
      .from('conversation_history')
      .select('*')
      .eq('user_id', userId)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      dbLogger.error('Error fetching conversation history:', error);
      return [];
    }

    return (data || []).reverse().map((row) => ({
      role: row.message_type as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: new Date(row.created_at),
    }));
  }

  async clearConversationHistory(
    userId: string,
    channelId: string,
  ): Promise<number> {
    const { data, error } = await this.client
      .from('conversation_history')
      .delete()
      .eq('user_id', userId)
      .eq('channel_id', channelId)
      .select();

    if (error) {
      dbLogger.error('Error clearing conversation history:', error);
      throw new Error('Failed to clear conversation history');
    }

    const deletedCount = data?.length || 0;
    dbLogger.info('Conversation history cleared', {
      userId,
      channelId,
      deletedCount,
    });

    return deletedCount;
  }

  async pruneOldMessages(
    userId: string,
    channelId: string,
    keepCount: number = 50,
  ): Promise<number> {
    try {
      // Get all messages for this user/channel ordered by date
      const { data: allMessages, error: fetchError } = await this.client
        .from('conversation_history')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        dbLogger.error('Error fetching messages for pruning:', fetchError);
        return 0;
      }

      // If we have more than keepCount messages, delete the oldest ones
      if (allMessages && allMessages.length > keepCount) {
        const messagesToDelete = allMessages.slice(keepCount);
        const idsToDelete = messagesToDelete.map((msg) => msg.id);

        const { error: deleteError } = await this.client
          .from('conversation_history')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          dbLogger.error('Error pruning old messages:', deleteError);
          return 0;
        }

        dbLogger.info('Pruned old conversation messages', {
          userId,
          channelId,
          deletedCount: idsToDelete.length,
          kept: keepCount,
        });

        return idsToDelete.length;
      }

      return 0;
    } catch (error) {
      dbLogger.error(
        'Error in pruneOldMessages:',
        error instanceof Error ? error : new Error(String(error)),
      );
      return 0;
    }
  }

  async saveAlertState(
    alertId: string,
    data: any,
    timestamp: Date,
  ): Promise<void> {
    await this.client.from('alert_states').upsert({
      alert_id: alertId,
      data: JSON.stringify(data),
      timestamp: timestamp.toISOString(),
    });
  }

  async getLastAlertState(
    alertId: string,
  ): Promise<{ data: any; timestamp: Date } | null> {
    const { data, error } = await this.client
      .from('alert_states')
      .select('*')
      .eq('alert_id', alertId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      data: JSON.parse(data.data),
      timestamp: new Date(data.timestamp),
    };
  }

  async saveAlert(alert: AlertConfig): Promise<void> {
    try {
      const { error } = await this.client.from('alert_configs').upsert({
        id: alert.id,
        name: alert.name,
        description: alert.description,
        user_id: alert.userId, // Save userId field
        channel_id: alert.channelId,
        interval: alert.interval,
        enabled: alert.enabled,
        recurring: alert.recurring ?? true, // Default to true if not specified
        prompt: alert.prompt,
        last_run: alert.lastRun?.toISOString() || null,
        last_data: alert.lastData ? JSON.stringify(alert.lastData) : null,
        error_state: alert.errorState ? JSON.stringify(alert.errorState) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        dbLogger.error('Failed to save alert configuration', error, {
          alertId: alert.id,
        });
        throw error;
      }

      dbLogger.info('Alert configuration saved successfully', {
        alertId: alert.id,
        alertName: alert.name,
      });
    } catch (error) {
      dbLogger.error(
        'Error saving alert configuration',
        error instanceof Error ? error : new Error(String(error)),
        { alertId: alert.id },
      );
      throw error;
    }
  }

  async loadAlerts(): Promise<AlertConfig[]> {
    try {
      const { data, error } = await this.client
        .from('alert_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        dbLogger.error('Failed to load alert configurations', error);
        throw error;
      }

      const alerts = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        userId: row.user_id, // Load userId field
        channelId: row.channel_id,
        interval: row.interval,
        enabled: row.enabled,
        recurring: row.recurring ?? true, // Default to true for backwards compatibility
        prompt: row.prompt,
        lastRun: row.last_run ? new Date(row.last_run) : undefined,
        lastData: row.last_data ? JSON.parse(row.last_data) : undefined,
        errorState: row.error_state ? JSON.parse(row.error_state) : undefined,
      }));

      dbLogger.info('Alert configurations loaded successfully', {
        alertCount: alerts.length,
      });

      return alerts;
    } catch (error) {
      dbLogger.error(
        'Error loading alert configurations',
        error instanceof Error ? error : new Error(String(error)),
      );
      return [];
    }
  }

  async updateAlert(alert: AlertConfig): Promise<void> {
    try {
      const { error } = await this.client
        .from('alert_configs')
        .update({
          name: alert.name,
          description: alert.description,
          user_id: alert.userId, // Include userId in updates
          channel_id: alert.channelId,
          interval: alert.interval,
          enabled: alert.enabled,
          recurring: alert.recurring ?? true, // Include recurring field
          prompt: alert.prompt,
          last_run: alert.lastRun?.toISOString() || null,
          last_data: alert.lastData ? JSON.stringify(alert.lastData) : null,
          error_state: alert.errorState
            ? JSON.stringify(alert.errorState)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', alert.id);

      if (error) {
        dbLogger.error('Failed to update alert configuration', error, {
          alertId: alert.id,
        });
        throw error;
      }

      dbLogger.info('Alert configuration updated successfully', {
        alertId: alert.id,
        alertName: alert.name,
      });
    } catch (error) {
      dbLogger.error(
        'Error updating alert configuration',
        error instanceof Error ? error : new Error(String(error)),
        { alertId: alert.id },
      );
      throw error;
    }
  }

  async deleteAlert(alertId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('alert_configs')
        .delete()
        .eq('id', alertId);

      if (error) {
        dbLogger.error('Failed to delete alert configuration', error, {
          alertId,
        });
        throw error;
      }

      dbLogger.info('Alert configuration deleted successfully', { alertId });
    } catch (error) {
      dbLogger.error(
        'Error deleting alert configuration',
        error instanceof Error ? error : new Error(String(error)),
        { alertId },
      );
      throw error;
    }
  }

  async saveUserPreferences(
    userId: string,
    preferences: Record<string, any>,
  ): Promise<void> {
    await this.client.from('user_preferences').upsert({
      user_id: userId,
      preferences: JSON.stringify(preferences),
      updated_at: new Date().toISOString(),
    });
  }

  async getUserPreferences(userId: string): Promise<Record<string, any>> {
    const { data, error } = await this.client
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {};
    }

    return JSON.parse(data.preferences);
  }

  // User task management methods
  async saveUserTask(task: UserTaskData): Promise<void> {
    await this.client.from('user_tasks').insert({
      id: task.id,
      user_id: task.userId,
      channel_id: task.channelId,
      prompt: task.prompt,
      interval: task.interval,
      description: task.description,
      enabled: task.enabled,
      recurring: task.recurring ?? true, // Default to true if not specified
      created_at: task.createdAt.toISOString(),
      last_run: task.lastRun?.toISOString(),
    });
  }

  async getUserTasks(userId: string): Promise<UserTaskData[]> {
    const { data, error } = await this.client
      .from('user_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      dbLogger.error('Error fetching user tasks:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      channelId: row.channel_id,
      prompt: row.prompt,
      interval: row.interval,
      description: row.description,
      enabled: row.enabled,
      recurring: row.recurring ?? true, // Default to true for backwards compatibility
      createdAt: new Date(row.created_at),
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
    }));
  }

  async getUserTask(
    userId: string,
    taskId: string,
  ): Promise<UserTaskData | null> {
    const { data, error } = await this.client
      .from('user_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('id', taskId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      channelId: data.channel_id,
      prompt: data.prompt,
      interval: data.interval,
      description: data.description,
      enabled: data.enabled,
      recurring: data.recurring ?? true, // Default to true for backwards compatibility
      createdAt: new Date(data.created_at),
      lastRun: data.last_run ? new Date(data.last_run) : undefined,
    };
  }

  async updateTaskEnabled(taskId: string, enabled: boolean): Promise<void> {
    await this.client.from('user_tasks').update({ enabled }).eq('id', taskId);
  }

  async updateTaskInterval(taskId: string, interval: number): Promise<void> {
    await this.client.from('user_tasks').update({ interval }).eq('id', taskId);
  }

  async updateTaskLastRun(taskId: string, lastRun: Date): Promise<void> {
    await this.client
      .from('user_tasks')
      .update({ last_run: lastRun.toISOString() })
      .eq('id', taskId);
  }

  async deleteUserTask(taskId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('user_tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        dbLogger.error('Failed to delete user task', error, {
          taskId,
        });
        throw new Error(`Failed to delete user task: ${error.message}`);
      }

      dbLogger.info('User task deleted successfully', { taskId });
    } catch (error) {
      dbLogger.error(
        'Error deleting user task',
        error instanceof Error ? error : new Error(String(error)),
        { taskId },
      );
      throw error;
    }
  }

  // === OAuth Persistence ===
  async saveOAuthPending(pending: {
    server_id: string;
    user_id: string;
    state: string;
    code_verifier: string;
    auth_url: string;
  }): Promise<void> {
    dbLogger.info(`🔍 [DB] saveOAuthPending called with:`, {
      server_id: pending.server_id,
      user_id: pending.user_id,
      state: pending.state,
      code_verifier: pending.code_verifier?.substring(0, 20) + '...',
      auth_url: pending.auth_url?.substring(0, 50) + '...',
    });

    // First, let's see what currently exists
    const { data: existing } = await this.client
      .from('oauth_pending')
      .select('*')
      .eq('server_id', pending.server_id)
      .eq('user_id', pending.user_id);

    if (existing && existing.length > 0) {
      dbLogger.info('🔍 [DB] Existing oauth_pending row before update:', {
        current_state: existing[0].state,
        new_state: pending.state,
        will_overwrite: existing[0].state !== pending.state,
      });
    }

    const { data, error } = await this.client.from('oauth_pending').upsert(
      {
        server_id: pending.server_id,
        user_id: pending.user_id,
        state: pending.state,
        code_verifier: pending.code_verifier,
        auth_url: pending.auth_url,
      },
      {
        onConflict: 'server_id,user_id',
      },
    );

    if (error) {
      dbLogger.error('🔍 [DB] saveOAuthPending error:', error);
      throw error;
    }

    // Verify the update worked
    const { data: updated } = await this.client
      .from('oauth_pending')
      .select('state')
      .eq('server_id', pending.server_id)
      .eq('user_id', pending.user_id)
      .single();

    dbLogger.info('saveOAuthPending result', {
      hasData: !!data,
      verified_state: updated?.state,
      expected_state: pending.state,
      state_match: updated?.state === pending.state,
    });

    if (error) {
      throw error;
    }
  }

  async getAllOAuthPending(): Promise<any[]> {
    dbLogger.info('🔍 [DB] Fetching all oauth_pending rows for debugging');

    const { data, error } = await this.client
      .from('oauth_pending')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      dbLogger.error('🔍 [DB] Error fetching all oauth_pending rows:', error);
      return [];
    }

    return data || [];
  }

  async getOAuthPendingByState(state: string): Promise<any | null> {
    dbLogger.info(`🔍 [DB] Querying oauth_pending for state: ${state}`);

    // Debug: Show all rows first
    const { data: allRows } = await this.client
      .from('oauth_pending')
      .select('*');

    dbLogger.info('All rows in oauth_pending');
    allRows?.forEach((row, index) => {
      dbLogger.info(
        `🔍 [DB] Row ${index}: server_id=${row.server_id}, user_id=${row.user_id}, state=${row.state}`,
      );
    });

    const { data, error } = await this.client
      .from('oauth_pending')
      .select('*')
      .eq('state', state)
      .limit(1)
      .single();

    dbLogger.info('Query result');
    if (error) {
      dbLogger.info(`🔍 [DB] No rows found for state: ${state}`);
      return null;
    }

    return data;
  }

  async getOAuthPending(serverId: string, userId: string) {
    const { data, error } = await this.client
      .from('oauth_pending')
      .select('*')
      .eq('server_id', serverId)
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (error || !data) return null;
    return {
      server_id: data.server_id,
      user_id: data.user_id,
      state: data.state,
      code_verifier: data.code_verifier,
      auth_url: data.auth_url,
    };
  }

  async deleteOAuthPending(serverId: string, userId: string): Promise<void> {
    await this.client
      .from('oauth_pending')
      .delete()
      .eq('server_id', serverId)
      .eq('user_id', userId);
  }

  async saveOAuthTokens(tokens: {
    server_id: string;
    user_id: string;
    access_token: string;
    refresh_token?: string | null;
    expires_at?: Date | null;
    scope?: string | null;
    token_type?: string | null;
    raw_tokens: any;
  }): Promise<void> {
    try {
      // Validate tokens before encrypting
      const accessTokenValidation = oauthSecurityService.validateToken(
        tokens.access_token,
      );
      if (!accessTokenValidation.isValid) {
        throw new Error(
          `Invalid access token: ${accessTokenValidation.reason}`,
        );
      }

      if (tokens.refresh_token) {
        const refreshTokenValidation = oauthSecurityService.validateToken(
          tokens.refresh_token,
        );
        if (!refreshTokenValidation.isValid) {
          throw new Error(
            `Invalid refresh token: ${refreshTokenValidation.reason}`,
          );
        }
      }

      // Check rate limiting
      const rateLimitCheck = oauthSecurityService.checkRateLimit(
        tokens.user_id,
        'token_save',
      );
      if (!rateLimitCheck.allowed) {
        throw new Error('Rate limit exceeded for token operations');
      }

      // Encrypt sensitive tokens before storing
      const encryptedAccessToken = oauthSecurityService.encryptToken(
        tokens.access_token,
      );
      const encryptedRefreshToken = tokens.refresh_token
        ? oauthSecurityService.encryptToken(tokens.refresh_token)
        : null;

      // The data to be inserted or updated (with encrypted tokens)
      const tokenData = {
        server_id: tokens.server_id,
        user_id: tokens.user_id,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: tokens.expires_at ? tokens.expires_at.toISOString() : null,
        scope: tokens.scope || null,
        token_type: tokens.token_type || null,
        raw_tokens: tokens.raw_tokens, // Note: Consider encrypting this too if it contains sensitive data
        updated_at: new Date().toISOString(),
      };

      // The corrected upsert call
      const { error } = await this.client
        .from('oauth_tokens')
        .upsert(tokenData, {
          onConflict: 'server_id, user_id', // <-- THIS IS THE FIX
        });

      // Explicitly check for the error returned by the Supabase client
      if (error) {
        throw error;
      }

      // Audit log the token save operation
      oauthSecurityService.auditLog(
        'SAVE_TOKENS',
        tokens.user_id,
        tokens.server_id,
        {
          hasRefreshToken: !!tokens.refresh_token,
          expiresAt: tokens.expires_at?.toISOString(),
          scope: tokens.scope,
        },
      );

      dbLogger.info(`✅ [DB] Successfully saved encrypted OAuth tokens for:`, {
        server_id: tokens.server_id,
        user_id: tokens.user_id.substring(0, 8) + '...', // Partially redact user ID
        hasRefreshToken: !!tokens.refresh_token,
      });
    } catch (error) {
      dbLogger.error(
        'Error saving OAuth tokens:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async getOAuthTokens(
    serverId: string,
    userId: string,
    requestingUserId?: string,
  ) {
    try {
      // Validate ownership if requesting user is provided
      if (
        requestingUserId &&
        !oauthSecurityService.validateTokenOwnership(
          serverId,
          userId,
          requestingUserId,
        )
      ) {
        oauthSecurityService.auditLog(
          'UNAUTHORIZED_TOKEN_ACCESS',
          requestingUserId,
          serverId,
          {
            targetUserId: userId,
          },
        );
        throw new Error('Unauthorized: Cannot access tokens for another user');
      }

      // Check rate limiting
      const rateLimitCheck = oauthSecurityService.checkRateLimit(
        userId,
        'token_retrieve',
      );
      if (!rateLimitCheck.allowed) {
        throw new Error('Rate limit exceeded for token operations');
      }

      const { data, error } = await this.client
        .from('oauth_tokens')
        .select('*')
        .eq('server_id', serverId)
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      // Decrypt the tokens before returning
      let decryptedAccessToken: string;
      let decryptedRefreshToken: string | null = null;

      try {
        decryptedAccessToken = oauthSecurityService.decryptToken(
          data.access_token,
        );
        if (data.refresh_token) {
          decryptedRefreshToken = oauthSecurityService.decryptToken(
            data.refresh_token,
          );
        }
      } catch (decryptionError) {
        dbLogger.error(
          'Failed to decrypt OAuth tokens - they may be corrupted, cleaning up old tokens',
          new Error('Token decryption failed'),
          {
            service: 'SupabaseService',
            server_id: serverId,
            user_id: userId.substring(0, 8) + '...',
          },
        );
        // Audit log the decryption failure
        oauthSecurityService.auditLog(
          'TOKEN_DECRYPTION_FAILED',
          userId,
          serverId,
        );

        // Clean up corrupted tokens to allow fresh authentication
        try {
          await this.client
            .from('oauth_tokens')
            .delete()
            .eq('server_id', serverId)
            .eq('user_id', userId);
          dbLogger.info(
            '🧹 Cleaned up corrupted OAuth tokens for fresh authentication',
            {
              service: 'SupabaseService',
              server_id: serverId,
              user_id: userId.substring(0, 8) + '...',
            },
          );
        } catch (cleanupError) {
          dbLogger.error(
            'Failed to cleanup corrupted tokens:',
            cleanupError instanceof Error
              ? cleanupError
              : new Error(String(cleanupError)),
          );
        }

        return null;
      }

      // Note: Replay protection is handled during authentication, not retrieval
      // Normal token retrievals during MCP operations are expected and safe

      // Audit log successful token retrieval
      oauthSecurityService.auditLog('RETRIEVE_TOKENS', userId, serverId);

      return {
        server_id: data.server_id,
        user_id: data.user_id,
        access_token: decryptedAccessToken,
        refresh_token: decryptedRefreshToken,
        expires_at: data.expires_at ? new Date(data.expires_at) : null,
        scope: data.scope,
        token_type: data.token_type,
        raw_tokens: data.raw_tokens,
      };
    } catch (error) {
      dbLogger.error(
        'Error retrieving OAuth tokens:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async deleteOAuthTokens(serverId: string, userId: string): Promise<void> {
    try {
      // Audit log the token deletion
      oauthSecurityService.auditLog('DELETE_TOKENS', userId, serverId);

      const { error } = await this.client
        .from('oauth_tokens')
        .delete()
        .eq('server_id', serverId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      dbLogger.info('✅ [DB] Successfully deleted OAuth tokens', {
        server_id: serverId,
        user_id: userId.substring(0, 8) + '...',
      });
    } catch (error) {
      dbLogger.error(
        'Error deleting OAuth tokens:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  // === OAuth Client Information ===
  async saveOAuthClientInfo(
    serverId: string,
    clientInfo: any, // OAuthClientInformation type
  ): Promise<void> {
    dbLogger.info(`🔍 [DB] saveOAuthClientInfo called for server: ${serverId}`);

    const { data, error } = await this.client.from('oauth_clients').upsert(
      {
        server_id: serverId,
        client_id: clientInfo.client_id,
        client_secret: clientInfo.client_secret || null,
        client_metadata: clientInfo,
      },
      {
        onConflict: 'server_id',
      },
    );

    if (error) {
      dbLogger.error(`🔍 [DB] Error saving OAuth client info:`, error);
      throw error;
    }

    dbLogger.info(
      `🔍 [DB] OAuth client info saved successfully for server ${serverId}`,
    );
  }

  async deleteOAuthClientInfo(serverId: string): Promise<void> {
    dbLogger.info(
      `🔍 [DB] deleteOAuthClientInfo called for server: ${serverId}`,
    );

    const { error } = await this.client
      .from('oauth_clients')
      .delete()
      .eq('server_id', serverId);

    if (error) {
      dbLogger.error(`🔍 [DB] Error deleting OAuth client info:`, error);
      throw error;
    }

    dbLogger.info(
      `🔍 [DB] OAuth client info deleted successfully for server ${serverId}`,
    );
  }

  // === OAuth Server Metadata ===
  async saveOAuthServerMetadata(
    serverId: string,
    metadata: any,
  ): Promise<void> {
    dbLogger.info(
      `🔍 [DB] saveOAuthServerMetadata called for server: ${serverId}`,
    );

    const { data, error } = await this.client
      .from('oauth_server_metadata')
      .upsert(
        {
          server_id: serverId,
          metadata: metadata,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'server_id',
        },
      );

    if (error) {
      dbLogger.error(`🔍 [DB] Error saving OAuth server metadata:`, error);
      throw error;
    }

    dbLogger.info(
      `🔍 [DB] OAuth server metadata saved successfully for server ${serverId}`,
    );
  }

  async getOAuthServerMetadata(serverId: string): Promise<any | null> {
    dbLogger.info(
      `🔍 [DB] getOAuthServerMetadata called for server: ${serverId}`,
    );

    const { data, error } = await this.client
      .from('oauth_server_metadata')
      .select('*')
      .eq('server_id', serverId)
      .limit(1)
      .single();

    if (error || !data) {
      dbLogger.info('No OAuth server metadata found for server', {
        serverId,
        error: error?.message || 'no data',
      });
      return null;
    }

    dbLogger.info(`🔍 [DB] Found OAuth server metadata for server ${serverId}`);
    return data.metadata;
  }

  async deleteOAuthServerMetadata(serverId: string): Promise<void> {
    dbLogger.info(
      `🔍 [DB] deleteOAuthServerMetadata called for server: ${serverId}`,
    );

    const { error } = await this.client
      .from('oauth_server_metadata')
      .delete()
      .eq('server_id', serverId);

    if (error) {
      dbLogger.error(`🔍 [DB] Error deleting OAuth server metadata:`, error);
      throw error;
    }

    dbLogger.info(
      `🔍 [DB] OAuth server metadata deleted successfully for server ${serverId}`,
    );
  }

  async getOAuthClientInfo(serverId: string): Promise<any | null> {
    dbLogger.info(`🔍 [DB] getOAuthClientInfo called for server: ${serverId}`);

    const { data, error } = await this.client
      .from('oauth_clients')
      .select('*')
      .eq('server_id', serverId)
      .limit(1)
      .single();

    if (error || !data) {
      dbLogger.info('No OAuth client info found for server', {
        serverId,
        error: error?.message || 'no data',
      });
      return null;
    }

    dbLogger.info(
      `🔍 [DB] Found OAuth client info for server ${serverId}, client_id: ${data.client_metadata?.client_id?.substring(0, 10)}...`,
    );
    return data.client_metadata;
  }

  // === MCP Connection Persistence ===
  async saveUserMCPConnection(connection: SavedMCPConnection): Promise<void> {
    dbLogger.info(`🔗 [DB] saveUserMCPConnection called:`, {
      user_id: connection.user_id,
      server_id: connection.server_id,
      server_name: connection.server_name,
      status: connection.status,
      tools_count: connection.tools ? JSON.parse(connection.tools).length : 0,
    });

    const { data, error } = await this.client.from('mcp_connections').upsert(
      {
        user_id: connection.user_id,
        server_id: connection.server_id,
        server_name: connection.server_name,
        server_url: connection.server_url,
        status: connection.status,
        tools: connection.tools,
        error_message: connection.error_message || null,
        connected_at: connection.connected_at?.toISOString() || null,
        last_used: connection.last_used?.toISOString() || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,server_id',
      },
    );

    if (error) {
      dbLogger.error(`🔗 [DB] Error saving MCP connection:`, error);
      throw error;
    }

    dbLogger.info(`🔗 [DB] MCP connection saved successfully`);
  }

  async getUserMCPConnection(
    userId: string,
    serverId: string,
  ): Promise<SavedMCPConnection | null> {
    dbLogger.info(`🔗 [DB] getUserMCPConnection called:`, { userId, serverId });

    const { data, error } = await this.client
      .from('mcp_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('server_id', serverId)
      .limit(1)
      .single();

    if (error || !data) {
      dbLogger.info('No MCP connection found', {
        error: error?.message || 'no data',
      });
      return null;
    }

    const connection: SavedMCPConnection = {
      user_id: data.user_id,
      server_id: data.server_id,
      server_name: data.server_name,
      server_url: data.server_url,
      status: data.status,
      tools: data.tools || '[]',
      error_message: data.error_message,
      connected_at: data.connected_at ? new Date(data.connected_at) : null,
      last_used: data.last_used ? new Date(data.last_used) : null,
    };

    dbLogger.info(`🔗 [DB] Found MCP connection:`, {
      server_name: connection.server_name,
      status: connection.status,
    });

    return connection;
  }

  async getUserMCPConnections(userId: string): Promise<SavedMCPConnection[]> {
    dbLogger.info('getUserMCPConnections called for user', { userId });

    const { data, error } = await this.client
      .from('mcp_connections')
      .select('*')
      .eq('user_id', userId)
      .order('connected_at', { ascending: false });

    if (error) {
      dbLogger.error(`🔗 [DB] Error fetching user MCP connections:`, error);
      return [];
    }

    const connections: SavedMCPConnection[] = (data || []).map((row: any) => ({
      user_id: row.user_id,
      server_id: row.server_id,
      server_name: row.server_name,
      server_url: row.server_url,
      status: row.status,
      tools: row.tools || '[]',
      error_message: row.error_message,
      connected_at: row.connected_at ? new Date(row.connected_at) : null,
      last_used: row.last_used ? new Date(row.last_used) : null,
    }));

    dbLogger.info(
      `🔗 [DB] Found ${connections.length} MCP connections for user ${userId}`,
    );
    return connections;
  }

  async updateUserMCPConnection(
    userId: string,
    serverId: string,
    updates: Partial<SavedMCPConnection>,
  ): Promise<void> {
    dbLogger.info(`🔗 [DB] updateUserMCPConnection called:`, {
      userId,
      serverId,
      updates,
    });

    const updateData: any = {};

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.tools !== undefined) updateData.tools = updates.tools;
    if (updates.error_message !== undefined)
      updateData.error_message = updates.error_message;
    if (updates.last_used !== undefined)
      updateData.last_used = updates.last_used?.toISOString();
    if (updates.server_url !== undefined)
      updateData.server_url = updates.server_url;
    if (updates.server_name !== undefined)
      updateData.server_name = updates.server_name;

    const { error } = await this.client
      .from('mcp_connections')
      .update(updateData)
      .eq('user_id', userId)
      .eq('server_id', serverId);

    if (error) {
      dbLogger.error(`🔗 [DB] Error updating MCP connection:`, error);
      throw error;
    }

    dbLogger.info(`🔗 [DB] MCP connection updated successfully`);
  }

  async deleteUserMCPConnection(
    userId: string,
    serverId: string,
  ): Promise<void> {
    dbLogger.info(`🔗 [DB] deleteUserMCPConnection called:`, {
      userId,
      serverId,
    });

    const { error } = await this.client
      .from('mcp_connections')
      .delete()
      .eq('user_id', userId)
      .eq('server_id', serverId);

    if (error) {
      dbLogger.error(`🔗 [DB] Error deleting MCP connection:`, error);
      throw error;
    }

    dbLogger.info(`🔗 [DB] MCP connection deleted successfully`);
  }

  // Connection Pool Service methods
  async storeConnectionDetails(
    userId: string,
    mcpServerConfigId: string,
    status: string,
    metadata?: any,
  ): Promise<void> {
    // Log the connection attempt for tracking purposes
    console.log('Storing connection details:', {
      userId,
      mcpServerConfigId,
      status,
      metadata,
    });

    dbLogger.info(`🔗 [DB] storeConnectionDetails called:`, {
      userId,
      mcpServerConfigId,
      status,
      metadata,
    });

    // First check if connection already exists
    const existingConnection = await this.getUserMCPConnection(
      userId,
      mcpServerConfigId,
    );

    if (existingConnection) {
      // Update existing connection
      const dbStatus = this.mapStatusToDatabase(status);
      const updateData: any = {
        status: dbStatus,
      };

      // Note: metadata and updated_at are not stored in the database schema, only logged for debugging

      const { error } = await this.client
        .from('mcp_connections')
        .update(updateData)
        .eq('user_id', userId)
        .eq('server_id', mcpServerConfigId);

      if (error) {
        dbLogger.error(`🔗 [DB] Error updating connection details:`, error);
        throw error;
      }

      dbLogger.info(`🔗 [DB] Connection details updated successfully`);
    } else {
      // Create new connection record (though this should rarely happen as connections are usually created via saveUserMCPConnection)
      dbLogger.warn(
        `🔗 [DB] Connection not found, cannot store details without server_url`,
      );
    }
  }

  // Map internal status values to database-allowed values
  private mapStatusToDatabase(internalStatus: string): string {
    const statusMap: { [key: string]: string } = {
      ACTIVE: 'connected',
      RECONNECTING: 'connected',
      RECONNECTING_ON_STARTUP: 'connected',
      CONNECTION_REQUESTED: 'connected',
      DISCONNECTED_UNEXPECTEDLY: 'disconnected',
      FAILED_CONNECTION: 'error',
      AUTH_PENDING: 'auth-required',
      connected: 'connected',
      disconnected: 'disconnected',
      error: 'error',
      'auth-required': 'auth-required',
    };

    return statusMap[internalStatus] || 'error'; // Default to 'error' for unknown statuses
  }

  async updateConnectionStatus(
    userId: string,
    mcpServerConfigId: string,
    mcpServerUrl: string,
    status: string,
    metadata?: any,
  ): Promise<void> {
    // Log the connection status update for tracking purposes
    console.log('Updating connection status:', {
      userId,
      mcpServerConfigId,
      mcpServerUrl,
      status,
      metadata,
    });

    dbLogger.info(`🔗 [DB] updateConnectionStatus called:`, {
      userId,
      mcpServerConfigId,
      mcpServerUrl,
      status,
      metadata,
    });

    const dbStatus = this.mapStatusToDatabase(status);
    const updateData: any = {
      status: dbStatus,
      server_url: mcpServerUrl,
    };

    // Generate a human-readable fallback name from the URL
    let fallbackServerName = 'MCP Server';
    try {
      const url = new URL(mcpServerUrl);
      fallbackServerName = url.hostname;
    } catch {
      // If URL parsing fails, just use generic name
      fallbackServerName = 'MCP Server';
    }

    // Note: metadata and updated_at are not stored in the database schema, only logged for debugging

    // Use UPSERT to handle both insert and update cases
    const connectionData: any = {
      user_id: userId,
      server_id: mcpServerConfigId,
      server_url: mcpServerUrl,
      server_name: fallbackServerName, // Use hostname from URL as fallback name initially
      status: dbStatus,
      tools: '[]',
      connected_at: new Date().toISOString(),
    };

    // Add error message if it's a failed connection
    if (
      (dbStatus === 'error' || dbStatus === 'disconnected') &&
      metadata?.lastFailureError
    ) {
      connectionData.error_message = metadata.lastFailureError;
    }

    const { data, error } = await this.client
      .from('mcp_connections')
      .upsert(connectionData, {
        onConflict: 'user_id,server_id',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      dbLogger.error(`🔗 [DB] Error upserting connection status:`, error);
      throw error;
    }

    dbLogger.info(`🔗 [DB] Connection status upserted successfully`, {
      rowsAffected: data ? data.length : 0,
      serverId: mcpServerConfigId,
      status: dbStatus,
    });
  }

  async getReconnectableConnections(): Promise<any[]> {
    console.log('Getting reconnectable connections');
    try {
      const { data, error } = await this.client
        .from('mcp_connections')
        .select('*')
        .in('status', [
          'ACTIVE',
          'RECONNECTING',
          'CONNECTION_REQUESTED',
          'connected',
          'error',
          'FAILED_INVOKE_TOOL',
        ])
        .not('status', 'eq', 'DISCONNECTED_BY_USER')
        .not('status', 'eq', 'CONNECTION_FAILED');

      if (error) {
        dbLogger.error('Error fetching reconnectable connections:', error);
        throw error;
      }

      dbLogger.info(
        `Found ${data?.length || 0} reconnectable connections in database`,
      );
      return (data || []).map((conn: any) => ({
        userId: conn.user_id,
        mcpServerConfigId: conn.server_id,
        mcpServerBaseUrl: conn.server_url,
        status: conn.status,
        metadata: conn.metadata,
      }));
    } catch (error) {
      dbLogger.error('Error in getReconnectableConnections:', error as Error);
      return [];
    }
  }
}
