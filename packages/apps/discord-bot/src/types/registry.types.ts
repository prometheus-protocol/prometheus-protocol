/**
 * TypeScript interfaces for the external MCP Registry API
 * API Documentation: https://remote-mcp-servers.com
 */

export interface RegistryServerObject {
  id: string;
  name: string;
  description: string;
  mcp_url: string; // The actual field name from the API
  category: string;
  authentication_type: string; // e.g., "OAuth2", "APIKey", "None"
  dynamic_client_registration: boolean;
  documentation_url?: string;
  maintainer_name?: string;
  maintainer_url?: string;
  icon_url?: string;
  is_official: boolean;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  average_rating?: number | null;

  // Legacy properties for backward compatibility
  url?: string;
  author?: string;
  isOfficial?: boolean;
  tags?: string[];
  authType?: string;
  hostedOn?: string;
  dynamicClientRegistration?: boolean;
}

export interface RegistryPagination {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface RegistryApiResponse {
  data: RegistryServerObject[];
  pagination: RegistryPagination;
}

export interface RegistryServerResponse {
  data: RegistryServerObject;
}

export interface RegistryCategoriesResponse {
  categories: string[];
}

export interface RegistryAuthTypesResponse {
  authTypes: string[];
}

export interface RegistrySearchParams {
  page?: number;
  limit?: number;
  q?: string; // Search query
  categories?: string; // Comma-separated categories
  authTypes?: string; // Comma-separated auth types
  dynamicClientRegistration?: boolean;
  isOfficial?: boolean;
}
