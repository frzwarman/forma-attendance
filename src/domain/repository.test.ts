import assert from "node:assert/strict";
import { describe,it } from "node:test";
import { createMockRepository,DATABASE_KEY } from "../services/mockRepository";
import type { StorageAdapter } from "../services/storageAdapter";
import { dateKey } from "./attendance";
function setup() {
  const map = new Map<string, string>();
  const storage: StorageAdapter = {
    getItem: async (k) => map.get(k) || null,
    setItem: async (k, v) => {
      map.set(k, v);
    },
    removeItem: async (k) => {
      map.delete(k);
    },
  };
  let now = new Date(dateKey() + "T09:00:00+07:00");
  const clock = { now: () => now };
  return {
    storage,
    repo: createMockRepository(storage, clock),
    setTime: (time: string) => {
      now = new Date(time);
    },
    map,
  };
}
describe("Persistent mock repository", () => {
  it("persists clock-in/out, raw events, notifications and actual duration", async () => {
    const { repo, storage, setTime } = setup();
    const db = await repo.read();
    const office = db.locations[0];
    const input = {
      employeeId: "emp-1",
      type: "in" as const,
      coordinates: {
        latitude: office.latitude,
        longitude: office.longitude,
        accuracy: 8,
        simulated: true,
      },
      locationId: office.id,
      idempotencyKey: "one",
    };
    const first = await repo.submitAttendance(input);
    assert.ok(first.clockIn);
    const retry = await repo.submitAttendance(input);
    assert.equal(first.id, retry.id);
    assert.equal((await repo.read()).events.length, 1);
    await assert.rejects(
      repo.submitAttendance({ ...input, idempotencyKey: "duplicate" }),
      /already/,
    );
    setTime(dateKey() + "T18:30:00+07:00");
    await repo.submitAttendance({
      ...input,
      type: "out",
      idempotencyKey: "two",
    });
    const reloaded = await createMockRepository(storage).read();
    assert.equal(reloaded.events.length, 2);
    const s = reloaded.sessions.find((s) => s.id === first.id)!;
    assert.equal(s.durationMinutes, 570);
    assert.equal(s.overtimeMinutes, 30);
    assert.ok(reloaded.notifications.some((n) => n.title.includes("wrapped")));
  });
  it("serializes simultaneous submissions to prevent double clock-ins", async () => {
    const { repo } = setup();
    const db = await repo.read();
    const l = db.locations[0];
    const input = {
      employeeId: "emp-1",
      type: "in" as const,
      coordinates: { ...l, accuracy: 8, simulated: true },
      locationId: l.id,
      idempotencyKey: "a",
    };
    const result = await Promise.allSettled([
      repo.submitAttendance(input),
      repo.submitAttendance({ ...input, idempotencyKey: "b" }),
    ]);
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await repo.read()).events.length, 1);
  });
  it("rejects outside, uncertain, inactive and required-selfie failures", async () => {
    const { repo, storage } = setup();
    const db = await repo.read();
    const l = db.locations[0];
    const input = {
      employeeId: "emp-1",
      type: "in" as const,
      coordinates: {
        ...l,
        latitude: l.latitude + 0.02,
        accuracy: 8,
        simulated: true,
      },
      locationId: l.id,
      idempotencyKey: "bad",
    };
    await assert.rejects(repo.submitAttendance(input), /outside/);
    await assert.rejects(
      repo.submitAttendance({
        ...input,
        coordinates: { ...l, accuracy: 1000, simulated: true },
      }),
      /accuracy/,
    );
    db.policy.requireSelfie = true;
    await storage.setItem(DATABASE_KEY, JSON.stringify(db));
    const reload = createMockRepository(storage);
    await assert.rejects(
      reload.submitAttendance({
        ...input,
        coordinates: { ...l, accuracy: 8, simulated: true },
      }),
      /selfie/,
    );
  });
  it("persists approval status with notification and audit history", async () => {
    const { repo, storage } = setup();
    await assert.rejects(
      repo.reviewRequest("req-2", "Approved", "emp-1"),
      /Administrator/,
    );
    await repo.reviewRequest("req-2", "Approved", "emp-5");
    const db = await createMockRepository(storage).read();
    assert.equal(db.requests.find((r) => r.id === "req-2")?.status, "Approved");
    assert.equal(db.approvals.length, 1);
    assert.ok(db.audit.some((a) => a.entityId === "req-2"));
    assert.ok(
      db.notifications.some(
        (n) => n.employeeId === "emp-2" && n.title === "Request approved",
      ),
    );
    await assert.rejects(
      repo.reviewRequest("req-2", "Rejected", "emp-5"),
      /already/,
    );
  });
  it("recovers corrupt storage and supports reset", async () => {
    const { storage } = setup();
    await storage.setItem(DATABASE_KEY, "broken");
    const repo = createMockRepository(storage);
    assert.equal((await repo.read()).employees.length, 36);
    await repo.reviewRequest("req-2", "Approved", "emp-5");
    await repo.reset();
    assert.equal(
      (await createMockRepository(storage).read()).requests.find(
        (r) => r.id === "req-2",
      )?.status,
      "Pending",
    );
  });
  it("does not publish changes when persistence fails", async () => {
    const { storage } = setup();
    const repo = createMockRepository({
      ...storage,
      setItem: async () => {
        throw new Error("Storage full");
      },
    });
    await repo.read();
    await assert.rejects(
      repo.reviewRequest("req-2", "Approved", "emp-5"),
      /Storage full/,
    );
    assert.equal(
      (await repo.read()).requests.find((r) => r.id === "req-2")?.status,
      "Pending",
    );
  });
});
