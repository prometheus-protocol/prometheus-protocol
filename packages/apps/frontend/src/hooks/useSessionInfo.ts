import { useQuery } from '@tanstack/react-query';
import { getSessionInfo } from '@/api/auth.api';
import { useInternetIdentity } from 'ic-use-internet-identity';

export const useSessionInfoQuery = (sessionId: string | null) => {
  const { identity } = useInternetIdentity();

  return useQuery({
    queryKey: ['sessionInfo', sessionId],
    queryFn: async () => {
      if (!identity || !sessionId) {
        throw new Error('Identity or session ID not available.');
      }
      return getSessionInfo(identity, sessionId);
    },
    // This query should only run if we have an identity and a session ID.
    enabled: !!identity && !!sessionId,
  });
};
