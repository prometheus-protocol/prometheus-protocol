// This matches the raw structure from KongSwap's /api/tokens endpoint
export interface KongSwapTokenReply {
  token_id: number;
  symbol: string;
  name: string;
  canister_id: string;
  decimals: number;
  fee?: number;
  logo_url?: string;
  // ... other fields from the API
}

// Search and filter parameters for token API
export interface TokenSearchParams {
  search?: string;
  canisterId?: string;
}

// Complete token registry response with pagination info
export interface TokenRegistryResponse {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasMore: boolean;
  };
}