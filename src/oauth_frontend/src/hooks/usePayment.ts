import { approveAllowance, completePaymentSetup } from '@/api/payment.api';
import { useMutation } from './useMutation';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

type SetupPaymentInput = {
  identity: Identity;
  sessionId: string;
  amount: number;
  spenderPrincipal: Principal;
};

export const useSetupPaymentMutation = () => {
  return useMutation<SetupPaymentInput, void>({
    mutationFn: async ({ identity, sessionId, amount, spenderPrincipal }) => {
      // Pass the spender principal to the approve function
      await approveAllowance(identity, amount, spenderPrincipal);
      await completePaymentSetup(identity, sessionId);
    },
    successMessage: 'Budget approved successfully!',
    errorMessage: 'Failed to approve budget. Please try again.',
    queryKeysToRefetch: [],
  });
};
