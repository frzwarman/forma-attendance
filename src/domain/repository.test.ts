import assert from "node:assert/strict";
import { describe,it } from "node:test";
import { createMockRepository,DATABASE_KEY } from "../services/mockRepository";
import { withBrowserStorageLock, type StorageAdapter } from "../services/storageAdapter";
import { dateKey, workingDays, nextWorkingDate } from "./attendance";
import { seedDatabase } from "../services/seed";
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
  it("keeps unsupported web browsers readable while refusing unsafe writes", async () => {
    const { storage } = setup();
    const repo = createMockRepository({ ...storage,
      withLock: (key, action, mode) => withBrowserStorageLock(undefined, key, action, mode),
    });
    assert.equal((await repo.read()).employees.length, 36);
    await assert.rejects(repo.reviewRequest("req-2", "Approved", "emp-5"), /HTTPS/);
    await assert.rejects(repo.reset(), /HTTPS/);
    assert.equal((await repo.read()).requests.find((r) => r.id === "req-2")?.status, "Pending");
  });
  it("serializes independent repository instances and reads fresh saved state", async () => {
    const { storage } = setup();
    let lockCalls = 0;
    const lockedStorage: StorageAdapter = { ...storage, withLock: async (_key, action) => {
      lockCalls++;
      return action();
    } };
    const first = createMockRepository(lockedStorage);
    const second = createMockRepository(lockedStorage);
    await first.read();
    await second.read();
    await Promise.all([
      first.reviewRequest("req-2", "Approved", "emp-5"),
      second.reviewRequest("req-3", "Rejected", "emp-5"),
    ]);
    const saved = await first.read();
    assert.equal(saved.requests.find((r) => r.id === "req-2")?.status, "Approved");
    assert.equal(saved.requests.find((r) => r.id === "req-3")?.status, "Rejected");
    assert.equal(saved.approvals.length, 2);
    assert.equal(saved.audit.length, 2);
    assert.ok(lockCalls >= 5);
  });

  it("records a late after-midnight clock-in against yesterday's overnight shift", async () => {
    const { storage } = setup();
    const db = seedDatabase(new Date("2027-01-01T12:00:00+07:00"));
    db.sessions = db.sessions.filter((s) => s.employeeId !== "emp-14");
    await storage.setItem(DATABASE_KEY, JSON.stringify(db));
    const repo = createMockRepository(storage, { now: () => new Date("2027-01-02T00:15:00+07:00") });
    const office = db.locations[0];
    const session = await repo.submitAttendance({
      employeeId: "emp-14", type: "in", locationId: office.id,
      coordinates: { ...office, accuracy: 8, simulated: true }, idempotencyKey: "overnight-late",
    });
    assert.equal(session.date, "2027-01-01");
    assert.equal(session.lateMinutes, 125);
    assert.equal(session.scheduledStart, "2027-01-01T15:00:00.000Z");
  });

  it("extends an old workspace without replacing edits, history, or saved requests", async () => {
    const { storage } = setup();
    const db = seedDatabase(new Date("2026-10-25T12:00:00+07:00"));
    const edited = db.schedules.find((s) => s.employeeId === "emp-1" && s.date === "2026-11-26")!;
    edited.arrangement = "Field";
    edited.locationId = "bandung";
    db.requests[0].reason = "Keep this saved request unchanged.";
    await storage.setItem(DATABASE_KEY, JSON.stringify(db));
    const repo = createMockRepository(storage, { now: () => new Date("2026-12-02T09:00:00+07:00") });
    const refreshed = await repo.read();
    assert.deepEqual(refreshed.sessions, JSON.parse(JSON.stringify(db.sessions)));
    assert.deepEqual(refreshed.requests, db.requests);
    assert.deepEqual(refreshed.schedules.find((s) => s.id === edited.id), edited);
    assert.ok(refreshed.schedules.some((s) => s.employeeId === "emp-1" && s.date === "2027-01-06"));
    assert.equal((await repo.read()).schedules.length, refreshed.schedules.length);
    const office = db.locations[0];
    const session = await repo.submitAttendance({ employeeId: "emp-1", type: "in", locationId: office.id,
      coordinates: { ...office, accuracy: 8, simulated: true }, idempotencyKey: "renewed-schedule" });
    assert.equal(session.date, "2026-12-02");
  });

  it("renews annual entitlement and checks each year of a cross-year request", async () => {
    const { storage } = setup();
    const db = seedDatabase();
    const year = new Date().getUTCFullYear() + 1;
    db.requests = [{ id: "old-leave", employeeId: "emp-1", kind: "leave", type: "Annual leave",
      start: `${year - 1}-01-01`, end: `${year - 1}-01-31`, days: 14,
      reason: "A previous year's approved leave", status: "Approved", createdAt: new Date().toISOString() }];
    await storage.setItem(DATABASE_KEY, JSON.stringify(db));
    const repo = createMockRepository(storage);
    const start = `${year}-12-20`;
    const end = `${year + 1}-01-15`;
    const request = { id: "cross-year-leave", employeeId: "emp-1", kind: "leave" as const,
      type: "Annual leave" as const, start, end, days: workingDays(start, end),
      reason: "A holiday across the new year", status: "Pending" as const, createdAt: new Date().toISOString() };
    assert.ok(request.days > 14);
    await repo.submitRequest(request);
    const extra = nextWorkingDate(`${year + 1}-01-18`);
    await repo.submitRequest({ ...request, id: "reserve-more", start: extra, end: extra });
    await assert.rejects(repo.submitRequest({ ...request, id: "too-many", start: `${year + 1}-02-01`, end: `${year + 1}-02-07` }), /Not enough annual leave/);
  });
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
