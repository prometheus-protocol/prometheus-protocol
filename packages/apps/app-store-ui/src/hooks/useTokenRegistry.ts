import { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Principal } from '@dfinity/principal';
import { Token, getCanisterId } from '@prometheus-protocol/ic-js';

// KongSwap API base URL
const KONGSWAP_API_BASE = 'https://api.kongswap.io/api';

// Check if we're on local network
const isLocalNetwork = () => {
  return (
    process.env.DFX_NETWORK === 'local' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

// Mock data for local development
const createMockTokensResponse = (
  page: number,
  searchTerm?: string,
): KongSwapTokensResponse => {
  try {
    const localUsdcId = getCanisterId('USDC_LEDGER');

    const mockTokens = [
      {
        canister_id: localUsdcId,
        symbol: 'USDC',
        name: 'USD Coin (Local)',
        decimals: 8,
        fee: 10000,
        logo_url: '/images/usdc.svg',
      },
    ];

    // Filter by search term if provided
    const filteredTokens = searchTerm
      ? mockTokens.filter(
          (token) =>
            token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
            token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            token.canister_id.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      : mockTokens;

    return {
      items: filteredTokens,
      total_pages: 1,
      total_count: filteredTokens.length,
      page: page,
      limit: 25,
    };
  } catch (error) {
    console.warn(
      'Failed to create mock tokens, falling back to empty response:',
      error,
    );
    return {
      items: [],
      total_pages: 1,
      total_count: 0,
      page: page,
      limit: 25,
    };
  }
};

// KongSwap API response structure
interface KongSwapTokensResponse {
  items: Array<{
    canister_id: string;
    symbol: string;
    name: string;
    decimals: number;
    token_id?: string;
    fee?: number;
    logo_url?: string;
  }>;
  total_pages: number;
  total_count: number;
  page: number;
  limit: number;
}

// Fetch a page of tokens from KongSwap API or return mock data for local dev
const fetchTokensPage = async (
  page: number,
  searchTerm?: string,
  limit: number = 25,
): Promise<KongSwapTokensResponse> => {
  // Return mock data for local development
  if (isLocalNetwork()) {
    // Simulate network delay for more realistic development experience
    await new Promise((resolve) => setTimeout(resolve, 200));
    return createMockTokensResponse(page, searchTerm);
  }

  // Production KongSwap API call
  const url = new URL(`${KONGSWAP_API_BASE}/tokens`);

  // Add pagination parameters
  url.searchParams.set('page', page.toString());
  url.searchParams.set('limit', limit.toString());

  // Add search filter if provided
  if (searchTerm && searchTerm.trim()) {
    url.searchParams.set('search', searchTerm.trim());
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch tokens: ${response.status}`);
  }

  return response.json();
};

// Transform API token to our Token type (from ic-js)
const transformToken = (
  apiToken: KongSwapTokensResponse['items'][0],
): Token & { logo_url?: string } => {
  const tokenInfo = {
    canisterId: Principal.fromText(apiToken.canister_id),
    symbol: apiToken.symbol,
    name: apiToken.name,
    decimals: apiToken.decimals,
    fee: apiToken.fee || 10000, // Default fee if not provided
    logo_url: apiToken.logo_url, // Add logo URL
  };

  // Create token with conversion methods
  return {
    ...tokenInfo,
    toAtomic: (amount: string | number): bigint => {
      const amountStr = String(amount);
      const [integerPart, fractionalPart = ''] = amountStr.split('.');

      if (fractionalPart.length > tokenInfo.decimals) {
        throw new Error(
          `Amount "${amountStr}" has more than ${tokenInfo.decimals} decimal places.`,
        );
      }
      const combined =
        (integerPart || '0') + fractionalPart.padEnd(tokenInfo.decimals, '0');
      return BigInt(combined);
    },
    fromAtomic: (atomicAmount: bigint): string => {
      const atomicStr = atomicAmount
        .toString()
        .padStart(tokenInfo.decimals + 1, '0');
      const integerPart = atomicStr.slice(0, -tokenInfo.decimals);
      const fractionalPart = atomicStr
        .slice(-tokenInfo.decimals)
        .replace(/0+$/, '');

      return fractionalPart.length > 0
        ? `${integerPart}.${fractionalPart}`
        : integerPart;
    },
  };
};

export const useTokenRegistry = () => {
  // Server search term (for API queries)
  const [serverSearchTerm, setServerSearchTerm] = useState('');

  // Client search term (for filtering loaded results)
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  // Use infinite query as the primary data source for better pagination support
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error: queryError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['tokens', serverSearchTerm],
    queryFn: ({ pageParam = 1 }) => {
      return fetchTokensPage(
        pageParam as number,
        serverSearchTerm || undefined,
      );
    },
    getNextPageParam: (lastPage: KongSwapTokensResponse) => {
      return lastPage.page < lastPage.total_pages
        ? lastPage.page + 1
        : undefined;
    },
    initialPageParam: 1,
    staleTime: 10 * 60 * 1000, // 10 minutes - token data doesn't change frequently
    gcTime: 30 * 60 * 1000, // 30 minutes - keep search results in cache longer
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchOnMount: false, // Use cached data if available
    retry: 2, // Retry failed requests
    // Now works in both local and production environments
  });

  // Transform all tokens from all pages and deduplicate by canister_id
  const allTokens = useMemo(() => {
    if (!infiniteData?.pages) return [];

    const allApiTokens = infiniteData.pages.flatMap(
      (page: KongSwapTokensResponse) => page.items,
    );

    // Deduplicate by canister_id
    const uniqueTokenMap = new Map<string, (typeof allApiTokens)[0]>();
    allApiTokens.forEach((token) => {
      uniqueTokenMap.set(token.canister_id, token);
    });

    // Transform to Token objects
    return Array.from(uniqueTokenMap.values()).map(transformToken);
  }, [infiniteData?.pages?.length, infiniteData?.pages]);

  // Get pagination info from the latest page
  const pagination = useMemo(() => {
    const latestPage = infiniteData?.pages?.[infiniteData.pages.length - 1];
    if (!latestPage) return undefined;

    return {
      currentPage: latestPage.page,
      totalPages: latestPage.total_pages,
      totalCount: latestPage.total_count,
      limit: latestPage.limit,
      hasMore: latestPage.page < latestPage.total_pages,
    };
  }, [infiniteData]);

  // For client-side filtering, filter the loaded tokens
  const filteredTokens = useMemo(() => {
    if (!clientSearchTerm.trim()) return allTokens;

    const term = clientSearchTerm.toLowerCase();
    return allTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(term) ||
        token.name.toLowerCase().includes(term) ||
        token.canisterId.toText().toLowerCase().includes(term),
    );
  }, [allTokens, clientSearchTerm]);

  return {
    // Data
    tokens: allTokens, // Return all tokens by default
    allTokens,
    pagination,

    // State
    isLoading,
    isLoadingMore: isFetchingNextPage,
    error: queryError?.message || null,

    // Search
    serverSearchTerm,
    setServerSearchTerm,
    clientSearchTerm,
    setClientSearchTerm,
    filteredTokens,

    // Actions
    fetchMoreTokens: fetchNextPage,
    refetch,

    // Infinite query control
    hasNextPage,
  };
};
