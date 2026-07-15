import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@lib/apiClient';

export interface UseEntityDetailParams {
  endpoint: string;
  id: string | number | null;
  staleTime?: number;
}

export interface UseEntityDetailReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEntityDetail<T>(params: UseEntityDetailParams): UseEntityDetailReturn<T> {
  const { data: response, isLoading, error, refetch } = useQuery({
    queryKey: [params.endpoint, params.id],
    queryFn: () => apiClient.get<T>(`${params.endpoint}/${params.id}`),
    staleTime: params.staleTime ?? 30_000,
    enabled: params.id !== null,
  });

  return {
    data: (response?.data as T) ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

export default useEntityDetail;
