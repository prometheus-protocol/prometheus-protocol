import {
  confirmLogin as apiConfirmLogin,
  completeAuthorize as apiCompleteAuthorize,
  denyConsent as apiDenyConsent,
} from '@prometheus-protocol/ic-js';
import { Identity } from '@dfinity/agent';
import useMutation from './useMutation';

// Define the types for clarity
type ConfirmLoginInput = { identity: Identity; sessionId: string };
type ConfirmLoginData = Awaited<ReturnType<typeof apiConfirmLogin>>;

export const useConfirmLoginMutation = () => {
  // Our hook is now just a simple, declarative call to your wrapper.
  const { mutate, isPending, error } = useMutation<
    ConfirmLoginInput,
    ConfirmLoginData
  >({
    mutationFn: (variables) =>
      apiConfirmLogin(variables.identity, variables.sessionId),

    // We don't need a success message for this flow, as navigation is the feedback.
    enableSnackbar: false,

    // This mutation doesn't affect any cached data, so we don't need to refetch anything.
    queryKeysToRefetch: [],

    // Provide a user-friendly error message.
    errorMessage: 'Login confirmation failed. Please try again.',
  });

  return {
    confirmLogin: mutate, // Rename mutate for clarity in the UI component
    isConfirming: isPending,
    error, // Expose the error for UI feedback
  };
};

/**
 * A mutation to finalize the authorization flow.
 * On success, it redirects the user back to the client app.
 */
export const useCompleteAuthorizeMutation = () => {
  return useMutation<
    { identity: Identity; sessionId: string }, // Input type
    string // Return type (the redirect URL)
  >({
    mutationFn: (variables) =>
      apiCompleteAuthorize(variables.identity, variables.sessionId),
    successMessage: 'Permissions granted! Redirecting...',
    errorMessage: 'Failed to grant permissions. Please try again.',
    queryKeysToRefetch: [],
  });
};

/**
 * A mutation to cancel the authorization flow when the user denies consent.
 * On success, it redirects the user back to the client app with an access_denied error.
 */
export const useDenyConsentMutation = () => {
  const { mutate, isPending, error } = useMutation<
    { identity: Identity; sessionId: string }, // Input type
    string // Return type (the redirect URL)
  >({
    mutationFn: (variables) =>
      apiDenyConsent(variables.identity, variables.sessionId),
    // No success message needed, the redirect is the feedback.
    enableSnackbar: false,
    errorMessage: 'Failed to deny permissions. Please try again.',
    queryKeysToRefetch: [],
  });

  return {
    denyConsent: mutate,
    isDenying: isPending,
    error,
  };
};
