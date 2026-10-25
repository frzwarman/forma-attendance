import { useAppDimensions } from "../hooks/useAppDimensions";
import {
  CalendarDays,
  Clock3,
  List,
  MapPin,
  ShieldCheck,
} from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Calendar, statusTone } from "../components/Calendar";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Row,
  SectionTitle,
  Sheet,
  T,
} from "../components/ui";
import { dateKey, duration, time } from "../domain/attendance";
import { useData } from "../services/data";
import { useTheme } from "../theme";
import type { AttendanceSession } from "../types";
import { AttendanceRows, PageHeading } from "./Home";
export default function History() {
  const c = useTheme();
  const { width } = useAppDimensions();
  const { db, employee } = useData();
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const [selected, setSelected] = useState(dateKey());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AttendanceSession>();
  const sessions = db.sessions.filter((s) => s.employeeId === employee.id);
  const current = sessions.find((s) => s.date === selected);
  const filtered = sessions
    .filter(
      (s) =>
        s.date.startsWith(month) &&
        (filter === "All" || s.status === filter) &&
        `${s.date} ${s.status}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const chosen = detail || current;
  const zone = db.locations.find((l) => l.id === chosen?.locationId);
  const detailContent = chosen ? (
    <View style={{ gap: 18 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T size={15} weight="bold">
          {new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date(chosen.date + "T12:00:00Z"))}
        </T>
        <Badge label={chosen.status} tone={statusTone(chosen.status)} />
      </Row>
      <Row
        style={{
          justifyContent: "space-between",
          paddingVertical: 16,
          backgroundColor: c.bg,
          borderRadius: 13,
          paddingHorizontal: 17,
        }}
      >
        <View>
          <T color={c.muted} size={11}>
            Clock in
          </T>
          <T weight="bold" size={23}>
            {time(chosen.clockIn)}
          </T>
        </View>
        <View>
          <T color={c.muted} size={11}>
            Clock out
          </T>
          <T weight="bold" size={23}>
            {time(chosen.clockOut)}
          </T>
        </View>
      </Row>
      {[
        {
          label: "Working duration",
          value: chosen.clockIn ? duration(chosen.durationMinutes) : "—",
          icon: Clock3,
        },
        {
          label: "Scheduled shift",
          value: `${time(chosen.scheduledStart)} – ${time(chosen.scheduledEnd)}`,
          icon: CalendarDays,
        },
        {
          label: "Work location",
          value: zone?.name || "Not recorded",
          icon: MapPin,
        },
        {
          label: "Verification",
          value:
            db.events.find((e) => e.sessionId === chosen.id)?.verification ||
            "Sample attendance record",
          icon: ShieldCheck,
        },
      ].map((item) => (
        <Row key={item.label}>
          <item.icon size={17} color={c.muted} />
          <View style={{ flex: 1 }}>
            <T color={c.muted} size={10}>
              {item.label}
            </T>
            <T size={12} weight="medium">
              {item.value}
            </T>
          </View>
        </Row>
      ))}
      {chosen.lateMinutes > 0 && (
        <T color={c.amber} size={11}>
          Arrived {chosen.lateMinutes} minutes after the grace period.
        </T>
      )}
    </View>
  ) : (
    <Empty
      title="No attendance recorded"
      message="Your attendance will appear here after you clock in."
    />
  );
  return (
    <View style={{ gap: 22 }}>
      <View style={{ marginBottom: -22 }}>
        <PageHeading
          title="Your work, at a glance"
          subtitle="Every day has a story. Here’s yours."
          right={
            <Row>
              <Button
                small
                variant={view === "calendar" ? "primary" : "secondary"}
                label="Calendar"
                icon={CalendarDays}
                onPress={() => setView("calendar")}
              />
              <Button
                small
                variant={view === "list" ? "primary" : "secondary"}
                label="List"
                icon={List}
                onPress={() => setView("list")}
              />
            </Row>
          }
        />
      </View>
      {view === "calendar" && (
        <View
          style={{ flexDirection: width >= 1100 ? "row" : "column", gap: 22 }}
        >
          <Card style={{ flex: width >= 1100 ? 1.4 : undefined }}>
            <Calendar
              month={month}
              onMonth={setMonth}
              selected={selected}
              onSelect={setSelected}
              statuses={Object.fromEntries(
                sessions.map((s) => [s.date, s.status]),
              )}
            />
          </Card>
          <Card style={{ flex: width >= 1100 ? 1 : undefined }}>
            <SectionTitle title="Day details" />
            {detailContent}
          </Card>
        </View>
      )}
      <Card>
        <SectionTitle
          title={`${new Intl.DateTimeFormat("en-GB", { month: "long" }).format(new Date(month + "-15"))} attendance`}
          action={`${filtered.length} records`}
        />
        <View style={{ gap: 14, marginBottom: 18 }}>
          <Field
            label="Search attendance"
            placeholder="Search by date or status…"
            value={search}
            onChangeText={setSearch}
          />
          <Row style={{ flexWrap: "wrap", gap: 7 }}>
            {["All", "Present", "Late", "Absent", "Leave", "Day off"].map(
              (item) => (
                <Button
                  small
                  key={item}
                  variant={filter === item ? "primary" : "secondary"}
                  label={item}
                  onPress={() => setFilter(item)}
                />
              ),
            )}
          </Row>
        </View>
        {filtered.length ? (
          <AttendanceRows
            sessions={view === "list" ? filtered : filtered.slice(0, 7)}
            compact={width < 550}
            onSelect={setDetail}
          />
        ) : (
          <Empty
            title="No matching days"
            message="Try another month or attendance filter."
          />
        )}
      </Card>
      <Sheet
        title="Attendance details"
        visible={!!detail}
        onClose={() => setDetail(undefined)}
      >
        {detailContent}
      </Sheet>
    </View>
  );
}
