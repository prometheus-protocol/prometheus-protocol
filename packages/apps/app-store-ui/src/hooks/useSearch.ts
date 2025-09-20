// This is the clean, recommended pattern
import { search } from '@prometheus-protocol/ic-js';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';

/**
 * A React Query hook to perform a debounced search for apps.
 * @param queryString The raw search query from the input.
 * @returns The result of the React Query operation.
 */
export const useSearchQuery = (queryString: string) => {
  // Debounce the query to prevent firing a request on every keystroke.
  const debouncedQuery = useDebounce(queryString, 300); // 300ms delay

  return useQuery({
    queryKey: ['app-search', debouncedQuery],
    // The query function is a single call to our powerful API function.
    queryFn: () => search(debouncedQuery),
    // Only run the query if the user has actually typed something.
    enabled: !!debouncedQuery.trim(),
    staleTime: 0, // Always fetch fresh results
  });
};
