import { dateKey } from "../domain/attendance";
import type {
AttendanceSession,
DemoDatabase,
Employee,
Schedule,
} from "../types";
export const organization = {
  id: "northstar",
  name: "Northstar Technologies",
  timezone: "Asia/Jakarta",
  locale: "id-ID",
  workweek: [1, 2, 3, 4, 5],
};
export const departments = [
  "Engineering",
  "Product",
  "Design",
  "Finance",
  "Human Resources",
  "Operations",
];
const names = [
  "Alex Morgan",
  "Sarah Wijaya",
  "Rizky Pratama",
  "Nadia Putri",
  "Kevin Santoso",
  "Dewi Lestari",
  "Fajar Hidayat",
  "Amanda Tan",
  "Bima Saputra",
  "Clara Kusuma",
  "Dimas Aditya",
  "Elena Hartono",
  "Farhan Malik",
  "Grace Natalia",
  "Hana Salsabila",
  "Irfan Ramadhan",
  "Jessica Lim",
  "Karin Maharani",
  "Liam Anderson",
  "Maya Permata",
  "Naufal Hakim",
  "Olivia Chen",
  "Putra Wibowo",
  "Rachel Ananda",
  "Satria Nugraha",
  "Tara Amelia",
  "Umar Fauzi",
  "Vanessa Goh",
  "Wahyu Setiawan",
  "Yasmin Aulia",
  "Zara Kirana",
  "Arif Rahman",
  "Bella Anggraini",
  "Citra Sari",
  "Daniel Lee",
  "Eka Purnama",
];
export const avatar = (index: number) =>
  `https://i.pravatar.cc/120?img=${[12, 47, 11, 44, 13, 49, 14, 45, 15, 46, 33, 48][index % 12]}`;
export function seedDatabase(): DemoDatabase {
  const now = new Date();
  const today = dateKey(now);
  const employees: Employee[] = names.map((name, i) => ({
    id: `emp-${i + 1}`,
    organizationId: "northstar",
    name,
    email:
      i === 0
        ? "alex@northstar.demo"
        : i === 4
          ? "hr@northstar.demo"
          : name.toLowerCase().split(" ")[0] + "@northstar.demo",
    title:
      i === 0
        ? "Senior Product Designer"
        : [
            "Software Engineer",
            "Product Manager",
            "Product Designer",
            "Financial Analyst",
            "People Operations",
            "Operations Specialist",
          ][i % 6],
    department: i === 0 ? "Design" : departments[i % 6],
    avatar: avatar(i),
    role: i === 4 ? "admin" : "employee",
    locationId: "hq",
    status: "Full-time",
  }));
  const shifts = [
    {
      id: "regular",
      name: "Regular shift",
      start: "09:00",
      end: "18:00",
      breakMinutes: 60,
      graceMinutes: 10,
      locationRequired: true,
      type: "Morning" as const,
    },
    {
      id: "night",
      name: "Night shift",
      start: "22:00",
      end: "06:00",
      breakMinutes: 60,
      graceMinutes: 10,
      locationRequired: true,
      type: "Night" as const,
    },
    {
      id: "flex",
      name: "Flexible shift",
      start: "10:00",
      end: "19:00",
      breakMinutes: 60,
      graceMinutes: 30,
      locationRequired: false,
      type: "Flexible" as const,
    },
    {
      id: "afternoon",
      name: "Afternoon shift",
      start: "13:00",
      end: "22:00",
      breakMinutes: 60,
      graceMinutes: 10,
      locationRequired: true,
      type: "Afternoon" as const,
    },
  ];
  const schedules: Schedule[] = [];
  const sessions: AttendanceSession[] = [];
  for (let offset = -95; offset <= 35; offset++) {
    const day = new Date(today + "T12:00:00Z");
    day.setUTCDate(day.getUTCDate() + offset);
    const date = day.toISOString().slice(0, 10);
    const weekend = [0, 6].includes(day.getUTCDay());
    employees.forEach((e, i) => {
      const shift =
        shifts[i === 0 ? 0 : i % 13 === 0 ? 1 : i % 7 === 0 ? 2 : 0];
      const endDate = new Date(day);
      if (shift.end < shift.start) endDate.setUTCDate(endDate.getUTCDate() + 1);
      const start = new Date(
        date + "T" + shift.start + ":00+07:00",
      ).toISOString();
      const end = new Date(
        endDate.toISOString().slice(0, 10) + "T" + shift.end + ":00+07:00",
      ).toISOString();
      const arrangement =
        i === 0
          ? [2, 4].includes(day.getUTCDay())
            ? "Remote"
            : "Office"
          : i % 4 === 0
            ? "Hybrid"
            : "Office";
      const dayOff = weekend && offset !== 0;
      schedules.push({
        id: `sch-${e.id}-${date}`,
        employeeId: e.id,
        shiftId: shift.id,
        date,
        start,
        end,
        arrangement,
        locationId: "hq",
        dayOff,
      });
      if (offset >= 0 && !(offset === 0 && i > 0)) return;
      const status = dayOff
        ? "Day off"
        : (i + Math.abs(offset)) % 19 === 0
          ? "Leave"
          : (i + Math.abs(offset)) % 23 === 0
            ? "Absent"
            : (i + Math.abs(offset)) % 8 === 0
              ? "Late"
              : "Present";
      const late = status === "Late" ? 18 : 0;
      const hasTime = status === "Present" || status === "Late";
      sessions.push({
        id: `session-${e.id}-${date}`,
        employeeId: e.id,
        organizationId: "northstar",
        shiftId: shift.id,
        date,
        scheduledStart: start,
        scheduledEnd: end,
        clockIn: hasTime
          ? new Date(+new Date(start) + (late - 4) * 60000).toISOString()
          : undefined,
        clockOut:
          hasTime && offset < 0
            ? new Date(+new Date(end) + 7 * 60000).toISOString()
            : undefined,
        durationMinutes: hasTime ? 551 - late : 0,
        status: offset === 0 && hasTime ? "Working" : status,
        arrangement,
        locationId: "hq",
        lateMinutes: late,
      });
    });
  }
  return {
    version: 1,
    employees,
    shifts,
    schedules,
    sessions,
    events: [],
    locations: [
      {
        id: "hq",
        name: "Jakarta Headquarters",
        address: "Sudirman Central Business District, Jakarta",
        latitude: -6.2254,
        longitude: 106.8098,
        radius: 150,
        active: true,
      },
      {
        id: "bandung",
        name: "Bandung Studio",
        address: "Jl. Asia Afrika, Bandung",
        latitude: -6.9218,
        longitude: 107.6071,
        radius: 200,
        active: true,
      },
    ],
    policy: {
      graceMinutes: 10,
      maxAccuracy: 80,
      requireSelfie: false,
      allowOvertime: true,
    },
    requests: [
      {
        id: "req-1",
        employeeId: "emp-1",
        kind: "leave",
        type: "Annual leave",
        start: future(8),
        end: future(9),
        reason: "A little time away with family.",
        days: 2,
        status: "Approved",
        createdAt: new Date(+now - 86400000 * 3).toISOString(),
      },
      {
        id: "req-2",
        employeeId: "emp-2",
        kind: "leave",
        type: "Annual leave",
        start: future(3),
        end: future(4),
        reason: "Family celebration in Bandung.",
        days: 2,
        status: "Pending",
        createdAt: new Date(+now - 3600000).toISOString(),
      },
      {
        id: "req-3",
        employeeId: "emp-3",
        kind: "correction",
        type: "Forgot to clock out",
        date: future(-1),
        time: "18:05",
        reason: "I left the office but forgot to clock out.",
        status: "Pending",
        createdAt: new Date(+now - 7200000).toISOString(),
      },
    ],
    notifications: [
      {
        id: "n1",
        employeeId: "emp-1",
        title: "Your time off is approved",
        message:
          "Your annual leave request has been approved. Enjoy your break!",
        category: "request",
        timestamp: new Date(+now - 3600000 * 2).toISOString(),
        read: false,
      },
      {
        id: "n2",
        employeeId: "emp-1",
        title: "A little connection goes a long way",
        message:
          "Join our Friday team lunch at the pantry. Good food, great company.",
        category: "company",
        timestamp: new Date(+now - 86400000).toISOString(),
        read: false,
      },
    ],
    approvals: [],
    audit: [],
  };
}
function future(offset: number) {
  const d = new Date(dateKey() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
