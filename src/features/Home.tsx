import { useAppDimensions } from "../hooks/useAppDimensions";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  FilePenLine,
  Fingerprint,
  History,
  House,
  MapPin,
  Palmtree,
  Sparkles,
  Timer,
  Users,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import {
  Badge,
  Button,
  Card,
  IconBox,
  Row,
  SectionTitle,
  T,
} from "../components/ui";
import { dateKey, duration, time } from "../domain/attendance";
import { useData } from "../services/data";
import { useTheme } from "../theme";
import type { AttendanceSession } from "../types";
import { AttendanceFlow } from "./attendance/AttendanceFlow";
export function PageHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  const c = useTheme();
  const { width } = useAppDimensions();
  return (
    <Row
      style={{
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        marginBottom: 26,
        gap: 14,
      }}
    >
      <View>
        <T
          size={width < 500 ? 25 : 29}
          weight="bold"
          style={{ letterSpacing: -1 }}
        >
          {title}
        </T>
        <T color={c.muted} size={12} style={{ marginTop: 5 }}>
          {subtitle}
        </T>
      </View>
      {right}
    </Row>
  );
}
export default function Home() {
  const c = useTheme();
  const { db, employee } = useData();
  const { width } = useAppDimensions();
  const large = width >= 1150;
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const [flow, setFlow] = useState(false);
  const [flowType, setFlowType] = useState<"in" | "out">("in");
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  const schedule = db.schedules.find(
    (s) => s.employeeId === employee.id && s.date === dateKey(),
  );
  const active = db.sessions.find(
    (s) => s.employeeId === employee.id && s.clockIn && !s.clockOut,
  );
  const today =
    active ||
    db.sessions.find(
      (s) => s.employeeId === employee.id && s.date === dateKey(),
    );
  const working = !!today?.clockIn && !today.clockOut;
  const complete = !!today?.clockOut;
  const office = db.locations.find(
    (l) => l.id === (schedule?.locationId || "hq"),
  )!;
  const shift = db.shifts.find((s) => s.id === schedule?.shiftId);
  const history = db.sessions
    .filter(
      (s) =>
        s.employeeId === employee.id &&
        s.date < dateKey() &&
        s.status !== "Day off",
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const month = history.filter((s) => s.date.startsWith(dateKey().slice(0, 7)));
  const present = month.filter(
    (s) => s.status === "Present" || s.status === "Late",
  ).length;
  const late = month.filter((s) => s.status === "Late").length;
  const absent = month.filter((s) => s.status === "Absent").length;
  const hours = Math.round(
    month.reduce((n, s) => n + s.durationMinutes, 0) / 60,
  );
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <View style={{ gap: 24 }}>
      <View style={{ marginBottom: -24 }}>
        <PageHeading
          title={`${greeting}, ${employee.name.split(" ")[0]} ☀`}
          subtitle="A fresh start. Let’s make today a good one."
          right={
            <View
              style={{
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 9,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Row style={{ gap: 7 }}>
                <CalendarDays size={14} color={c.muted} />
                <T size={10} weight="medium">
                  {dateLabel}
                </T>
              </Row>
            </View>
          }
        />
      </View>
      <View style={{ flexDirection: large ? "row" : "column", gap: 22 }}>
        <View style={{ flex: large ? 1.64 : undefined }}>
          <LinearGradient
            colors={["#6660E5", "#5149CE"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 20,
              padding: 26,
              minHeight: 290,
              overflow: "hidden",
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 320,
                height: 320,
                borderWidth: 1,
                borderColor: "#FFFFFF10",
                borderRadius: 160,
                right: -84,
                top: -98,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 236,
                height: 236,
                borderWidth: 1,
                borderColor: "#FFFFFF12",
                borderRadius: 140,
                right: -42,
                top: -55,
              }}
            />
            <Row
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <Row style={{ gap: 7 }}>
                <View
                  style={{
                    height: 7,
                    width: 7,
                    borderRadius: 4,
                    backgroundColor: working ? "#9EF0BD" : "#CCC8FF",
                  }}
                />
                <T color="#E1DEFF" size={11} weight="medium">
                  {working
                    ? "You’re on the clock"
                    : complete
                      ? "Your day is complete"
                      : "Ready when you are"}
                </T>
              </Row>
              <View
                style={{
                  backgroundColor: "#FFFFFF18",
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Row style={{ gap: 5 }}>
                  <BuildingIcon />
                  <T color="#F1F0FF" size={9}>
                    {schedule?.arrangement === "Remote"
                      ? "Work from home"
                      : "Work from office"}
                  </T>
                </Row>
              </View>
            </Row>
            <Row style={{ alignItems: "baseline", gap: 9, marginTop: 18 }}>
              <T
                size={51}
                color="#FFFFFF"
                weight="semibold"
                style={{
                  letterSpacing: -2,
                  fontVariant: ["tabular-nums"],
                  lineHeight: 62,
                }}
              >
                {time(now)}
              </T>
              <T size={12} color="#C6C2F6">
                WIB
              </T>
            </Row>
            <T color="#D9D6FF" size={11} style={{ marginTop: 2 }}>
              {working
                ? `Checked in at ${time(today?.clockIn)} · ${duration((+now - +new Date(today!.clockIn!)) / 60000)} elapsed`
                : complete
                  ? `${duration(today!.durationMinutes)} worked today. See you next time!`
                  : `${shift?.name || "Regular shift"} · ${time(schedule?.start)} – ${time(schedule?.end)}`}
            </T>
            <View
              style={{
                height: 1,
                backgroundColor: "#FFFFFF20",
                marginVertical: 20,
              }}
            />
            <Row style={{ gap: 15, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 100 }}>
                <Row style={{ gap: 5 }}>
                  <ArrowDownLeft color="#C8C3FF" size={13} />
                  <T size={9} color="#C8C3FF">
                    Clock in
                  </T>
                </Row>
                <T
                  color="#FFFFFF"
                  weight="semibold"
                  size={14}
                  style={{ marginTop: 4 }}
                >
                  {time(today?.clockIn)}
                </T>
              </View>
              <View style={{ flex: 1, minWidth: 70 }}>
                <Row style={{ gap: 5 }}>
                  <ArrowUpRight color="#C8C3FF" size={13} />
                  <T size={9} color="#C8C3FF">
                    Clock out
                  </T>
                </Row>
                <T
                  color="#FFFFFF"
                  weight="semibold"
                  size={14}
                  style={{ marginTop: 4 }}
                >
                  {time(today?.clockOut)}
                </T>
              </View>
              <Button
                label={
                  complete ? "Day complete" : working ? "Clock out" : "Clock in"
                }
                icon={complete ? CheckCheck : Fingerprint}
                variant="white"
                disabled={complete}
                onPress={() => {
                  setFlowType(working ? "out" : "in");
                  setFlow(true);
                }}
                style={{ minWidth: 135, flexGrow: width < 500 ? 1 : 0 }}
              />
            </Row>
          </LinearGradient>
        </View>
        <Card
          style={{
            flex: large ? 1 : undefined,
            padding: 23,
            justifyContent: "space-between",
          }}
        >
          <SectionTitle title="Today’s schedule" />
          <Row style={{ gap: 12, marginBottom: 22 }}>
            <IconBox icon={CalendarDays} />
            <View style={{ flex: 1 }}>
              <T size={13} weight="bold">
                {shift?.name || "Regular shift"}
              </T>
              <T size={10} color={c.muted}>
                A little structure for your day
              </T>
            </View>
            <Badge label="Today" />
          </Row>
          <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
            <View>
              <T size={10} color={c.muted}>
                Start time
              </T>
              <T
                size={22}
                weight="bold"
                style={{ marginTop: 3, letterSpacing: -0.7 }}
              >
                {time(schedule?.start)}
              </T>
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: c.border,
                width: width < 400 ? 15 : 35,
              }}
            />
            <View>
              <T size={10} color={c.muted}>
                End time
              </T>
              <T
                size={22}
                weight="bold"
                style={{ marginTop: 3, letterSpacing: -0.7 }}
              >
                {time(schedule?.end)}
              </T>
            </View>
            <View style={{ width: 1, height: 35, backgroundColor: c.border }} />
            <View>
              <T size={10} color={c.muted}>
                Break
              </T>
              <T size={13} weight="semibold" style={{ marginTop: 7 }}>
                {shift?.breakMinutes || 60} min
              </T>
            </View>
          </Row>
          <View
            style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 17 }}
          >
            <Row>
              <MapPin size={15} color={c.muted} />
              <View style={{ flex: 1 }}>
                <T size={11} weight="semibold">
                  {office.name}
                </T>
                <T size={9} color={c.muted}>
                  SCBD, South Jakarta
                </T>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View full schedule"
                onPress={() => router.push("/schedule")}
              >
                <ChevronRight size={17} color={c.muted} />
              </Pressable>
            </Row>
          </View>
        </Card>
      </View>
      <View>
        <SectionTitle
          title="Your month at a glance"
          action={new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
          }).format(now)}
          onPress={() => router.push("/history")}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {[
            {
              label: "Days present",
              value: String(present).padStart(2, "0"),
              unit: "days",
              icon: CheckCheck,
              color: c.green,
              bg: c.greenBg,
              detail: "Looking good",
              trend: true,
            },
            {
              label: "Late arrivals",
              value: String(late).padStart(2, "0"),
              unit: "days",
              icon: Clock3,
              color: c.amber,
              bg: c.amberBg,
              detail: "Keep finding your rhythm",
            },
            {
              label: "Days absent",
              value: String(absent).padStart(2, "0"),
              unit: "days",
              icon: CalendarDays,
              color: c.red,
              bg: c.redBg,
              detail: absent
                ? "Review your attendance"
                : "Right where you need to be",
            },
            {
              label: "Hours worked",
              value: String(hours),
              unit: "hrs",
              icon: Timer,
              color: c.primaryText,
              bg: c.lavender,
              detail: "Every hour makes a difference",
            },
          ].map((item) => (
            <Card
              key={item.label}
              style={{
                flex: 1,
                minWidth: width < 600 ? "43%" : 170,
                padding: 19,
                borderRadius: 14,
              }}
            >
              <Row style={{ justifyContent: "space-between", gap: 5 }}>
                <T
                  size={12}
                  color={c.muted}
                  weight="medium"
                  style={{ flexShrink: 1 }}
                >
                  {item.label}
                </T>
                <View
                  style={{
                    width: 29,
                    height: 29,
                    borderRadius: 8,
                    backgroundColor: item.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <item.icon size={15} color={item.color} />
                </View>
              </Row>
              <Row style={{ gap: 6, alignItems: "baseline", marginTop: 8 }}>
                <T size={29} weight="bold" style={{ letterSpacing: -1 }}>
                  {item.value}
                </T>
                <T size={10} color={c.muted}>
                  {item.unit}
                </T>
              </Row>
              <T
                size={9}
                color={item.trend ? c.green : c.muted}
                style={{ marginTop: 6 }}
              >
                {item.trend ? "↗  " : ""}
                {item.detail}
              </T>
            </Card>
          ))}
        </View>
      </View>
      <Card
        style={{ paddingVertical: 19, paddingHorizontal: 22, borderRadius: 14 }}
      >
        <View
          style={{
            flexDirection: width >= 700 ? "row" : "column",
            alignItems: width >= 700 ? "center" : undefined,
            gap: 16,
          }}
        >
          <View style={{ minWidth: 125 }}>
            <T weight="bold" size={13}>
              Make it happen
            </T>
            <T size={10} color={c.muted}>
              Your everyday shortcuts
            </T>
          </View>
          <View
            style={{
              width: width >= 700 ? 1 : undefined,
              height: width >= 700 ? 35 : 1,
              backgroundColor: c.border,
            }}
          />
          <Row
            style={{
              flex: 1,
              gap: 10,
              justifyContent: "space-around",
              flexWrap: "wrap",
            }}
          >
            {[
              {
                label: "Request leave",
                icon: Palmtree,
                path: "/requests",
                params: { new: "leave" },
              },
              { label: "My history", icon: History, path: "/history" },
              { label: "View schedule", icon: CalendarDays, path: "/schedule" },
              {
                label: "Fix attendance",
                icon: FilePenLine,
                path: "/requests",
                params: { new: "correction" },
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: item.path as never,
                    params: item.params,
                  })
                }
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: width < 500 ? "40%" : 100,
                  flexDirection: width < 500 ? "row" : "column",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 7,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <item.icon color={c.primaryText} size={19} strokeWidth={1.7} />
                <T size={10} weight="medium">
                  {item.label}
                </T>
              </Pressable>
            ))}
          </Row>
        </View>
      </Card>
      <View style={{ flexDirection: large ? "row" : "column", gap: 22 }}>
        <Card style={{ flex: large ? 1.64 : undefined, padding: 23 }}>
          <SectionTitle
            title="Recent attendance"
            action="View history"
            onPress={() => router.push("/history")}
          />
          <AttendanceRows
            sessions={history.slice(0, 4)}
            compact={width < 500}
          />
        </Card>
        <Card style={{ flex: large ? 1 : undefined, padding: 23 }}>
          <SectionTitle
            title="On the horizon"
            action="View all"
            onPress={() => router.push("/schedule")}
          />
          <View style={{ gap: 21 }}>
            {[
              {
                icon: Palmtree,
                title: "A well-deserved break",
                sub: "Your annual leave is approved",
                badge: "Time off",
                tone: "blue" as const,
                date:
                  db.requests.find(
                    (r) => r.employeeId === employee.id && r.kind === "leave",
                  )?.kind === "leave"
                    ? "Coming up next week"
                    : "Plan your next break",
                bg: c.blueBg,
                color: c.blue,
              },
              {
                icon: Users,
                title: "Friday, a little more social",
                sub: "Team lunch · 12:00–13:00",
                badge: "Company",
                tone: "primary" as const,
                date: "Northstar HQ · The pantry",
                bg: c.lavender,
                color: c.primaryText,
              },
            ].map((item) => (
              <Row
                key={item.title}
                style={{ alignItems: "flex-start", gap: 12 }}
              >
                <IconBox
                  icon={item.icon}
                  bg={item.bg}
                  color={item.color}
                  size={37}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <T size={11} weight="bold">
                    {item.title}
                  </T>
                  <T size={10} color={c.muted}>
                    {item.sub}
                  </T>
                  <T size={9} color={c.muted}>
                    {item.date}
                  </T>
                </View>
              </Row>
            ))}
          </View>
          <View
            style={{
              backgroundColor: c.greenBg,
              borderRadius: 10,
              padding: 12,
              marginTop: 22,
            }}
          >
            <Row style={{ gap: 8 }}>
              <Sparkles size={17} color={c.green} />
              <View style={{ flex: 1 }}>
                <T size={10} weight="semibold" color={c.green}>
                  Good work starts with feeling good.
                </T>
                <T size={9} color={c.green}>
                  Make room for a little you-time, too.
                </T>
              </View>
            </Row>
          </View>
        </Card>
      </View>
      <AttendanceFlow
        visible={flow}
        onClose={() => setFlow(false)}
        type={flowType}
      />
    </View>
  );
}
function BuildingIcon() {
  return <House size={11} color="#EFEDFF" />;
}
export function AttendanceRows({
  sessions,
  compact = false,
  onSelect,
}: {
  sessions: AttendanceSession[];
  compact?: boolean;
  onSelect?: (s: AttendanceSession) => void;
}) {
  const c = useTheme();
  return (
    <View>
      <Row
        style={{
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderColor: c.border,
        }}
      >
        <T color={c.muted} size={9} style={{ flex: 1.4 }}>
          Date
        </T>
        {!compact && (
          <T color={c.muted} size={9} style={{ flex: 1 }}>
            Clock in
          </T>
        )}
        {!compact && (
          <T color={c.muted} size={9} style={{ flex: 1 }}>
            Clock out
          </T>
        )}
        <T color={c.muted} size={9} style={{ flex: 1 }}>
          Work hours
        </T>
        <T color={c.muted} size={9} style={{ width: 67, textAlign: "right" }}>
          Status
        </T>
      </Row>
      {sessions.map((s, i) => (
        <Pressable
          key={s.id}
          accessibilityRole={onSelect ? "button" : undefined}
          onPress={() => onSelect?.(s)}
          style={{
            paddingVertical: 15,
            borderBottomWidth: i < sessions.length - 1 ? 1 : 0,
            borderColor: c.border,
          }}
        >
          <Row>
            <View style={{ flex: 1.4 }}>
              <T size={10} weight="semibold">
                {new Intl.DateTimeFormat("en-GB", {
                  day: "2-digit",
                  month: "short",
                }).format(new Date(s.date + "T12:00:00Z"))}
              </T>
              <T size={8} color={c.muted}>
                {new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(
                  new Date(s.date + "T12:00:00Z"),
                )}
              </T>
            </View>
            {!compact && (
              <T size={11} style={{ flex: 1 }}>
                {time(s.clockIn)}
              </T>
            )}
            {!compact && (
              <T size={11} style={{ flex: 1 }}>
                {time(s.clockOut)}
              </T>
            )}
            <T size={10} style={{ flex: 1 }}>
              {s.clockIn ? duration(s.durationMinutes) : "—"}
            </T>
            <View style={{ width: 67, alignItems: "flex-end" }}>
              <Badge
                label={s.status === "Present" ? "On time" : s.status}
                tone={
                  s.status === "Present"
                    ? "green"
                    : s.status === "Late"
                      ? "amber"
                      : s.status === "Absent"
                        ? "red"
                        : s.status === "Leave"
                          ? "blue"
                          : "neutral"
                }
                dot
              />
            </View>
          </Row>
        </Pressable>
      ))}
    </View>
  );
}
