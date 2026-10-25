import type { StorageAdapter } from "./storageAdapter";

const CHUNK_CHARACTERS = 128 * 1024;
const MARKER = "forma.chunked-storage";
let sequence = 0;
type Manifest = {
  format: typeof MARKER;
  version: 1;
  generation: string;
  chunks: number;
  length: number;
  checksum: string;
};
const chunkKey = (key: string, generation: string, index: number) =>
  `${key}:chunks:${generation}:${index}`;
const manifestKey = (key: string) => `${key}:manifest`;
const damaged = () => new Error("Saved workspace data is incomplete or damaged. Your saved data has not been reset.");

function checksum(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
function manifestOf(raw: string | null): Manifest | undefined {
  if (raw === null) return;
  let parsed: Partial<Manifest>;
  try { parsed = JSON.parse(raw); } catch { throw damaged(); }
  if (!parsed || parsed.format !== MARKER) throw damaged();
  if (parsed.version !== 1 || typeof parsed.generation !== "string" ||
      !/^[a-z0-9-]+$/.test(parsed.generation) ||
      !Number.isInteger(parsed.chunks) || parsed.chunks! < 1 || parsed.chunks! > 4096 ||
      !Number.isInteger(parsed.length) || parsed.length! < 0 ||
      typeof parsed.checksum !== "string") throw damaged();
  return parsed as Manifest;
}

// AsyncStorage's Android cursor cannot read a large single row. Each generation
// uses small rows, and a separate small manifest publishes it last. Writing a
// recovery value never needs to read a potentially oversized legacy row.
export function createChunkedStorage(base: StorageAdapter): StorageAdapter {
  const cleanup = async (key: string, manifest: Manifest) => {
    await Promise.allSettled(Array.from({ length: manifest.chunks }, (_, index) =>
      base.removeItem(chunkKey(key, manifest.generation, index)),
    ));
  };
  return {
    async getItem(key) {
      const manifest = manifestOf(await base.getItem(manifestKey(key)));
      if (!manifest) {
        try { return await base.getItem(key); }
        catch (cause) {
          throw new Error("Could not read the saved workspace. Existing data has been preserved; an older Android storage entry may exceed the device's row limit.", { cause });
        }
      }
      const parts = await Promise.all(Array.from({ length: manifest.chunks }, (_, index) =>
        base.getItem(chunkKey(key, manifest.generation, index)),
      ));
      if (parts.some((part) => part === null)) throw damaged();
      const value = parts.join("");
      if (value.length !== manifest.length || checksum(value) !== manifest.checksum) throw damaged();
      return value;
    },
    async setItem(key, value) {
      let previous: Manifest | undefined;
      try { previous = manifestOf(await base.getItem(manifestKey(key))); }
      catch { /* A confirmed reset can replace a damaged manifest after publishing new chunks. */ }
      const generation = `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const parts: string[] = [];
      for (let offset = 0; offset < value.length;) {
        let end = Math.min(offset + CHUNK_CHARACTERS, value.length);
        // Do not send an isolated UTF-16 surrogate to a native string encoder.
        const last = value.charCodeAt(end - 1);
        if (end < value.length && last >= 0xd800 && last <= 0xdbff) end--;
        parts.push(value.slice(offset, end));
        offset = end;
      }
      if (!parts.length) parts.push("");
      const manifest: Manifest = { format: MARKER, version: 1, generation,
        chunks: parts.length, length: value.length, checksum: checksum(value) };
      try {
        for (let index = 0; index < parts.length; index++)
          await base.setItem(chunkKey(key, generation, index), parts[index]);
        await base.setItem(manifestKey(key), JSON.stringify(manifest));
      } catch (error) {
        await cleanup(key, manifest);
        throw error;
      }
      if (previous) await cleanup(key, previous);
      // The new value is already published. Failure to remove a legacy row
      // cannot turn a successful save into a failed save.
      await base.removeItem(key).catch(() => {});
    },
    async removeItem(key) {
      const previous = manifestOf(await base.getItem(manifestKey(key)));
      await base.removeItem(key);
      await base.removeItem(manifestKey(key));
      if (previous) await cleanup(key, previous);
    },
  };
}
