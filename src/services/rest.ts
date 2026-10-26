// Minimal PostgREST/Storage calls for the public page, so it never loads supabase-js.
import { CONFIG_ERROR, SUPABASE_KEY as key, SUPABASE_URL as url, supabaseConfigured } from "./config";

function headers(extra: Record<string, string> = {}) {
  if (!supabaseConfigured()) throw new Error(CONFIG_ERROR);
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function failure(response: Response): Promise<Error> {
  let message = response.statusText || `HTTP ${response.status}`;
  try {
    const body = await response.json();
    if (body && typeof body.message === "string") message = body.message;
  } catch {
    /* not JSON */
  }
  return new Error(message);
}

export async function getSingleRow<T>(table: string, filter: string): Promise<T | null> {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&${filter}`, {
    headers: headers({ Accept: "application/vnd.pgrst.object+json" }),
  });
  if (response.status === 406) return null;
  if (!response.ok) throw await failure(response);
  return (await response.json()) as T;
}

export async function callFunction<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });
  if (!response.ok) throw await failure(response);
  return (await response.json()) as T;
}

export async function uploadObject(bucket: string, path: string, blob: Blob, contentType: string): Promise<void> {
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": "false" }),
    body: blob,
  });
  if (!response.ok) throw await failure(response);
}

export const publicObjectUrl = (bucket: string, path: string) => `${url}/storage/v1/object/public/${bucket}/${path}`;
