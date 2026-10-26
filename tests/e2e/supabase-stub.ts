import type { Page, Request, Route } from "@playwright/test";
import type { CheckIn, Settings, Winner } from "../../src/types/guestbook";

export type StubState = {
  settings: Settings;
  checkins: CheckIn[];
  winners: Winner[];
  rpcCalls: { name: string; body: Record<string, unknown> }[];
  uploads: { bucket: string; path: string; contentType: string; bytes: number }[];
  signedPaths: string[];
  rangeHeaders: string[];
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
  // The event slideshow opens on a first visit; tests opt in to see it.
  intro?: boolean;
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
    uploads: [],
    signedPaths: [],
    rangeHeaders: [],
  };
  if (!seed.intro) await page.addInitScript(() => sessionStorage.setItem("guestbook.intro.seen", "1"));
  const admin = seed.admin || { email: "admin@bawaslu.test", password: "rahasia123" };
  const adminUser = { id: "00000000-0000-4000-8000-00000000adm1", email: admin.email };
  const tokens = new Map<string, string>();

  await page.route("**/rest/v1/guestbook_settings*", async (route, request) => {
    if (request.method() === "PATCH" && seed.settingsWriteDenied) {
      if (wantsObject(request)) return json(route, { code: "PGRST116", message: "Cannot coerce the result to a single JSON object" }, 406);
      return json(route, []);
    }
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
    const key = phoneKey(String(body.p_phone || ""));
    const email = String(body.p_email || "").trim().toLowerCase();
    const existing = state.checkins
      .filter((c) => phoneKey(c.phone) === key || c.email.trim().toLowerCase() === email)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (existing) return json(route, { status: "duplicate", created_at: existing.created_at });
    const row = checkInRow({
      created_at: new Date().toISOString(),
      name: String(body.p_name),
      phone: String(body.p_phone),
      email: String(body.p_email),
      jabatan: (body.p_jabatan as string | null) ?? null,
      address: String(body.p_address),
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
  await page.route(/\/storage\/v1\/object\/(guestbook-uploads|guestbook-brand)\//, async (route, request) => {
    const after = request.url().split("/storage/v1/object/")[1].split("?")[0];
    const [bucket, ...rest] = after.split("/");
    const path = decodeURIComponent(rest.join("/"));
    const { contentType, bytes } = multipartFile(request);
    state.uploads.push({ bucket, path, contentType, bytes });
    return json(route, { Key: `${bucket}/${path}`, Id: uuid() });
  });
  await page.route(/\/storage\/v1\/object\/public\//, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1x1 }));
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1x1 }));
  return state;
}
