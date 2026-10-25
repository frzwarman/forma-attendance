import {
clockIn,
clockOut,
attendanceContext,
annualLeaveBalance,
correctionSchema,
geofence,
leaveSchema,
workingDays,
} from "../domain/attendance";
import type {
Approval,
AttendanceEvent,
AttendanceSession,
Coordinates,
DemoDatabase,
WorkLocation,
WorkforceRequest,
} from "../types";
import { extendDemoSchedules,organization,seedDatabase } from "./seed";
import { withStorageLock,type StorageAdapter } from "./storageAdapter";
export const DATABASE_KEY = "forma.demo.v1";
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export interface AttendanceSubmission {
  employeeId: string;
  type: "in" | "out";
  coordinates: Coordinates;
  locationId: string;
  idempotencyKey: string;
  selfieReference?: string;
}
export interface WorkforceRepository {
  read(): Promise<DemoDatabase>;
  submitAttendance(input: AttendanceSubmission): Promise<AttendanceSession>;
  submitRequest(input: WorkforceRequest): Promise<void>;
  reviewRequest(
    id: string,
    status: "Approved" | "Rejected",
    reviewerId: string,
  ): Promise<void>;
  saveLocation(location: WorkLocation): Promise<void>;
  markNotifications(employeeId: string): Promise<void>;
  reset(): Promise<void>;
}
// Replace this clock with a server-side RPC timestamp in the Supabase adapter.
export interface AuthoritativeClock {
  now(): Date;
}
export const mockClock: AuthoritativeClock = { now: () => new Date() };
export function createMockRepository(
  storage: StorageAdapter,
  clock: AuthoritativeClock = mockClock,
): WorkforceRepository {
  async function load() {
    const raw = await storage.getItem(DATABASE_KEY);
    let database: DemoDatabase;
    try {
      const parsed = raw ? JSON.parse(raw) : undefined;
      database = parsed?.version === 1 ? parsed : seedDatabase(clock.now());
    } catch {
      database = seedDatabase(clock.now());
    }
    extendDemoSchedules(database, clock.now());
    return database;
  }
  async function transaction<T>(fn: (db: DemoDatabase) => T): Promise<T> {
    return withStorageLock(storage, DATABASE_KEY, async () => {
      const db = await load();
      const value = fn(db);
      await storage.setItem(DATABASE_KEY, JSON.stringify(db));
      return value;
    });
  }
  function structuredCopy<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
  }
  function notify(
    db: DemoDatabase,
    employeeId: string,
    title: string,
    message: string,
  ) {
    db.notifications.unshift({
      id: uid(),
      employeeId,
      title,
      message,
      category: "attendance",
      timestamp: clock.now().toISOString(),
      read: false,
    });
  }
  const repository: WorkforceRepository = {
    read: () => withStorageLock(storage, DATABASE_KEY,
      async () => structuredCopy(await load()), "read"),
    submitAttendance: (input) =>
      transaction((db) => {
        const previous = db.events.find(
          (e) => e.idempotencyKey === input.idempotencyKey,
        );
        if (previous) {
          if (
            previous.employeeId !== input.employeeId ||
            previous.type !== input.type
          )
            throw new Error("Idempotency key already used.");
          return db.sessions.find((s) => s.id === previous.sessionId)!;
        }
        const office = db.locations.find((l) => l.id === input.locationId);
        if (!office) throw new Error("Office not found.");
        const zone = geofence(input.coordinates, office, db.policy.maxAccuracy);
        if (zone.status !== "inside")
          throw new Error(
            zone.status === "outside"
              ? "You are outside the attendance zone."
              : "GPS accuracy is too low. Please try again.",
          );
        if (db.policy.requireSelfie && !input.selfieReference)
          throw new Error("A selfie is required by company policy.");
        const now = clock.now().toISOString();
        const context = attendanceContext(db.schedules, db.sessions, input.employeeId, now, organization.timezone);
        const schedule = context.schedule;
        let session = context.session;
        if (!session) {
          if (!schedule || schedule.dayOff)
            throw new Error("No working shift scheduled.");
          session = {
            id: uid(),
            employeeId: input.employeeId,
            organizationId: organization.id,
            shiftId: schedule.shiftId,
            date: schedule.date,
            scheduledStart: schedule.start,
            scheduledEnd: schedule.end,
            durationMinutes: 0,
            status: "Present",
            arrangement: schedule.arrangement,
            locationId: office.id,
            lateMinutes: 0,
          };
        }
        const shift = db.shifts.find((s) => s.id === session!.shiftId)!;
        const updated =
          input.type === "in"
            ? clockIn(session, now, {
                ...db.policy,
                graceMinutes: shift.graceMinutes,
              })
            : clockOut(session, now);
        db.sessions = db.sessions.filter((s) => s.id !== updated.id);
        db.sessions.push(updated);
        const event: AttendanceEvent = {
          id: uid(),
          sessionId: updated.id,
          employeeId: input.employeeId,
          organizationId: organization.id,
          type: input.type,
          timestamp: now,
          coordinates: input.coordinates,
          geofence: zone.status,
          verification: input.coordinates.simulated
            ? "Simulated"
            : input.selfieReference
              ? "GPS + selfie"
              : "GPS",
          selfieReference: input.selfieReference
            ? "captured-in-memory"
            : undefined,
          idempotencyKey: input.idempotencyKey,
        };
        db.events.push(event);
        db.audit.push({
          id: uid(),
          actorId: input.employeeId,
          action: `attendance.${input.type}`,
          entityId: event.id,
          timestamp: now,
        });
        notify(
          db,
          input.employeeId,
          input.type === "in"
            ? "You’re checked in!"
            : "Your workday is wrapped up.",
          `${office.name} • ${input.coordinates.simulated ? "Simulated location" : "GPS location"}`,
        );
        return updated;
      }),
    submitRequest: (request) =>
      transaction((db) => {
        if (request.kind === "leave") {
          leaveSchema.parse(request);
          const days = workingDays(
            request.start,
            request.end,
            organization.workweek,
          );
          if (days === 0) throw new Error("Choose at least one working day.");
          if (
            db.requests.some(
              (r) =>
                r.kind === "leave" &&
                r.employeeId === request.employeeId &&
                r.status !== "Rejected" &&
                r.status !== "Cancelled" &&
                r.start <= request.end &&
                r.end >= request.start,
            )
          )
            throw new Error("These dates overlap an existing leave request.");
          if (request.type === "Annual leave") {
            for (let year = Number(request.start.slice(0, 4)); year <= Number(request.end.slice(0, 4)); year++) {
              const balance = annualLeaveBalance(db.requests, request.employeeId, year, organization.workweek);
              const requested = workingDays(
                request.start > `${year}-01-01` ? request.start : `${year}-01-01`,
                request.end < `${year}-12-31` ? request.end : `${year}-12-31`,
                organization.workweek,
              );
              if (requested > balance.available)
                throw new Error(`Not enough annual leave remaining for ${year}.`);
            }
          }
          db.requests.unshift({ ...request, days, status: "Pending" });
        } else {
          correctionSchema.parse(request);
          db.requests.unshift({ ...request, status: "Pending" });
        }
        notify(
          db,
          request.employeeId,
          "Request submitted",
          "Your request is with the People team.",
        );
      }),
    reviewRequest: (id, status, reviewerId) =>
      transaction((db) => {
        if (db.employees.find((e) => e.id === reviewerId)?.role !== "admin")
          throw new Error("Administrator role required.");
        const req = db.requests.find((r) => r.id === id);
        if (!req || req.status !== "Pending")
          throw new Error("This request has already been reviewed.");
        req.status = status;
        const approval: Approval = {
          id: uid(),
          requestId: id,
          reviewerId,
          status,
          timestamp: clock.now().toISOString(),
        };
        db.approvals.push(approval);
        db.audit.push({
          id: uid(),
          actorId: reviewerId,
          action: `request.${status.toLowerCase()}`,
          entityId: id,
          timestamp: approval.timestamp,
        });
        notify(
          db,
          req.employeeId,
          `Request ${status.toLowerCase()}`,
          `Your ${req.kind === "leave" ? "time off" : "attendance correction"} request has been ${status.toLowerCase()}.`,
        );
      }),
    saveLocation: (location) =>
      transaction((db) => {
        if (
          !location.name.trim() ||
          !Number.isFinite(location.latitude) ||
          Math.abs(location.latitude) > 90 ||
          !Number.isFinite(location.longitude) ||
          Math.abs(location.longitude) > 180 ||
          !Number.isFinite(location.radius) ||
          location.radius < 10 ||
          location.radius > 10000
        )
          throw new Error(
            "Enter a valid name, coordinates, and radius (10–10,000 m).",
          );
        db.locations = [
          ...db.locations.filter((l) => l.id !== location.id),
          location,
        ];
      }),
    markNotifications: (employeeId) =>
      transaction((db) => {
        db.notifications.forEach((n) => {
          if (n.employeeId === employeeId) n.read = true;
        });
      }),
    reset: () => withStorageLock(storage, DATABASE_KEY, async () => {
      const next = seedDatabase(clock.now());
      await storage.setItem(DATABASE_KEY, JSON.stringify(next));
    }),
  };
  return repository;
}
