// Everything that needs supabase-js, bundled behind the admin layout so the
// public route never downloads the client. Pages reach it through adminContext.
import { isAdmin, signIn, signOut, useSession } from "./auth";
import { adminCheckOut, checkOutAll, fetchAllCheckIns, fetchWinners, signedFileUrl, startSession } from "./checkinsAdmin";
import { fetchWheel, importWheel, removeFromWheel, returnToWheel, spinWheel } from "./draw";
import { saveEventContent, uploadMaterial, uploadPdfPages, uploadProfileImage } from "./eventAdmin";
import { closePoll, fetchPollResults, resetPoll, savePoll } from "./evoteAdmin";
import { saveFormFields, updateSettings, uploadBrandImage } from "./settingsAdmin";

export const adminApi = {
  isAdmin,
  fetchAllCheckIns,
  fetchWinners,
  signedFileUrl,
  adminCheckOut,
  checkOutAll,
  startSession,
  fetchWheel,
  importWheel,
  spinWheel,
  returnToWheel,
  removeFromWheel,
  updateSettings,
  uploadBrandImage,
  saveEventContent,
  uploadPdfPages,
  uploadProfileImage,
  uploadMaterial,
  saveFormFields,
  fetchPollResults,
  savePoll,
  closePoll,
  resetPoll,
};
export type AdminApi = typeof adminApi;
export { signIn, signOut, useSession };
