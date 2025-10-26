// src/mcp-connection-manager/dtos/pubsub.events.dto.ts

export interface BasePubSubPayload {
  generatedAt: string; // ISO Date string of when this event was generated
  userId: string; // Identifier for the workspace
  channelId: string; // Discord channel ID for scoping MCP connections
  mcpServerConfigId: string; // Unique ID for the MCP Server configuration instance within the workspace
  mcpServerUrl: string; // The base URL of the target MCP Server
}

export interface ConnectionRequestPayload extends BasePubSubPayload {
  initialAccessToken?: string;
  initialRefreshToken?: string;
  // userIdWhoInitiatedAuth?: string; // If refresh tokens are user-specific but connection is workspace
}

export interface TokensObtainedPayload extends BasePubSubPayload {
  accessToken: string;
  refreshToken?: string;
  // userIdWhoInitiatedAuth?: string; // Consistent with ConnectionRequestPayload
}

export interface FetchResourceRequestPayload extends BasePubSubPayload {
  resourcePath: string;
  convoId?: string;
}

export interface InvokeToolRequestPayload extends BasePubSubPayload {
  toolName: string;
  toolInput: any;
  convoId?: string;
  resourcePath?: string;
  invocationId: string;
}

export interface DisconnectRequestPayload extends BasePubSubPayload {}

// PubSubPushMessage remains the same
export interface PubSubPushMessage {
  message: {
    data: string;
    messageId: string;
    attributes?: { [key: string]: string };
  };
  subscription: string;
}

export interface MCPSamplingCompletionResult {
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens' | string;
  role: 'assistant'; // The response is always from the assistant
  content: {
    type: 'text'; // Assuming text-only for now, can be extended
    text: string;
  };
}

/**
 * This payload is published by the Main App after a user has made a decision
 * on a sampling prompt or a sampling completion.
 */
export interface SamplingDecisionSubmittedPayload extends BasePubSubPayload {
  // The context from the original request, needed by the client to resolve the promise.
  sdkContext: {
    sessionId: string;
    requestId: number;
  };

  // The user's decision.
  decision: 'approved' | 'rejected';

  // The final completion to be sent back to the MCP server.
  // REQUIRED if decision is 'approved'.
  approvedCompletion?: MCPSamplingCompletionResult;

  // Optional reason for rejection.
  rejectionReason?: string;
}

export interface MCPElicitationResult {
  action: 'accept' | 'reject' | 'cancel';
  content?: Record<string, unknown>; // The elicitation data submitted by the user
}

export interface ElicitationDataSubmittedPayload extends BasePubSubPayload {
  // The context from the original request, needed by the client to resolve the promise.
  sdkContext: {
    sessionId: string;
    requestId: number;
  };

  elicitationResult: MCPElicitationResult;
}
