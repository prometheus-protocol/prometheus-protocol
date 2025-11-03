import { OAuthClientInformation } from '@modelcontextprotocol/sdk/shared/auth.js';

// LLM Service Types
export interface LLMProvider {
  name: string;
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
  threadId?: string; // Optional: thread ID for posting alerts when in a thread
}

// Tool call structure for assistant messages
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// Enhanced conversation message supporting all message types including tool calls
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  timestamp: Date;
  // For assistant messages with tool calls
  tool_calls?: ToolCall[];
  // For tool result messages
  tool_call_id?: string;
  tool_name?: string;
}

export interface ChatThread {
  id: string;
  thread_id: string;
  channel_id: string;
  user_id: string;
  conversation_history: Array<{
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    tool_name?: string;
  }>;
  is_active: boolean;
  created_at: Date;
  last_activity: Date;
}

// Alert Service Types
export interface AlertConfig {
  id: string;
  name: string;
  description: string;
  userId: string; // Discord user ID who created the task
  channelId: string; // Channel where MCP tools are connected
  targetChannelId?: string; // Optional: specific channel/thread to post alerts to
  threadId?: string; // Optional: thread ID if task was created in a thread (for loading thread history)
  interval: number; // milliseconds - time between executions (for recurring) or delay until first execution
  enabled: boolean;
  recurring?: boolean; // If false, alert will be disabled after first execution
  prompt: string; // AI prompt to execute with MCP tools
  lastRun?: Date;
  nextRun?: Date; // When the task should execute next
  lastData?: any;
  errorState?: {
    hasError: boolean;
    errorType?: 'permission' | 'auth' | 'other';
    errorMessage?: string;
    errorCount?: number;
    lastErrorDate?: Date;
    disabledDueToError?: boolean;
  };
}

export interface AlertResult {
  hasNewData: boolean;
  data?: any;
  message?: string;
  error?: string;
}

// Database Service Types
export interface DatabaseService {
  // Conversation history - new methods
  saveMessages(
    userId: string,
    channelId: string,
    messages: ConversationMessage[],
  ): Promise<void>;

  // Legacy method - deprecated but kept for backward compatibility
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
  clearConversationHistory(userId: string, channelId: string): Promise<number>;

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
  updateTaskLastRun(taskId: string, lastRun: Date): Promise<void>;
  deleteUserTask(taskId: string): Promise<void>;

  // OAuth persistence
  saveOAuthPending(pending: {
    server_id: string;
    user_id: string;
    state: string;
    code_verifier: string;
    auth_url: string;
    channel_id?: string;
  }): Promise<void>;
  getOAuthPendingByState(state: string): Promise<null | {
    server_id: string;
    user_id: string;
    state: string;
    code_verifier: string;
    auth_url: string;
    channel_id?: string;
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
    channel_id?: string;
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
    requestingUserId?: string,
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
    channelId: string,
    serverId: string,
  ): Promise<SavedMCPConnection | null>;
  getUserMCPConnections(
    userId: string,
    channelId: string,
  ): Promise<SavedMCPConnection[]>;
  updateUserMCPConnection(
    userId: string,
    channelId: string,
    serverId: string,
    updates: Partial<SavedMCPConnection>,
  ): Promise<void>;
  deleteUserMCPConnection(
    userId: string,
    channelId: string,
    serverId: string,
  ): Promise<void>;

  // Chat thread management
  createChatThread(data: {
    thread_id: string;
    channel_id: string;
    user_id: string;
  }): Promise<void>;
  getChatThread(threadId: string): Promise<ChatThread | null>;
  updateThreadHistory(
    threadId: string,
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
      tool_call_id?: string;
      tool_name?: string;
    },
  ): Promise<void>;
  deactivateChatThread(threadId: string): Promise<void>;
}

export interface UserTaskData {
  id: string;
  userId: string;
  channelId: string; // Channel where MCP tools are connected
  targetChannelId?: string; // Optional: specific channel/thread to post alerts to
  prompt: string;
  interval: number;
  description: string;
  enabled: boolean;
  recurring?: boolean; // If false, task will be disabled after first execution
  createdAt: Date;
  lastRun?: Date;
}

export interface SavedMCPConnection {
  user_id: string;
  channel_id: string;
  server_id: string;
  server_name: string;
  server_url: string;
  status:
    | 'connected'
    | 'disconnected'
    | 'error'
    | 'auth-required'
    | 'DISCONNECTED_BY_USER';
  tools: string; // JSON string of MCPTool[]
  error_message?: string | null;
  connected_at?: Date | null;
  last_used?: Date | null;
}
