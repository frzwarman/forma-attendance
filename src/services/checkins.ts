import type { CheckInInput } from "../domain/checkin";
import type { CheckInResult } from "../types/guestbook";
import { callFunction } from "./rest";

export type CheckInExtra = {
  file_path: string | null;
  honeypot: string;
};

// The only write path for attendees: the security-definer RPC.
export async function submitCheckIn(input: CheckInInput, extra: CheckInExtra): Promise<CheckInResult> {
  const params = {
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    // The RPC keeps p_jabatan so older clients still work; the form no longer asks for it.
    p_jabatan: null,
    // The RPC keeps the address and map pin parameters for older clients; the form no longer asks.
    p_address: null,
    p_latitude: null,
    p_longitude: null,
    p_file_path: extra.file_path,
    // The server stamps the check-in (created_at, shown in WIB); no visit dates are sent.
    p_check_in_date: null,
    p_check_out_date: null,
    p_honeypot: extra.honeypot || null,
  };
  // Sent only when filled, so a check-in without a room keeps the parameters older databases know.
  const room = input.room_number?.trim();
  try {
    return await callFunction<CheckInResult>("guestbook_check_in", room ? { ...params, p_room_number: room } : params);
  } catch (cause) {
    // Until migration 20261028000000_guestbook_room_number_optional_address.sql is applied the RPC
    // knows no p_room_number (PGRST202) and requires an address: check in the old way, without the
    // room and with "-" as the address, rather than turn the attendee away.
    const { code, message } = cause as Error & { code?: string };
    if (code !== "PGRST202" && message !== "Alamat wajib diisi") throw cause;
    return callFunction<CheckInResult>("guestbook_check_in", { ...params, p_address: "-" });
  }
}
