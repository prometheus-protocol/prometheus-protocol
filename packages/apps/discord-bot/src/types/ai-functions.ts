// AI Function Types
export interface AIFunction {
  name: string;
  title?: string; // Optional human-readable display name
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
  };
}

export interface AIFunctionCall {
  name: string;
  arguments: Record<string, any>;
  id?: string; // OpenAI tool call ID for continuing conversations
}

export interface AIFunctionResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface AIFunctionHandler {
  execute(
    args: Record<string, any>,
    context: AIFunctionContext,
  ): Promise<AIFunctionResult>;
}

export interface AIFunctionContext {
  userId: string;
  channelId: string;
  guildId?: string;
  username: string;
}

// Task Management Types
export interface TaskRequest {
  prompt: string; // The AI prompt that will be executed with MCP tools
  interval: string; // e.g., '5 minutes', '1 hour', 'daily'
  description: string;
  userId: string;
  channelId: string;
}

export interface UserTask {
  id: string;
  userId: string;
  channelId: string;
  prompt: string; // AI prompt to execute with MCP tools
  interval: number; // milliseconds
  description: string;
  enabled: boolean;
  createdAt: Date;
  lastRun?: Date;
}
