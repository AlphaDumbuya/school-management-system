/**
 * brandStore (WiSkul): who the signed-in user's school IS, for the few screens that write the school's name into a
 * message (the student-records links). The School Editions have their own brandStore, loaded once for their one
 * school; WiSkul serves many schools, so the name is the signed-in user's own school. Same function name and shape,
 * so those screens are identical in every product.
 */
import { useAuthStore } from '../store/authStore';

export interface SyncBrand { name: string }

export function getBrandSync(): SyncBrand {
  const user = useAuthStore.getState().user as { schoolName?: string } | null;
  return { name: user?.schoolName?.trim() || 'our school' };
}
