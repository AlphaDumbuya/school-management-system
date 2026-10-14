/**
 * profilePhotoService (frontend): the signed-in user's OWN profile photo.
 * Works for every role; the server always uses the account behind the token.
 */
import { apiClient } from '@lib/apiClient';
import { ApiResponse } from '@appTypes/index';

export interface ProfilePhotoResult {
  /** The avatar the app should now show (null = initials). */
  profilePhotoUrl: string | null;
}

export const profilePhotoService = {
  /**
   * Save a photo (a `data:image/...;base64,` JPG/PNG/WebP, up to 2 MB).
   * `inline` keeps it as an inline image instead of a storage link.
   */
  set: async (photo: string, inline = false): Promise<ApiResponse<ProfilePhotoResult>> =>
    apiClient.put('/api/v1/users/me/photo', { photo, inline }),

  remove: async (): Promise<ApiResponse<ProfilePhotoResult>> =>
    apiClient.delete('/api/v1/users/me/photo'),
};

export default profilePhotoService;
