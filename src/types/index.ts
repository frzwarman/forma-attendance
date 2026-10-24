export type ID = string;
export type Role = "employee" | "admin";
export type Arrangement = "Office" | "Remote" | "Hybrid" | "Field";
export type AttendanceStatus =
  "Present" | "Late" | "Absent" | "Leave" | "Day off" | "Working";
export type RequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";
export interface Organization {
  id: ID;
  name: string;
  timezone: string;
  locale: string;
  workweek: number[];
}
export interface Department {
  id: ID;
  name: string;
}
export interface Employee {
  id: ID;
  organizationId: ID;
  name: string;
  email: string;
  title: string;
  department: string;
  avatar: string;
  role: Role;
  locationId: ID;
  status: "Full-time" | "Contract";
}
export interface WorkLocation {
  id: ID;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  active: boolean;
}
export interface Shift {
  id: ID;
  name: string;
  start: string;
  end: string;
  breakMinutes: number;
  graceMinutes: number;
  locationRequired: boolean;
  type: "Morning" | "Afternoon" | "Night" | "Flexible" | "Rotating";
}
export interface Schedule {
  id: ID;
  employeeId: ID;
  shiftId: ID;
  date: string;
  start: string;
  end: string;
  arrangement: Arrangement;
  locationId: ID;
  dayOff: boolean;
}
export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  simulated: boolean;
}
export interface AttendanceEvent {
  id: ID;
  sessionId: ID;
  employeeId: ID;
  organizationId: ID;
  type: "in" | "out";
  timestamp: string;
  coordinates: Coordinates;
  geofence: "inside" | "outside" | "uncertain";
  verification: "GPS" | "GPS + selfie" | "Simulated";
  selfieReference?: string;
  idempotencyKey: string;
}
export interface AttendanceSession {
  id: ID;
  employeeId: ID;
  organizationId: ID;
  shiftId: ID;
  date: string;
  scheduledStart: string;
  scheduledEnd: string;
  clockIn?: string;
  clockOut?: string;
  durationMinutes: number;
  status: AttendanceStatus;
  arrangement: Arrangement;
  locationId: ID;
  lateMinutes: number;
  earlyDepartureMinutes?: number;
  overtimeMinutes?: number;
}
export interface AttendancePolicy {
  graceMinutes: number;
  maxAccuracy: number;
  requireSelfie: boolean;
  allowOvertime: boolean;
}
export interface LeaveRequest {
  id: ID;
  employeeId: ID;
  kind: "leave";
  type: "Annual leave" | "Sick leave" | "Personal leave" | "Unpaid leave";
  start: string;
  end: string;
  reason: string;
  days: number;
  status: RequestStatus;
  createdAt: string;
}
export interface AttendanceCorrection {
  id: ID;
  employeeId: ID;
  kind: "correction";
  type: string;
  date: string;
  time: string;
  reason: string;
  attachment?: string;
  status: RequestStatus;
  createdAt: string;
}
export type WorkforceRequest = LeaveRequest | AttendanceCorrection;
export interface Notification {
  id: ID;
  employeeId: ID;
  title: string;
  message: string;
  category: "attendance" | "request" | "company";
  timestamp: string;
  read: boolean;
}
export interface Approval {
  id: ID;
  requestId: ID;
  reviewerId: ID;
  status: "Approved" | "Rejected";
  timestamp: string;
}
export interface AuditLog {
  id: ID;
  actorId: ID;
  action: string;
  entityId: ID;
  timestamp: string;
}
export interface DemoDatabase {
  version: number;
  employees: Employee[];
  locations: WorkLocation[];
  shifts: Shift[];
  schedules: Schedule[];
  sessions: AttendanceSession[];
  events: AttendanceEvent[];
  requests: WorkforceRequest[];
  notifications: Notification[];
  approvals: Approval[];
  audit: AuditLog[];
  policy: AttendancePolicy;
}
