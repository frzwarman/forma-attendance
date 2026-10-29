// Everything that needs supabase-js, bundled behind the admin layout so the
// public route never downloads the client. Pages reach it through adminContext.
import { isAdmin, signIn, signOut, useSession } from "./auth";
import { adminCheckOut, checkOutAll, fetchAllCheckIns, fetchWinners, signedFileUrl } from "./checkinsAdmin";
import { drawWinner, removeWinner } from "./draw";
import { saveEventContent, uploadMaterial, uploadPdfPages, uploadProfileImage } from "./eventAdmin";
import { saveFormFields, updateSettings, uploadBrandImage } from "./settingsAdmin";

export const adminApi = {
  isAdmin,
  fetchAllCheckIns,
  fetchWinners,
  signedFileUrl,
  adminCheckOut,
  checkOutAll,
  drawWinner,
  removeWinner,
  updateSettings,
  uploadBrandImage,
  saveEventContent,
  uploadPdfPages,
  uploadProfileImage,
  uploadMaterial,
  saveFormFields,
};
export type AdminApi = typeof adminApi;
export { signIn, signOut, useSession };
