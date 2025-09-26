import { AIFunction, AIFunctionCall } from './ai-functions.js';
import { MCPServer } from './mcp.js';
import { OAuthClientInformation } from '@modelcontextprotocol/sdk/shared/auth.js';

// LLM Service Types
export interface LLMProvider {
  name: string;
  generateResponse(
    prompt: string,
    context?: ConversationContext,
    functions?: AIFunction[],
    mcpServers?: MCPServer[],
  ): Promise<string | AIFunctionCall[]>;
  supports: {
    streaming?: boolean;
    functions?: boolean;
    vision?: boolean;
  };
}

export interface ConversationContext {
  userId: string;
  channelId: string;
  history: ConversationMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Alert Service Types
export interface AlertConfig {
  id: string;
  name: string;
  description: string;
  channelId: string;
  interval: number; // milliseconds
  enabled: boolean;
  prompt: string; // AI prompt to execute with MCP tools
  lastRun?: Date;
  lastData?: any;
}

export interface AlertResult {
  hasNewData: boolean;
  data?: any;
  message?: string;
  error?: string;
}

// Database Service Types
export interface DatabaseService {
  // Conversation history
  saveConversation(context: ConversationContext): Promise<void>;
  saveConversationTurn(
    userId: string,
    channelId: string,
    userMessage: string,
    assistantMessage: string,
    functionCalls?: any[],
    functionResults?: any[],
  ): Promise<void>;
  getConversationHistory(
    userId: string,
    channelId: string,
    limit?: number,
  ): Promise<ConversationMessage[]>;

  // Alert management
  saveAlertState(alertId: string, data: any, timestamp: Date): Promise<void>;
  getLastAlertState(
    alertId: string,
  ): Promise<{ data: any; timestamp: Date } | null>;

  // Alert configuration persistence
  saveAlert(alert: AlertConfig): Promise<void>;
  loadAlerts(): Promise<AlertConfig[]>;
  updateAlert(alert: AlertConfig): Promise<void>;
  deleteAlert(alertId: string): Promise<void>;

  // User preferences
  saveUserPreferences(
    userId: string,
    preferences: Record<string, any>,
  ): Promise<void>;
  getUserPreferences(userId: string): Promise<Record<string, any>>;

  // User task management
  saveUserTask(task: UserTaskData): Promise<void>;
  getUserTasks(userId: string): Promise<UserTaskData[]>;
  getUserTask(userId: string, taskId: string): Promise<UserTaskData | null>;
  updateTaskEnabled(taskId: string, enabled: boolean): Promise<void>;
  updateTaskInterval(taskId: string, interval: number): Promise<void>;
  deleteUserTask(taskId: string): Promise<void>;

  // OAuth persistence
  saveOAuthPending(pending: {
    server_id: string;
    user_id: string;
    state: string;
    code_verifier: string;
    auth_url: string;
  }): Promise<void>;
  getOAuthPendingByState(state: string): Promise<null | {
    server_id: string;
    user_id: string;
    state: string;
    code_verifier: string;
    auth_url: string;
  }>;
  getOAuthPending(
    serverId: string,
    userId: string,
  ): Promise<null | {
    server_id: string;
    user_id: string;
    state: string;
    code_verifier: string;
    auth_url: string;
  }>;
  deleteOAuthPending(serverId: string, userId: string): Promise<void>;
  saveOAuthTokens(tokens: {
    server_id: string;
    user_id: string;
    access_token: string;
    refresh_token?: string | null;
    expires_at?: Date | null;
    scope?: string | null;
    token_type?: string | null;
    raw_tokens: any;
  }): Promise<void>;
  getOAuthTokens(
    serverId: string,
    userId: string,
  ): Promise<null | {
    server_id: string;
    user_id: string;
    access_token: string;
    refresh_token?: string | null;
    expires_at?: Date | null;
    scope?: string | null;
    token_type?: string | null;
    raw_tokens: any;
  }>;
  deleteOAuthTokens(serverId: string, userId: string): Promise<void>;

  // OAuth client information persistence
  saveOAuthClientInfo(
    serverId: string,
    clientInfo: OAuthClientInformation,
  ): Promise<void>;
  getOAuthClientInfo(serverId: string): Promise<OAuthClientInformation | null>;
  deleteOAuthClientInfo(serverId: string): Promise<void>;

  // OAuth server metadata persistence
  saveOAuthServerMetadata(serverId: string, metadata: any): Promise<void>;
  getOAuthServerMetadata(serverId: string): Promise<any | null>;
  deleteOAuthServerMetadata(serverId: string): Promise<void>;

  // MCP connection persistence
  saveUserMCPConnection(connection: SavedMCPConnection): Promise<void>;
  getUserMCPConnection(
    userId: string,
    serverId: string,
  ): Promise<SavedMCPConnection | null>;
  getUserMCPConnections(userId: string): Promise<SavedMCPConnection[]>;
  updateUserMCPConnection(
    userId: string,
    serverId: string,
    updates: Partial<SavedMCPConnection>,
  ): Promise<void>;
  deleteUserMCPConnection(userId: string, serverId: string): Promise<void>;
}

export interface UserTaskData {
  id: string;
  userId: string;
  channelId: string;
  prompt: string;
  interval: number;
  description: string;
  enabled: boolean;
  createdAt: Date;
  lastRun?: Date;
}

export interface SavedMCPConnection {
  user_id: string;
  server_id: string;
  server_name: string;
  server_url: string;
  status: 'connected' | 'disconnected' | 'error' | 'auth-required' | 'DISCONNECTED_BY_USER';
  tools: string; // JSON string of MCPTool[]
  error_message?: string | null;
  connected_at?: Date | null;
  last_used?: Date | null;
}
