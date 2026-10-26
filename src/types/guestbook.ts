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
  jabatan: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  file_path: string | null;
  check_in_date: string;
  check_out_date: string;
};

export type Winner = {
  id: string;
  checkin_id: string;
  prize: string;
  drawn_at: string;
  drawn_by: string | null;
};

export type CheckInResult = { status: "created" | "duplicate"; created_at: string };
