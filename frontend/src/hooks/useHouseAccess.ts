/**
 * Whether the signed-in teacher has been given access to the Houses page
 * (put on a house, or allowed to draw). Only teachers ask; anyone else gets
 * false without a request.
 */
import { useQuery } from '@tanstack/react-query';
import { houseService } from '@services/houseService';

export function useHouseAccess(role?: string | null): { hasAccess: boolean; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['houses', 'me'],
    queryFn: async () => {
      const r = await houseService.myAccess();
      if (r.success === false) throw new Error(r.error || 'Could not check house access');
      return r.data;
    },
    enabled: role === 'teacher',
    staleTime: 60_000,
    retry: false,
  });
  return { hasAccess: role === 'teacher' && !!q.data?.has_access, isLoading: q.isLoading };
}

export default useHouseAccess;
