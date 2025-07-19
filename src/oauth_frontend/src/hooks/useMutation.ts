import {
  MutationFunction,
  useMutation as useReactQueryMutation,
  useQueryClient,
  QueryKey,
} from '@tanstack/react-query';
import { toast } from 'sonner';

type Props<InputArgs, Data> = {
  // Mutation function has void return result by default
  mutationFn: MutationFunction<Data, InputArgs>;
  successMessage?: string;
  errorMessage?: string;
  queryKeysToRefetch: QueryKey[]; // Array of query keys to refetch on success
  optimisticUpdate?: (input: InputArgs, currentData: Data) => Data;
  enableSnackbar?: boolean;
  refetchOnSettled?: boolean;
  retry?: boolean;
};

export const useMutation = <InputArgs, Data>({
  mutationFn,
  queryKeysToRefetch,
  successMessage = 'Success',
  errorMessage,
  optimisticUpdate,
  enableSnackbar = true, // only applies for successful requests
  refetchOnSettled = true,
  retry = false,
}: Props<InputArgs, Data>) => {
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, error } = useReactQueryMutation({
    mutationFn,
    onMutate: async (inputArgs) => {
      if (queryKeysToRefetch.length > 0) {
        await Promise.all(
          queryKeysToRefetch.map(async (queryKey) => {
            return await queryClient.cancelQueries({ queryKey }); // Modern API uses object
          }),
        );
      }
      if (optimisticUpdate && queryKeysToRefetch.length > 0) {
        const currentData = queryClient.getQueryData<Data>(
          queryKeysToRefetch[0],
        );
        if (currentData) {
          const updatedData = await optimisticUpdate(inputArgs, currentData);
          queryClient.setQueryData<Data>(queryKeysToRefetch[0], updatedData);
          return { originalData: currentData }; // Return context object
        }
      }
    },
    onSuccess: () => {
      if (enableSnackbar) {
        toast('Success', {
          description: successMessage,
        });
      }
    },
    onError: (err: Error, _, context: any) => {
      // context type can be refined
      const message = errorMessage ?? err.message;
      toast('An error occurred', {
        description: message,
      });
      if (
        context?.originalData &&
        optimisticUpdate &&
        queryKeysToRefetch.length > 0
      ) {
        queryClient.setQueryData<Data>(
          queryKeysToRefetch[0],
          context.originalData,
        );
      }
    },
    onSettled: () => {
      if (queryKeysToRefetch.length > 0 && refetchOnSettled)
        queryKeysToRefetch.map(
          (queryKey) => queryClient.invalidateQueries({ queryKey }), // Modern API uses object
        );
    },
    retry,
  });

  return {
    mutate,
    mutateAsync,
    isPending,
    error,
  };
};

export default useMutation;
