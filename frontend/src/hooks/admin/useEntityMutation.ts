import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@lib/apiClient';
import { showToast } from '@utils/toast';

export type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface UseEntityMutationParams {
  endpoint: string;
  method: MutationMethod;
  invalidateKeys?: string[];
  entityName?: string;
}

export interface UseEntityMutationReturn<TPayload, TResult> {
  mutate: (payload: TPayload, id?: string | number) => Promise<TResult | null>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useEntityMutation<TPayload = unknown, TResult = unknown>(
  params: UseEntityMutationParams
): UseEntityMutationReturn<TPayload, TResult> {
  const queryClient = useQueryClient();
  const { endpoint, method, invalidateKeys = [], entityName = 'Record' } = params;

  const buildUrl = (id?: string | number): string =>
    id !== undefined ? `${endpoint}/${id}` : endpoint;

  const mutationFn = async ({
    payload,
    id,
  }: {
    payload: TPayload;
    id?: string | number;
  }) => {
    const url = buildUrl(id);
    switch (method) {
      case 'POST':   return apiClient.post<TResult>(url, payload);
      case 'PUT':    return apiClient.put<TResult>(url, payload);
      case 'PATCH':  return apiClient.patch<TResult>(url, payload);
      case 'DELETE': return apiClient.delete<TResult>(url);
    }
  };

  const { mutateAsync, isPending, error, reset } = useMutation({ mutationFn });

  const mutate = async (
    payload: TPayload,
    id?: string | number
  ): Promise<TResult | null> => {
    try {
      const response = await mutateAsync({ payload, id });
      if (response?.success) {
        if (method === 'DELETE') {
          showToast.deleted(entityName);
        } else {
          showToast.saved(entityName);
        }
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
        return (response.data as TResult) ?? null;
      } else {
        showToast.apiError(response?.error);
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      showToast.apiError(message);
      return null;
    }
  };

  return {
    mutate,
    isLoading: isPending,
    error: error ? (error as Error).message : null,
    reset,
  };
}

export default useEntityMutation;
