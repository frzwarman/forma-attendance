import { z } from "zod";
import type {
  AttendancePolicy,
  AttendanceSession,
  Coordinates,
  WorkLocation,
  Schedule,
} from "../types";
export const dateKey = (
  date: Date | string = new Date(),
  timezone = "Asia/Jakarta",
) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    numberingSystem: "latn",
  }).formatToParts(new Date(date));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export function attendanceAvailability(
  session?: AttendanceSession,
  schedule?: Schedule,
) {
  if (session?.clockIn && !session.clockOut) return "working";
  if (session?.clockOut) return "complete";
  if (session?.status === "Leave") return "leave";
  if (schedule?.dayOff || session?.status === "Day off") return "day-off";
  return schedule ? "ready" : "unscheduled";
}

export function nextWorkingDate(start = dateKey(), workweek = [1, 2, 3, 4, 5]) {
  if (
    !validDate(start) ||
    !workweek.some((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  )
    throw new Error("A valid date and at least one working day are required.");
  const day = new Date(`${start}T12:00:00Z`);
  while (!workweek.includes(day.getUTCDay()))
    day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}
export const time = (value?: string | Date) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(new Date(value))
        .replace(".", ":")
    : "—";
export const duration = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(Math.floor(minutes % 60)).padStart(2, "0")}m`;
export function distanceMeters(
  a: Pick<Coordinates, "latitude" | "longitude">,
  b: Pick<Coordinates, "latitude" | "longitude">,
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const p =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
}
export function geofence(
  coords: Coordinates,
  office: WorkLocation,
  maxAccuracy = 80,
) {
  if (
    ![coords.latitude, coords.longitude, coords.accuracy].every(
      Number.isFinite,
    ) ||
    Math.abs(coords.latitude) > 90 ||
    Math.abs(coords.longitude) > 180 ||
    coords.accuracy < 0
  )
    return { distance: Infinity, status: "uncertain" } as const;
  const distance = distanceMeters(coords, office);
  const status =
    !office.active || distance - coords.accuracy > office.radius
      ? "outside"
      : coords.accuracy > maxAccuracy ||
          distance + coords.accuracy > office.radius
        ? "uncertain"
        : "inside";
  return { distance, status } as const;
}
export function clockIn(
  session: AttendanceSession,
  timestamp: string,
  policy: AttendancePolicy,
): AttendanceSession {
  if (session.clockIn)
    throw new Error("You have already clocked in for this shift.");
  if (session.status === "Leave" || session.status === "Day off")
    throw new Error("This shift is not available for clock-in.");
  const lateMinutes = Math.max(
    0,
    Math.floor(
      (+new Date(timestamp) - +new Date(session.scheduledStart)) / 60000,
    ) - policy.graceMinutes,
  );
  return { ...session, clockIn: timestamp, status: "Working", lateMinutes };
}
export function clockOut(
  session: AttendanceSession,
  timestamp: string,
): AttendanceSession {
  if (!session.clockIn) throw new Error("Clock in before clocking out.");
  if (session.clockOut) throw new Error("This shift is already complete.");
  if (+new Date(timestamp) < +new Date(session.clockIn))
    throw new Error("Clock-out cannot precede clock-in.");
  return {
    ...session,
    clockOut: timestamp,
    durationMinutes: Math.floor(
      (+new Date(timestamp) - +new Date(session.clockIn)) / 60000,
    ),
    status: session.lateMinutes > 0 ? "Late" : "Present",
    earlyDepartureMinutes: Math.max(
      0,
      Math.floor(
        (+new Date(session.scheduledEnd) - +new Date(timestamp)) / 60000,
      ),
    ),
    overtimeMinutes: Math.max(
      0,
      Math.floor(
        (+new Date(timestamp) - +new Date(session.scheduledEnd)) / 60000,
      ),
    ),
  };
}
export const validDate = (value: string) => {
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
};
export const leaveSchema = z
  .object({
    type: z.enum([
      "Annual leave",
      "Sick leave",
      "Personal leave",
      "Unpaid leave",
    ]),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    reason: z
      .string()
      .trim()
      .min(10, "Please add at least 10 characters.")
      .max(1000),
  })
  .superRefine((v, ctx) => {
    if (!validDate(v.start) || !validDate(v.end))
      ctx.addIssue({
        code: "custom",
        path: ["start"],
        message: "Choose valid dates.",
      });
    if (v.end < v.start)
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "End date must be on or after the start date.",
      });
    if (v.start < dateKey())
      ctx.addIssue({
        code: "custom",
        path: ["start"],
        message: "Choose today or a future date.",
      });
  });
export const correctionSchema = z.object({
  type: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine(
      (v) => validDate(v) && v <= dateKey(),
      "Choose today or a past date.",
    ),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM"),
  reason: z.string().trim().min(10, "Please add at least 10 characters."),
});
export function workingDays(
  start: string,
  end: string,
  workweek = [1, 2, 3, 4, 5],
) {
  let days = 0;
  for (
    let d = new Date(start + "T12:00:00Z");
    d <= new Date(end + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  )
    if (workweek.includes(d.getUTCDay())) days++;
  return days;
}
