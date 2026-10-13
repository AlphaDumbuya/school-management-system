/**
 * The sport-house badges that belong to the signed-in user (a student's own
 * house, a parent's children, a house master / teacher's post), or, for the
 * principal and admissions officer, another person's house posts.
 * Failures are silent: no badge is shown.
 */
import { useQuery } from '@tanstack/react-query';
import { houseService, type SportBadgeItem } from '@services/houseService';

export function useSportBadges(opts: { userId?: string; enabled?: boolean } = {}): SportBadgeItem[] {
  const q = useQuery({
    queryKey: ['sport-badge', opts.userId ?? 'me'],
    queryFn: async () => {
      const r = await houseService.badges(opts.userId);
      if (r.success === false) throw new Error(r.error || 'No badge');
      return r.data || [];
    },
    enabled: opts.enabled !== false,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return q.data || [];
}

export default useSportBadges;
