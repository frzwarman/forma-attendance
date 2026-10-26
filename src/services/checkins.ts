import type { CheckInInput } from "../domain/checkin";
import type { CheckInResult } from "../types/guestbook";
import { callFunction } from "./rest";

export type CheckInExtra = {
  file_path: string | null;
  honeypot: string;
  latitude: number | null;
  longitude: number | null;
};

// The only write path for attendees: the security-definer RPC.
export function submitCheckIn(input: CheckInInput, extra: CheckInExtra): Promise<CheckInResult> {
  return callFunction<CheckInResult>("guestbook_check_in", {
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    // The RPC keeps p_jabatan so older clients still work; the form no longer asks for it.
    p_jabatan: null,
    p_address: input.address,
    p_latitude: extra.latitude,
    p_longitude: extra.longitude,
    p_file_path: extra.file_path,
    // The server stamps the check-in (created_at, shown in WIB); no visit dates are sent.
    p_check_in_date: null,
    p_check_out_date: null,
    p_honeypot: extra.honeypot || null,
  });
}
