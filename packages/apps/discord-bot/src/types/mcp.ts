// MCP Server Types
export interface MCPServer {
  id: string;
  name: string;
  description: string;
  url: string;
  author?: string;
  version?: string;
  tags?: string[];
  auth_type: 'none' | 'api_key' | 'oauth';
  auth_config?: MCPAuthConfig;
  hosted_on?: 'icp' | 'external';
  canister_id?: string; // For ICP-hosted servers
}

export interface MCPAuthConfig {
  api_key_header?: string;
  oauth_provider?: string;
  oauth_scopes?: string[];
  required_env_vars?: string[];
}

export interface IMCPTool {
  name: string;
  description: string;
  inputSchema: any;
  server_id: string;
  server_name: string;
}

export interface IMCPConnection {
  server_id: string;
  server_name: string;
  url: string;
  status: 'connected' | 'disconnected' | 'error' | 'auth-required';
  tools: IMCPTool[];
  last_connected?: Date;
  error_message?: string;
}

export interface IMCPToolInvocation {
  server_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  user_id: string;
  channel_id: string;
}

export interface IMCPToolResult {
  success: boolean;
  result?: any;
  error?: string;
  tool_name: string;
  server_name: string;
}

// MCP Service Interfaces
export interface IMCPRegistry {
  discoverServers(
    query?: string,
    limit?: number,
    page?: number,
  ): Promise<MCPServer[]>;
  searchServers(
    options: ServerSearchOptions,
  ): Promise<{ servers: MCPServer[]; pagination: any }>;
  getServer(id: string): Promise<MCPServer | null>;
  getCategories(): Promise<string[]>;
  getAuthTypes(): Promise<string[]>;
}

export interface IMCPConnectionManager {
  connect(
    server: MCPServer,
    userId: string,
    authConfig?: any,
  ): Promise<IMCPConnection>;
  disconnect(serverId: string, userId: string): Promise<void>;
  getConnection(
    serverId: string,
    userId: string,
  ): Promise<IMCPConnection | null>;
  getConnectionStatusOnly(
    userId: string,
    serverId: string,
  ): Promise<IMCPConnection | null>;
  getAllConnectionStatuses(userId: string): Promise<IMCPConnection[]>;
  getUserConnections(userId: string): Promise<IMCPConnection[]>;
  isConnected(serverId: string, userId: string): Promise<boolean>;
  getClient(serverId: string, userId: string): Promise<any | null>; // Returns MCP Client instance
}

export interface MCPToolRegistry {
  discoverTools(connection: IMCPConnection): Promise<IMCPTool[]>;
  invokeTool(
    connection: IMCPConnection,
    toolInvocation: IMCPToolInvocation,
  ): Promise<IMCPToolResult>;
  getToolSchema(
    serverId: string,
    toolName: string,
    userId: string,
  ): Promise<any>;
}

// Registry API Types
export interface RegistryServer {
  id: string;
  name: string;
  description: string;
  url: string;
  author: string;
  version: string;
  tags: string[];
  categories: string[];
  authTypes: string[];
  isOfficial: boolean;
  dynamicClientRegistration?: boolean;
  created_at: string;
  updated_at: string;
  download_count?: number;
  rating?: number;
}

// Single server response structure (different from list response)
export interface RegistryServerDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  mcp_url: string;
  authentication_type: string;
  dynamic_client_registration: boolean;
  documentation_url: string | null;
  maintainer_name: string;
  maintainer_url: string;
  icon_url: string;
  is_official: boolean;
  user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  average_rating: number | null;
  ai_summary: string | null;
  official_id: string | null;
}

export interface RegistryServerResponse {
  data: RegistryServerDetail;
  reviews: any[];
  meta: {
    totalReviews: number;
    averageRating: number | null;
  };
}

export interface RegistryResponse {
  data: RegistryServer[];
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ServerSearchOptions {
  query?: string;
  limit?: number;
  page?: number;
  categories?: string[];
  authTypes?: string[];
  isOfficial?: boolean;
  dynamicClientRegistration?: boolean;
}
