import assert from "node:assert/strict";
import { describe,it } from "node:test";
import type { AttendanceSession } from "../types";
import {
clockIn,
clockOut,
dateKey,
distanceMeters,
geofence,
leaveSchema,
workingDays,
attendanceAvailability,
nextWorkingDate,
} from "./attendance";
const base: AttendanceSession = {
  id: "1",
  employeeId: "1",
  organizationId: "1",
  shiftId: "night",
  date: "2026-10-23",
  scheduledStart: "2026-10-23T15:00:00Z",
  scheduledEnd: "2026-10-23T23:00:00Z",
  durationMinutes: 0,
  status: "Present",
  arrangement: "Office",
  locationId: "1",
  lateMinutes: 0,
};
const policy = {
  graceMinutes: 10,
  maxAccuracy: 80,
  requireSelfie: false,
  allowOvertime: true,
};
describe("Attendance transitions", () => {
  it("clocks in early without marking late", () => {
    const s = clockIn(base, "2026-10-23T14:56:00Z", policy);
    assert.equal(s.lateMinutes, 0);
    assert.equal(s.status, "Working");
  });
  it("prevents duplicate clock-ins", () => {
    const s = clockIn(base, "2026-10-23T15:00:00Z", policy);
    assert.throws(() => clockIn(s, "2026-10-23T15:01:00Z", policy), /already/);
  });
  it("applies configured grace period", () => {
    assert.equal(clockIn(base, "2026-10-23T15:18:00Z", policy).lateMinutes, 8);
    assert.equal(
      clockIn(base, "2026-10-23T15:18:00Z", { ...policy, graceMinutes: 20 })
        .lateMinutes,
      0,
    );
  });
  it("calculates actual elapsed duration across midnight", () => {
    const s = clockOut(
      clockIn(base, "2026-10-23T15:00:00Z", policy),
      "2026-10-23T23:05:00Z",
    );
    assert.equal(s.durationMinutes, 485);
    assert.equal(s.overtimeMinutes, 5);
    assert.equal(dateKey(s.clockOut!), "2026-10-24");
  });
  it("detects early departure", () => {
    const s = clockOut(
      clockIn(base, "2026-10-23T15:00:00Z", policy),
      "2026-10-23T22:30:00Z",
    );
    assert.equal(s.earlyDepartureMinutes, 30);
  });
  it("blocks invalid clock-outs and time reversal", () => {
    assert.throws(() => clockOut(base, "2026-10-23T16:00:00Z"), /Clock in/);
    const s = clockIn(base, "2026-10-23T15:00:00Z", policy);
    assert.throws(() => clockOut(s, "2026-10-23T14:00:00Z"), /precede/);
    assert.throws(
      () =>
        clockOut(clockOut(s, "2026-10-23T23:00:00Z"), "2026-10-23T23:01:00Z"),
      /already/,
    );
  });
  it("blocks leave and non-working days", () => {
    assert.throws(
      () =>
        clockIn({ ...base, status: "Leave" }, "2026-10-23T15:00:00Z", policy),
      /not available/,
    );
  });
});
describe("Geofence", () => {
  const office = {
    id: "1",
    name: "HQ",
    address: "Jakarta",
    latitude: -6.2,
    longitude: 106.8,
    radius: 150,
    active: true,
  };
  const coords = {
    latitude: -6.2,
    longitude: 106.8,
    accuracy: 10,
    simulated: true,
  };
  it("calculates haversine distance", () => {
    assert.equal(distanceMeters(coords, coords), 0);
    assert.ok(
      Math.abs(
        distanceMeters(
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
        ) - 111195,
      ) < 2,
    );
  });
  it("verifies inside office", () =>
    assert.equal(geofence(coords, office).status, "inside"));
  it("rejects outside zone", () =>
    assert.equal(
      geofence({ ...coords, latitude: -6.21 }, office).status,
      "outside",
    ));
  it("never silently accepts low accuracy or boundary uncertainty", () => {
    assert.equal(
      geofence({ ...coords, accuracy: 200 }, office).status,
      "uncertain",
    );
    assert.equal(
      geofence({ ...coords, latitude: -6.2012, accuracy: 30 }, office).status,
      "uncertain",
    );
  });
  it("rejects inactive offices", () =>
    assert.equal(
      geofence(coords, { ...office, active: false }).status,
      "outside",
    ));
});
describe("Leave and timezone", () => {
  it("starts leave on the next configured working day, including year rollover", () => {
    assert.equal(nextWorkingDate("2026-10-25"), "2026-10-26");
    assert.equal(nextWorkingDate("2026-10-26"), "2026-10-26");
    assert.equal(nextWorkingDate("2026-12-31", [1]), "2027-01-04");
    assert.equal(nextWorkingDate("2026-10-23", [0, 6]), "2026-10-24");
    assert.throws(() => nextWorkingDate("2026-02-30"), /valid date/);
    assert.throws(() => nextWorkingDate("2026-10-25", []), /working day/);
  });
  it("distinguishes rest days, leave and missing shifts while allowing overnight clock-out", () => {
    const schedule = {
      id: "shift-today", employeeId: "1", date: "2026-10-23", shiftId: "night",
      start: base.scheduledStart, end: base.scheduledEnd, locationId: "1",
      arrangement: "Office" as const, dayOff: false,
    };
    assert.equal(attendanceAvailability(undefined, schedule), "ready");
    assert.equal(attendanceAvailability(undefined, { ...schedule, dayOff: true }), "day-off");
    assert.equal(attendanceAvailability({ ...base, status: "Leave" }, schedule), "leave");
    assert.equal(attendanceAvailability(), "unscheduled");
    const active = clockIn(base, base.scheduledStart, policy);
    assert.equal(attendanceAvailability(active, { ...schedule, dayOff: true }), "working");
    assert.equal(attendanceAvailability(active), "working");
    assert.equal(attendanceAvailability(clockOut(active, base.scheduledEnd)), "complete");
  });
  it("counts configurable workdays", () => {
    assert.equal(workingDays("2026-10-23", "2026-10-26"), 2);
    assert.equal(workingDays("2026-10-23", "2026-10-26", [6, 0]), 2);
  });
  it("rejects invalid dates, short reasons and reversed ranges", () => {
    assert.equal(
      leaveSchema.safeParse({
        type: "Annual leave",
        start: "2028-01-10",
        end: "2028-01-01",
        reason: "A planned family holiday",
      }).success,
      false,
    );
    assert.equal(
      leaveSchema.safeParse({
        type: "Annual leave",
        start: "x",
        end: "x",
        reason: "a",
      }).success,
      false,
    );
  });
  it("converts UTC into company date", () =>
    assert.equal(dateKey("2026-10-23T18:00:00Z"), "2026-10-24"));
  it("handles DST display date without device timezone assumptions", () =>
    assert.equal(
      dateKey("2026-11-01T04:30:00Z", "America/New_York"),
      "2026-11-01",
    ));
});
it("invalid GPS coordinates cannot become a verified geofence", () => {
  const office = {
    id: "1",
    name: "HQ",
    address: "Jakarta",
    latitude: -6.2,
    longitude: 106.8,
    radius: 150,
    active: true,
  };
  assert.equal(
    geofence(
      { latitude: NaN, longitude: 106.8, accuracy: 8, simulated: true },
      office,
    ).status,
    "uncertain",
  );
  assert.equal(
    geofence(
      { latitude: -6.2, longitude: 106.8, accuracy: -1, simulated: true },
      office,
    ).status,
    "uncertain",
  );
});
it("calendar rollover dates cannot pass leave validation", () => {
  assert.equal(
    leaveSchema.safeParse({
      type: "Annual leave",
      start: "2028-02-30",
      end: "2028-03-02",
      reason: "A planned family holiday",
    }).success,
    false,
  );
});
