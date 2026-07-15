import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@lib/apiClient';

export interface UseEntityListParams {
  endpoint: string;
  params?: Record<string, any>;
  staleTime?: number;
  enabled?: boolean;
}

export interface UseEntityListPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
}

export interface UseEntityListReturn<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  pagination: UseEntityListPagination;
}

export function useEntityList<T>(params: UseEntityListParams): UseEntityListReturn<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queryParams = { ...params.params, page, limit: pageSize };

  const { data: response, isLoading, error, refetch } = useQuery({
    queryKey: [params.endpoint, queryParams],
    queryFn: () => apiClient.get<any>(params.endpoint, { params: queryParams }),
    staleTime: params.staleTime ?? 30_000,
    placeholderData: keepPreviousData,
    enabled: params.enabled !== false,
  });

  const paginatedData = response?.data as any;
  const items: T[] = paginatedData?.data ?? [];
  const total: number = paginatedData?.pagination?.total ?? 0;
  const totalPages: number = paginatedData?.pagination?.totalPages ?? 1;

  return {
    data: items,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      setPage,
      setPageSize,
    },
  };
}

export default useEntityList;
