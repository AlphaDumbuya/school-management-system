/**
 * schoolBannerService (frontend): the school's dashboard banner photo.
 * Principal / super admin only; the server always uses the signed-in user's own school.
 */
import { apiClient } from '@lib/apiClient';
import { ApiResponse } from '@appTypes/index';

export interface SchoolBannerResult {
  /** Short versioned link to the banner (same value as `schoolBannerUrl` on the user), null when removed. */
  bannerUrl: string | null;
}

export const schoolBannerService = {
  /**
   * Save the banner (a `data:image/jpeg|png|webp;base64,` image, up to about 1.2 MB).
   * `inline` keeps it inline in the database instead of in file storage.
   */
  set: async (photo: string, inline = false): Promise<ApiResponse<SchoolBannerResult>> =>
    apiClient.put('/api/v1/school-banner', { photo, inline }),

  remove: async (): Promise<ApiResponse<SchoolBannerResult>> =>
    apiClient.delete('/api/v1/school-banner'),
};

export default schoolBannerService;
