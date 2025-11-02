// src/mcp-connection-manager/dtos/mcp.shared.types.dto.ts
import {
  Tool,
  Resource,
  Notification,
  ServerCapabilities,
  Progress,
  SamplingMessage,
  ElicitRequest,
} from '@modelcontextprotocol/sdk/types.js';

export interface BaseMCPEventPayload {
  generatedAt: string; // ISO Date string of when this event was generated
  userId: string;
  channelId: string;
  mcpServerConfigId: string;
  mcpServerUrl: string;
}

export interface MCPAuthRequiredEvent extends BaseMCPEventPayload {
  oauthAuthorizationUrl: string;
}

export interface MCPToolsFetchedEvent extends BaseMCPEventPayload {
  tools: Tool[]; // Ensure SDKMCPTool matches your SDK's export
}

export interface MCPResourcesFetchedEvent extends BaseMCPEventPayload {
  resources: Resource[]; // Ensure SDKMCPResource matches your SDK's export
}

export interface MCPResourceDataFetchedEvent extends BaseMCPEventPayload {
  uri: string;
  originalRequestUri: string; // The URI that was originally requested to be fetched
  mimeType?: string;
  text?: string;
  blob?: string;
  contentOmitted?: boolean; // If content was too large for Pub/Sub
  sizeBytes?: number; // Estimated size if contentOmitted
}

export interface MCPNotificationEvent extends BaseMCPEventPayload {
  convoId?: string;
  notification: Notification; // Ensure SDKMCPNotification matches
}

export interface MCPToolResultEvent extends BaseMCPEventPayload {
  invocationId: string;
  toolName: string;
  convoId?: string; // Context if the tool was invoked in a chat
  resourcePath?: string; // Context if related to a resource
  status: 'success' | 'error' | 'pending' | 'in_progress'; // Status of the tool execution
  result?: any; // The actual result data from the tool (if status is 'success')
  error?: {
    // Error details (if status is 'error')
    message: string;
    code?: string | number;
    details?: any;
  };
}

export interface MCPToolInvocationProgressEvent extends BaseMCPEventPayload {
  invocationId: string; // Unique ID for the tool invocation
  progress: Progress; // Use the same Progress interface from SDK
  timestamp: string; // ISO Date string of when this event was generated
}

export interface MCPServerCapabilitiesEvent extends BaseMCPEventPayload {
  name: string; // Name of the MCP server (display name with title priority)
  version: string; // Version of the MCP server
  capabilities: ServerCapabilities; // Use the same ServerCapabilities interface
}

export interface MCPConnectionStatusUpdateEvent extends BaseMCPEventPayload {
  status: 'connected' | 'disconnected' | 'reconnecting'; // Current connection status
  lastUpdated: Date; // Timestamp of the last status update
  error?: {
    // Optional error details if status is 'disconnected' or 'reconnecting'
    message: string;
    code?: string | number;
    details?: any;
  };
}

export interface MCPServerPingHealthEvent extends BaseMCPEventPayload {
  status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED' | 'UNKNOWN' | 'PINGING'; // Added 'PINGING'
  lastPingAttemptAt: string; // ISO Date string
  lastSuccessfulPingAt?: string; // ISO Date string, optional
  consecutivePingFailures: number;
  lastPingLatencyMs?: number; // Optional
  timestamp: string; // ISO Date string of when this event was generated
  details?: string; // e.g., "Ping successful", "Ping timeout after 10s", "Consecutive failure limit reached"
}

export interface MCPSamplingRequest {
  messages: SamplingMessage[];
  modelPreferences?: {
    hints?: Array<{ name?: string }>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface MCPSamplingRequestReceivedEvent extends BaseMCPEventPayload {
  // The context from the SDK needed to uniquely identify and resolve the request later.
  sdkContext: {
    sessionId: string;
    requestId: string | number;
  };
  timeoutSeconds?: number; // Optional timeout in seconds for the sampling request
  timestamp: string; // ISO Date string of when this event was generated
  // The full, unmodified sampling request from the MCP server.
  samplingRequest: MCPSamplingRequest;
}

export interface MCPElicitationRequestReceivedEvent
  extends BaseMCPEventPayload {
  // The context from the SDK needed to uniquely identify and resolve the request later.
  sdkContext: {
    sessionId: string;
    requestId: string | number;
  };
  timeoutSeconds?: number; // Optional timeout in seconds for the elicitation request
  timestamp: string; // ISO Date string of when this event was generated
  // The full, unmodified elicitation request from the MCP server.
  elicitationRequest: ElicitRequest;
}
