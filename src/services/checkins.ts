import { splitAnswers, type CheckInInput } from "../domain/checkin";
import type { FormField } from "../domain/formFields";
import type { CheckInResult } from "../types/guestbook";
import { callFunction } from "./rest";

export type CheckInExtra = {
  file_path: string | null;
  honeypot: string;
};

// The only write path for attendees: the security-definer RPC.
export async function submitCheckIn(input: CheckInInput, fields: FormField[], extra: CheckInExtra): Promise<CheckInResult> {
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
  // Each sent only when filled, so a check-in without them keeps the parameters older databases know.
  const { divisi, room_number, answers } = splitAnswers(fields, input.answers);
  try {
    return await callFunction<CheckInResult>("guestbook_check_in", {
      ...params,
      ...(divisi ? { p_divisi: divisi } : {}),
      ...(room_number ? { p_room_number: room_number } : {}),
      ...(Object.keys(answers).length ? { p_answers: answers } : {}),
    });
  } catch (cause) {
    // Until migrations 20261028000000_guestbook_room_number_optional_address.sql,
    // 20261029000000_guestbook_divisi.sql and 20261031000000_guestbook_form_fields.sql are applied
    // the RPC knows no p_room_number, p_divisi or p_answers (PGRST202) and may require an address:
    // check in the old way, without them and with "-" as the address, rather than turn the attendee away.
    const { code, message } = cause as Error & { code?: string };
    if (code !== "PGRST202" && message !== "Alamat wajib diisi") throw cause;
    return callFunction<CheckInResult>("guestbook_check_in", { ...params, p_address: "-" });
  }
}
