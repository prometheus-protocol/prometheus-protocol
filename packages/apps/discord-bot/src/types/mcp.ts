// Core MCP Server Types (simplified, aligned with MinimalMCPServer from registry service)
export interface MCPServer {
  id: string; // UUID from registry
  name: string; // Full reverse-DNS name
  description: string;
  url: string; // Primary connection URL
}

// Function Call Result Types
export interface FunctionCallResult {
  success: boolean;
  result?: any;
  error?: string;
  // OAuth-specific fields
  auth_url?: string;
  message?: string;
}

// Search Options (used by registry service and MCP service)
export interface ServerSearchOptions {
  query?: string;
  limit?: number;
  page?: number;
  categories?: string[];
  category?: string; // For single category searches
  authTypes?: string[];
  isOfficial?: boolean;
  dynamicClientRegistration?: boolean;
}

// Connection Result Types (used internally by MCP service)
export interface ConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
  requiresAuth?: boolean;
  authUrl?: string;
  // Extended properties for Discord bot compatibility
  connectionId?: string;
  authRequired?: boolean;
  status?: 'connected' | 'auth-required' | 'error';
  server_name?: string;
  tools?: any[];
  error_message?: string;
  connection?: {
    server_name: string;
    tools: any[];
  };
}
