// Everything that needs supabase-js, bundled behind the admin layout so the
// public route never downloads the client. Pages reach it through adminContext.
import { signIn, signOut, useSession } from "./auth";
import { fetchAllCheckIns, fetchWinners, signedFileUrl } from "./checkinsAdmin";
import { drawWinner, removeWinner } from "./draw";
import { updateSettings, uploadBrandImage } from "./settingsAdmin";

export const adminApi = {
  fetchAllCheckIns,
  fetchWinners,
  signedFileUrl,
  drawWinner,
  removeWinner,
  updateSettings,
  uploadBrandImage,
};
export type AdminApi = typeof adminApi;
export { signIn, signOut, useSession };
