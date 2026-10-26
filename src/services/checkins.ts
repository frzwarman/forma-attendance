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
    p_jabatan: input.jabatan,
    p_address: input.address,
    p_latitude: extra.latitude,
    p_longitude: extra.longitude,
    p_file_path: extra.file_path,
    p_check_in_date: input.check_in_date,
    p_check_out_date: input.check_out_date,
    p_honeypot: extra.honeypot || null,
  });
}
