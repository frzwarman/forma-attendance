// Row shapes of the guestbook_ tables, as PostgREST returns them.
export type Settings = {
  id: 1;
  event_name: string;
  welcome_text: string;
  logo_path: string | null;
  background_path: string | null;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  whatsapp_number: string | null;
  updated_at: string;
};

export type CheckIn = {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  email: string;
  // No longer collected on the form; older rows may still hold a value.
  jabatan: string | null;
  // Absent until migration 20261028000000_guestbook_room_number_optional_address.sql is applied.
  room_number?: string | null;
  // No longer collected on the form (no address, no map pin); older rows may still hold values.
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  file_path: string | null;
  check_in_date: string;
  // Legacy visit date; check-out time is checked_out_at.
  check_out_date: string | null;
  checked_out_at: string | null;
};

export type Winner = {
  id: string;
  checkin_id: string;
  prize: string;
  drawn_at: string;
  drawn_by: string | null;
};

// checkout_token comes back only for a new check-in; the phone keeps it to check out later.
export type CheckInResult = { status: "created" | "duplicate"; created_at: string; checkout_token?: string };
