import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createChunkedStorage } from "../services/chunkedStorage";
import { createMockRepository, DATABASE_KEY } from "../services/mockRepository";
import { seedDatabase } from "../services/seed";
import { dateKey, nextWorkingDate } from "./attendance";
import type { StorageAdapter } from "../services/storageAdapter";

function backing() {
  const values = new Map<string, string>();
  const base: StorageAdapter = {
    getItem: async (key) => {
      const value = values.get(key) ?? null;
      if (value !== null && Buffer.byteLength(value) >= 2 * 1024 * 1024)
        throw new Error("Row too big to fit into CursorWindow");
      return value;
    },
    setItem: async (key, value) => {
      assert.ok(Buffer.byteLength(value) < 2 * 1024 * 1024, "Each native row stays below the Android cursor limit");
      assert.equal(Buffer.from(value).toString("utf8"), value, "Chunks preserve surrogate pairs");
      values.set(key, value);
    },
    removeItem: async (key) => { values.delete(key); },
  };
  return { values, base };
}

describe("Chunked native storage", () => {
  it("round-trips the full demo database and Unicode without oversized rows", async () => {
    const { base, values } = backing();
    const storage = createChunkedStorage(base);
    const value = "x".repeat(128 * 1024 - 1) + "😀" + JSON.stringify(seedDatabase());
    assert.ok(Buffer.byteLength(value) > 2 * 1024 * 1024);
    await storage.setItem("workspace", value);
    assert.equal(await createChunkedStorage(base).getItem("workspace"), value);
    assert.ok(values.size > 2);
  });

  it("preserves the previous generation when a chunk or manifest write fails", async () => {
    for (const failure of ["chunk", "manifest"]) {
      const { base, values } = backing();
      await createChunkedStorage(base).setItem("workspace", "previous saved value");
      const before = new Map(values);
      let writes = 0;
      const failing = createChunkedStorage({ ...base, setItem: async (key, value) => {
        if ((failure === "chunk" && ++writes === 2) || (failure === "manifest" && key.endsWith(":manifest")))
          throw new Error("Disk full");
        await base.setItem(key, value);
      } });
      await assert.rejects(failing.setItem("workspace", "x".repeat(300000)), /Disk full/);
      assert.equal(await createChunkedStorage(base).getItem("workspace"), "previous saved value");
      assert.deepEqual(values, before, "Failed generation chunks are removed");
    }
  });

  it("migrates legacy strings on write and removes committed generations", async () => {
    const { base, values } = backing();
    values.set("workspace", "legacy saved value");
    values.set("unrelated", "keep me");
    const storage = createChunkedStorage(base);
    assert.equal(await storage.getItem("workspace"), "legacy saved value");
    await storage.setItem("workspace", "migrated saved value");
    assert.equal(values.has("workspace"), false);
    assert.equal(await storage.getItem("workspace"), "migrated saved value");
    await storage.removeItem("workspace");
    assert.equal(await storage.getItem("workspace"), null);
    assert.deepEqual([...values], [["unrelated", "keep me"]]);
    values.set("legacy-only", "old");
    await storage.removeItem("legacy-only");
    assert.equal(values.has("legacy-only"), false);
  });

  it("publishes successfully even when obsolete-generation cleanup fails", async () => {
    const { base } = backing();
    await createChunkedStorage(base).setItem("workspace", "old");
    const storage = createChunkedStorage({ ...base, removeItem: async () => { throw new Error("Cleanup unavailable"); } });
    await storage.setItem("workspace", "new");
    assert.equal(await storage.getItem("workspace"), "new");
  });

  it("reports missing or modified chunks without deleting saved data", async () => {
    for (const corrupt of ["missing", "modified", "manifest"]) {
      const { base, values } = backing();
      const storage = createChunkedStorage(base);
      await storage.setItem("workspace", "saved value");
      const key = [...values.keys()].find((k) => k.includes(":chunks:"))!;
      if (corrupt === "missing") values.delete(key);
      if (corrupt === "modified") values.set(key, "saved VALUE");
      if (corrupt === "manifest") values.set("workspace:manifest", "broken");
      const before = new Map(values);
      await assert.rejects(storage.getItem("workspace"), /incomplete or damaged/);
      assert.deepEqual(values, before);
    }
  });

  it("allows an explicit reset to replace an unreadable oversized legacy row", async () => {
    const { base, values } = backing();
    values.set(DATABASE_KEY, JSON.stringify(seedDatabase()));
    const repo = createMockRepository(createChunkedStorage(base));
    await assert.rejects(repo.read(), /older Android storage entry/);
    assert.ok(values.has(DATABASE_KEY), "Reading never deletes legacy data");
    await repo.reset();
    assert.equal((await createMockRepository(createChunkedStorage(base)).read()).employees.length, 36);
    assert.equal(values.has(DATABASE_KEY), false);
  });

  it("persists a leave request and reloads it using Android-sized storage rows", async () => {
    const { base } = backing();
    const repo = createMockRepository(createChunkedStorage(base));
    const start = nextWorkingDate(dateKey());
    await repo.submitRequest({ id: "native-request", employeeId: "emp-4", kind: "leave", type: "Sick leave",
      start, end: start, days: 1, reason: "Recovering at home today", status: "Pending", createdAt: new Date().toISOString() });
    const reloaded = await createMockRepository(createChunkedStorage(base)).read();
    assert.equal(reloaded.requests.find((r) => r.id === "native-request")?.status, "Pending");
  });
});
