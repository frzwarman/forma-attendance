import type { Page, Request, Route } from "@playwright/test";
import type { Poll } from "../../src/domain/evote";
import type { CheckIn, Settings, WheelEntry, Winner } from "../../src/types/guestbook";

export type Ballot = { poll_id: string; device_id: string; picks: number[] };
export type StubState = {
  settings: Settings;
  checkins: CheckIn[];
  winners: Winner[];
  rpcCalls: { name: string; body: Record<string, unknown> }[];
  // Kesan & Pesan, by the check-in the code belongs to.
  feedback: { checkin_id: string; message: string }[];
  uploads: { bucket: string; path: string; contentType: string; bytes: number }[];
  signedPaths: string[];
  rangeHeaders: string[];
  // Sessions an admin started (guestbook_sessions), oldest first.
  sessions: { label: "Sesi 1" | "Sesi 2"; started_at: string }[];
  // E-Vote (guestbook_polls, the latest is the vote under way) and every phone's ballot.
  polls: Poll[];
  ballots: Ballot[];
  // Undian's spin wheel (guestbook_wheel_entries): the uploaded list, winners marked by won_at.
  wheel: WheelEntry[];
};
type Seed = {
  settings?: Partial<Settings>;
  checkins?: CheckIn[];
  winners?: Winner[];
  admin?: { email: string; password: string; isAdmin?: boolean };
  // Simulates RLS refusing the settings update (zero rows updated).
  settingsWriteDenied?: boolean;
  failSettings?: boolean;
  newRowAfterFirstPage?: boolean;
  // A database without migration 20261030000000: no event_content column to save Info acara into.
  legacyEventContent?: boolean;
  // The event slideshow opens on a first visit; tests opt in to see it.
  intro?: boolean;
  // A database without migrations 20261028000000 and 20261029000000: no p_room_number or p_divisi
  // yet, and an address is required.
  legacyCheckIn?: boolean;
  sessions?: StubState["sessions"];
  polls?: Poll[];
  ballots?: Ballot[];
  // A database without migration 20261111000000_guestbook_evote.sql: no E-Vote table or functions.
  legacyEvote?: boolean;
  wheel?: WheelEntry[];
  // A database without the wheel migration: no guestbook_wheel_entries table or its functions.
  legacyWheel?: boolean;
  // Check-out codes held by phones from check-ins made before the test: code -> check-in ID.
  tokens?: Record<string, string>;
};

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  event_name: "Buku Tamu",
  welcome_text: "Silakan isi data diri Anda untuk check-in.",
  logo_path: null,
  background_path: null,
  accent_color: "#ec1c24",
  background_color: "#00243f",
  surface_color: "#ffffff",
  text_color: "#1e1e1e",
  whatsapp_number: null,
  updated_at: "2026-10-26T00:00:00Z",
};

// Mirrors public.guestbook_phone_key.
export const phoneKey = (value: string) => {
  const d = value.replace(/\D/g, "");
  return d.startsWith("62") && d.length > 8 ? `0${d.slice(2)}` : d;
};

let counter = 0;
export const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

export function checkInRow(overrides: Partial<CheckIn> = {}): CheckIn {
  const n = ++counter;
  return {
    id: uuid(),
    created_at: new Date(Date.UTC(2026, 9, 26, 3, 0, n % 60)).toISOString(),
    name: `Peserta ${n}`,
    phone: `08${String(1000000000 + n).slice(0, 10)}`,
    email: `peserta${n}@example.test`,
    jabatan: null,
    address: "Jl. MH Thamrin 14",
    latitude: null,
    longitude: null,
    file_path: null,
    check_in_date: "2026-11-02",
    check_out_date: "2026-11-04",
    checked_out_at: null,
    ...overrides,
  };
}

export function pollRow(overrides: Partial<Poll> = {}): Poll {
  const n = ++counter;
  return {
    id: uuid(),
    created_at: new Date(Date.UTC(2026, 10, 4, 1, 0, n % 60)).toISOString(),
    options: ["Round table", "Classroom"],
    max_picks: 1,
    is_open: true,
    title: "",
    subtitle: "",
    ...overrides,
  };
}
export function wheelEntry(overrides: Partial<WheelEntry> = {}): WheelEntry {
  const n = ++counter;
  return { id: uuid(), position: n, name: `Peserta ${n}`, note: "", prize: "", won_at: null, ...overrides };
}
// A phone's E-Vote ID, as the page makes them: 16 random bytes as hex.
export const deviceId = (n: number) => n.toString(16).padStart(32, "0");

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const base64url = (value: string) => Buffer.from(value).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
function session(user: { id: string; email: string }) {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const token = `${base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp, iat: exp - 86400, session_id: "stub-session" }),
  )}.stub`;
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 86400,
    expires_at: exp,
    refresh_token: "stub-refresh",
    user: { id: user.id, email: user.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-26T00:00:00Z" },
  };
}
const json = (route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
const wantsObject = (request: Request) => (request.headers()["accept"] || "").includes("object");
const parseBody = (request: Request): Record<string, unknown> => {
  try { return JSON.parse(request.postData() || "{}"); } catch { return {}; }
};
function multipartFile(request: Request) {
  const raw = request.postDataBuffer() || Buffer.alloc(0);
  const contentType = request.headers()["content-type"] || "";
  const boundary = /boundary=([^;]+)/.exec(contentType)?.[1];
  if (!boundary) return { contentType, bytes: raw.length };
  const marker = Buffer.from(`--${boundary}`);
  let start = 0;
  while (start < raw.length) {
    const partStart = raw.indexOf(marker, start);
    if (partStart < 0) break;
    const headerEnd = raw.indexOf("\r\n\r\n", partStart);
    if (headerEnd < 0) break;
    const headers = raw.slice(partStart, headerEnd).toString("latin1");
    const next = raw.indexOf(marker, headerEnd);
    const bodyEnd = next < 0 ? raw.length : next - 2;
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1];
    if (type) return { contentType: type.trim(), bytes: bodyEnd - (headerEnd + 4) };
    start = next < 0 ? raw.length : next;
  }
  return { contentType, bytes: raw.length };
}

export async function installSupabaseStub(page: Page, seed: Seed = {}): Promise<StubState> {
  const state: StubState = {
    settings: { ...DEFAULT_SETTINGS, ...seed.settings },
    checkins: [...(seed.checkins || [])],
    winners: [...(seed.winners || [])],
    rpcCalls: [],
    feedback: [],
    uploads: [],
    signedPaths: [],
    rangeHeaders: [],
    sessions: [...(seed.sessions || [])],
    polls: [...(seed.polls || [])],
    ballots: [...(seed.ballots || [])],
    wheel: [...(seed.wheel || [])],
  };
  if (!seed.intro) await page.addInitScript(() => sessionStorage.setItem("guestbook.intro.seen", "1"));
  const admin = seed.admin || { email: "admin@bawaslu.test", password: "rahasia123" };
  const adminUser = { id: "00000000-0000-4000-8000-00000000adm1", email: admin.email };
  const tokens = new Map<string, string>(Object.entries(seed.tokens ?? {}));

  await page.route("**/rest/v1/guestbook_settings*", async (route, request) => {
    if (request.method() === "PATCH" && seed.settingsWriteDenied) {
      if (wantsObject(request)) return json(route, { code: "PGRST116", message: "Cannot coerce the result to a single JSON object" }, 406);
      return json(route, []);
    }
    if (request.method() === "PATCH" && seed.legacyEventContent && "event_content" in parseBody(request))
      return json(route, { code: "PGRST204", message: "Could not find the 'event_content' column of 'guestbook_settings' in the schema cache" }, 400);
    if (request.method() === "PATCH") {
      Object.assign(state.settings, parseBody(request), { updated_at: new Date().toISOString() });
    } else if (seed.failSettings) {
      return json(route, { message: "stub failure" }, 500);
    }
    return json(route, wantsObject(request) ? state.settings : [state.settings]);
  });

  await page.route("**/rest/v1/rpc/guestbook_check_in", async (route, request) => {
    const body = parseBody(request);
    state.rpcCalls.push({ name: "guestbook_check_in", body });
    if (body.p_honeypot) return json(route, { message: "spam" }, 400);
    if (seed.legacyCheckIn && ("p_room_number" in body || "p_divisi" in body || "p_answers" in body))
      return json(route, { code: "PGRST202", message: "Could not find the function public.guestbook_check_in in the schema cache" }, 404);
    if (seed.legacyCheckIn && !String(body.p_address ?? "").trim()) return json(route, { code: "P0001", message: "Alamat wajib diisi" }, 400);
    const key = phoneKey(String(body.p_phone || ""));
    const email = String(body.p_email || "").trim().toLowerCase();
    const existing = state.checkins
      .filter((c) => phoneKey(c.phone) === key || c.email.trim().toLowerCase() === email)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    // Mirrors the RPC: a repeat check-in adds no row, it records the visit on the person's row.
    if (existing && seed.legacyCheckIn) return json(route, { status: "duplicate", created_at: existing.created_at });
    if (existing) {
      Object.assign(existing, { last_checked_in_at: new Date().toISOString(), checkin_count: (existing.checkin_count ?? 1) + 1, checked_out_at: null });
      const visit = { status: "returning", created_at: existing.created_at, last_checked_in_at: existing.last_checked_in_at };
      if (existing.name.toLowerCase() !== String(body.p_name).trim().toLowerCase()) return json(route, visit);
      // A new code replacing the earlier one.
      for (const [code, id] of tokens) if (id === existing.id) tokens.delete(code);
      const token = crypto.randomUUID();
      tokens.set(token, existing.id);
      return json(route, { ...visit, checkout_token: token });
    }
    const row = checkInRow({
      created_at: new Date().toISOString(),
      name: String(body.p_name),
      phone: String(body.p_phone),
      email: String(body.p_email),
      jabatan: (body.p_jabatan as string | null) ?? null,
      divisi: (body.p_divisi as string | null) ?? null,
      room_number: (body.p_room_number as string | null) ?? null,
      answers: (body.p_answers as Record<string, string> | null) ?? null,
      address: (body.p_address as string | null) ?? null,
      latitude: (body.p_latitude as number | null) ?? null,
      longitude: (body.p_longitude as number | null) ?? null,
      file_path: (body.p_file_path as string | null) ?? null,
      // Mirrors the RPC: the server stamps today's Jakarta date; check-out stays empty.
      check_in_date: (body.p_check_in_date as string | null) ?? new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10),
      check_out_date: (body.p_check_out_date as string | null) ?? null,
    });
    state.checkins.push(row);
    const token = crypto.randomUUID();
    tokens.set(token, row.id);
    return json(route, { status: "created", created_at: row.created_at, checkout_token: token });
  });

  await page.route("**/rest/v1/rpc/guestbook_is_admin", (route) => json(route, admin.isAdmin ?? true));

  await page.route("**/rest/v1/rpc/guestbook_check_out", async (route, request) => {
    const body = parseBody(request);
    state.rpcCalls.push({ name: "guestbook_check_out", body });
    const row = state.checkins.find((c) => c.id === tokens.get(String(body.p_token)));
    if (!row) return json(route, { message: "Kode check-out tidak dikenal" }, 400);
    const status = row.checked_out_at ? "already" : "checked_out";
    row.checked_out_at ??= new Date().toISOString();
    return json(route, { status, name: row.name, checked_out_at: row.checked_out_at });
  });
  await page.route("**/rest/v1/rpc/guestbook_send_feedback", async (route, request) => {
    const body = parseBody(request);
    state.rpcCalls.push({ name: "guestbook_send_feedback", body });
    const checkin = tokens.get(String(body.p_token));
    if (!checkin) return json(route, { message: "Kode check-in tidak dikenal" }, 400);
    const message = String(body.p_message ?? "").trim();
    if (!message || message.length > 2000) return json(route, { message: "Kesan & pesan wajib diisi (maksimal 2000 karakter)" }, 400);
    state.feedback.push({ checkin_id: checkin, message });
    return json(route, { status: "sent", created_at: new Date().toISOString() });
  });
  await page.route("**/rest/v1/rpc/guestbook_admin_check_out", async (route, request) => {
    const body = parseBody(request);
    const row = state.checkins.find((c) => c.id === body.p_checkin_id);
    if (!row) return json(route, { message: "Peserta tidak ditemukan" }, 400);
    row.checked_out_at = body.p_undo ? null : row.checked_out_at ?? new Date().toISOString();
    return json(route, row.checked_out_at);
  });
  await page.route("**/rest/v1/rpc/guestbook_check_out_all", (route) => {
    const open = state.checkins.filter((c) => !c.checked_out_at);
    for (const row of open) row.checked_out_at = new Date().toISOString();
    return json(route, open.length);
  });

  // The current session: the latest started, as one object (406 before the first).
  await page.route("**/rest/v1/guestbook_sessions*", (route, request) => {
    const latest = [...state.sessions].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
    if (!wantsObject(request)) return json(route, latest ? [latest] : []);
    return latest ? json(route, latest) : json(route, { code: "PGRST116", message: "Cannot coerce the result to a single JSON object" }, 406);
  });
  await page.route("**/rest/v1/rpc/guestbook_start_session", (route, request) => {
    const label = parseBody(request).p_label as "Sesi 1" | "Sesi 2";
    const latest = [...state.sessions].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
    const wibDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3600 * 1000).toISOString().slice(0, 10);
    if (latest?.label === label && wibDay(latest.started_at) === wibDay(new Date().toISOString())) return json(route, latest.started_at);
    const started_at = new Date().toISOString();
    state.sessions.push({ label, started_at });
    return json(route, started_at);
  });
  await page.route("**/rest/v1/rpc/guestbook_draw_winner", async (route, request) => {
    const body = parseBody(request);
    state.rpcCalls.push({ name: "guestbook_draw_winner", body });
    const won = new Set(state.winners.map((w) => w.checkin_id));
    const pool = state.checkins.filter((c) => !won.has(c.id));
    if (!pool.length) return json(route, { status: "empty" });
    const checkin = pool[Math.floor(Math.random() * pool.length)];
    const winner: Winner = { id: uuid(), checkin_id: checkin.id, prize: String(body.p_prize || ""), drawn_at: new Date().toISOString(), drawn_by: adminUser.id };
    state.winners.push(winner);
    return json(route, {
      status: "drawn",
      winner: { id: winner.id, checkin_id: winner.checkin_id, prize: winner.prize, drawn_at: winner.drawn_at },
      checkin: { id: checkin.id, name: checkin.name, jabatan: checkin.jabatan, phone: checkin.phone, email: checkin.email },
    });
  });

  // E-Vote, mirroring supabase/migrations/20261111000000_guestbook_evote.sql.
  const latestPoll = () => [...state.polls].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const noFunction = (route: Route, name: string) =>
    json(route, { code: "PGRST202", message: `Could not find the function public.${name} without parameters in the schema cache` }, 404);
  const refused = (route: Route, message: string) => json(route, { code: "P0001", message }, 400);
  await page.route("**/rest/v1/guestbook_polls*", (route, request) => {
    if (seed.legacyEvote) return json(route, { code: "PGRST205", message: "Could not find the table 'public.guestbook_polls' in the schema cache" }, 404);
    const latest = latestPoll();
    if (!wantsObject(request)) return json(route, latest ? [latest] : []);
    return latest ? json(route, latest) : json(route, { code: "PGRST116", message: "Cannot coerce the result to a single JSON object" }, 406);
  });
  await page.route("**/rest/v1/rpc/guestbook_save_poll", (route, request) => {
    if (seed.legacyEvote) return noFunction(route, "guestbook_save_poll");
    const body = parseBody(request);
    state.rpcCalls.push({ name: "guestbook_save_poll", body });
    const options = ((body.p_options as unknown[] | null) ?? []).map((option) => String(option ?? "").trim());
    const max = body.p_max_picks as number;
    if (options.length < 2 || options.length > 20) return refused(route, "Isi 2 sampai 20 pilihan");
    if (options.some((option) => !option)) return refused(route, "Pilihan tidak boleh kosong");
    if (options.some((option) => option.length > 120)) return refused(route, "Setiap pilihan maksimal 120 karakter");
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return refused(route, "Pilihan tidak boleh sama");
    if (!Number.isInteger(max) || max < 1 || max > options.length) return refused(route, `Jumlah pilihan per orang harus 1 sampai ${options.length}`);
    const title = String(body.p_title ?? "").trim();
    const subtitle = String(body.p_subtitle ?? "").trim();
    const latest = latestPoll();
    if (latest && latest.max_picks === max && latest.options.length === options.length && latest.options.every((option, i) => option === options[i])) {
      Object.assign(latest, { is_open: true, title, subtitle });
      return json(route, latest);
    }
    const created = Math.max(Date.now(), latest ? Date.parse(latest.created_at) + 1 : 0);
    const poll: Poll = { id: uuid(), created_at: new Date(created).toISOString(), options, max_picks: max, is_open: true, title, subtitle };
    state.polls.push(poll);
    return json(route, poll);
  });
  await page.route("**/rest/v1/rpc/guestbook_close_poll", (route, request) => {
    if (seed.legacyEvote) return noFunction(route, "guestbook_close_poll");
    state.rpcCalls.push({ name: "guestbook_close_poll", body: parseBody(request) });
    const latest = latestPoll();
    if (latest) latest.is_open = false;
    return json(route, latest ?? null);
  });
  await page.route("**/rest/v1/rpc/guestbook_reset_poll", (route, request) => {
    if (seed.legacyEvote) return noFunction(route, "guestbook_reset_poll");
    state.rpcCalls.push({ name: "guestbook_reset_poll", body: parseBody(request) });
    const latest = latestPoll();
    if (!latest) return refused(route, "Belum ada voting");
    const poll: Poll = { ...latest, id: uuid(), created_at: new Date(Math.max(Date.now(), Date.parse(latest.created_at) + 1)).toISOString() };
    state.polls.push(poll);
    return json(route, poll);
  });
  await page.route("**/rest/v1/rpc/guestbook_cast_ballot", (route, request) => {
    if (seed.legacyEvote) return noFunction(route, "guestbook_cast_ballot");
    const body = parseBody(request);
    state.rpcCalls.push({ name: "guestbook_cast_ballot", body });
    const device = String(body.p_device_id ?? "");
    if (!/^[0-9a-f]{32}$/.test(device)) return refused(route, "Perangkat tidak dikenal");
    const poll = latestPoll();
    if (!poll || poll.id !== body.p_poll_id) return json(route, { status: "changed" });
    const stored = state.ballots.find((ballot) => ballot.poll_id === poll.id && ballot.device_id === device);
    if (stored) return json(route, { status: "already", picks: stored.picks });
    if (!poll.is_open) return json(route, { status: "closed" });
    const picks = body.p_picks as number[] | null;
    if (
      !Array.isArray(picks) ||
      picks.length < 1 ||
      picks.length > poll.max_picks ||
      picks.some((pick) => !Number.isInteger(pick) || pick < 0 || pick >= poll.options.length) ||
      new Set(picks).size !== picks.length
    )
      return refused(route, "Pilihan tidak valid");
    const sorted = [...picks].sort((a, b) => a - b);
    state.ballots.push({ poll_id: poll.id, device_id: device, picks: sorted });
    return json(route, { status: "recorded", picks: sorted });
  });
  await page.route("**/rest/v1/rpc/guestbook_poll_results", (route) => {
    if (seed.legacyEvote) return noFunction(route, "guestbook_poll_results");
    const poll = latestPoll();
    if (!poll) return json(route, { poll: null, voters: 0, counts: [] });
    const ballots = state.ballots.filter((ballot) => ballot.poll_id === poll.id);
    return json(route, { poll, voters: ballots.length, counts: poll.options.map((_, i) => ballots.filter((ballot) => ballot.picks.includes(i)).length) });
  });

  await page.route("**/rest/v1/guestbook_checkins*", async (route, request) => {
    const url = new URL(request.url());
    const ascending = (url.searchParams.get("order") || "").startsWith("created_at.asc");
    const rows = [...state.checkins].sort((a, b) =>
      (ascending ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)) || a.id.localeCompare(b.id),
    );
    const rangeHeader = request.headers()["range"];
    let from = Number(url.searchParams.get("offset") || 0);
    let to = from + Number(url.searchParams.get("limit") || rows.length) - 1;
    if (rangeHeader) [from, to] = rangeHeader.split("-").map(Number);
    state.rangeHeaders.push(`${from}-${to}`);
    const slice = rows.slice(from, to + 1);
    if (seed.newRowAfterFirstPage && from === 0 && !state.checkins.some((c) => c.name === "Peserta Baru"))
      state.checkins.push(checkInRow({ name: "Peserta Baru", created_at: new Date().toISOString() }));
    return json(route, slice, 200, { "Content-Range": `${from}-${from + slice.length - 1}/*` });
  });

  await page.route("**/rest/v1/guestbook_draw_winners*", async (route, request) => {
    const url = new URL(request.url());
    if (request.method() === "DELETE") {
      const id = (url.searchParams.get("id") || "").replace(/^eq\./, "");
      const removed = state.winners.filter((w) => w.id === id);
      state.winners = state.winners.filter((w) => w.id !== id);
      return json(route, removed);
    }
    return json(route, [...state.winners].sort((a, b) => b.drawn_at.localeCompare(a.drawn_at)));
  });

  // Undian's spin wheel: the uploaded list, a random not-yet-won entry per spin, and an admin's
  // PATCH (won_at, prize) that puts a winner back.
  await page.route("**/rest/v1/guestbook_wheel_entries*", (route, request) => {
    if (seed.legacyWheel) return json(route, { code: "PGRST205", message: "Could not find the table 'public.guestbook_wheel_entries' in the schema cache" }, 404);
    if (request.method() === "DELETE") {
      const id = (new URL(request.url()).searchParams.get("id") || "").replace(/^eq\./, "");
      state.wheel = state.wheel.filter((e) => e.id !== id);
      return json(route, []);
    }
    if (request.method() === "PATCH") {
      const id = (new URL(request.url()).searchParams.get("id") || "").replace(/^eq\./, "");
      const body = parseBody(request);
      const entry = state.wheel.find((e) => e.id === id);
      if (entry && "won_at" in body) entry.won_at = body.won_at as string | null;
      if (entry && "prize" in body) entry.prize = String(body.prize ?? "");
      return json(route, wantsObject(request) && entry ? entry : []);
    }
    return json(route, [...state.wheel].sort((a, b) => a.position - b.position));
  });
  await page.route("**/rest/v1/rpc/guestbook_wheel_import", (route, request) => {
    if (seed.legacyWheel) return noFunction(route, "guestbook_wheel_import");
    const body = parseBody(request);
    state.rpcCalls.push({ name: "guestbook_wheel_import", body });
    const entries = (body.p_entries as { name?: unknown; note?: unknown }[] | null) ?? [];
    state.wheel = entries.map((entry, i) => wheelEntry({ position: i + 1, name: String(entry.name ?? "").trim(), note: String(entry.note ?? "").trim() }));
    return json(route, state.wheel.length);
  });
  await page.route("**/rest/v1/rpc/guestbook_wheel_spin", (route, request) => {
    if (seed.legacyWheel) return noFunction(route, "guestbook_wheel_spin");
    const body = parseBody(request);
    state.rpcCalls.push({ name: "guestbook_wheel_spin", body });
    const pool = state.wheel.filter((entry) => !entry.won_at);
    if (!pool.length) return json(route, { status: "empty" });
    const entry = pool[Math.floor(Math.random() * pool.length)];
    Object.assign(entry, { won_at: new Date().toISOString(), prize: String(body.p_prize ?? "").trim() });
    return json(route, { status: "drawn", entry });
  });

  await page.route("**/auth/v1/token?*", async (route, request) => {
    const url = new URL(request.url());
    const body = parseBody(request);
    if (url.searchParams.get("grant_type") === "refresh_token") return json(route, session(adminUser));
    if (body.email === admin.email && body.password === admin.password) return json(route, session(adminUser));
    return json(route, { error: "invalid_grant", error_description: "Invalid login credentials" }, 400);
  });
  await page.route("**/auth/v1/user*", (route) => json(route, session(adminUser).user));
  await page.route("**/auth/v1/logout*", (route) => route.fulfill({ status: 204, body: "" }));

  // Registered on the context so the tab opened for a signed file is served too.
  await page.context().route(/\/storage\/v1\/object\/sign\//, async (route, request) => {
    if (request.method() !== "POST") return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1x1 });
    const path = request.url().split("/storage/v1/object/sign/")[1].split("?")[0];
    state.signedPaths.push(path.split("/").slice(1).join("/"));
    return json(route, { signedURL: `/object/sign/${path}?token=stub` });
  });
  await page.route(/\/storage\/v1\/object\/(guestbook-uploads|guestbook-brand|guestbook-event)\//, async (route, request) => {
    const after = request.url().split("/storage/v1/object/")[1].split("?")[0];
    const [bucket, ...rest] = after.split("/");
    const path = decodeURIComponent(rest.join("/"));
    const { contentType, bytes } = multipartFile(request);
    state.uploads.push({ bucket, path, contentType, bytes });
    return json(route, { Key: `${bucket}/${path}`, Id: uuid() });
  });
  // Like Storage, ?download=<name> serves the object as an attachment with that file name.
  await page.route(/\/storage\/v1\/object\/public\//, (route, request) => {
    const url = new URL(request.url());
    if (!url.pathname.endsWith(".pdf")) return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1x1 });
    const name = url.searchParams.get("download");
    const headers: Record<string, string> = name ? { "Content-Disposition": `attachment; filename="${name}"` } : {};
    return route.fulfill({ status: 200, contentType: "application/pdf", headers, body: "%PDF-1.4\n% stub\n" });
  });
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1x1 }));
  return state;
}
