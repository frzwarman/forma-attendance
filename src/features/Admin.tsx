import { useRouter } from "expo-router";
import {
  Activity,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FilePenLine,
  MapPin,
  Palmtree,
  Plus,
  Users,
  X,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, Switch, useWindowDimensions, View } from "react-native";
import { Avatar } from "../components/Avatar";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  IconBox,
  Row,
  SectionTitle,
  Sheet,
  T,
} from "../components/ui";
import { dateKey, duration, time } from "../domain/attendance";
import { useData } from "../services/data";
import { repository, uid } from "../services/repository";
import { departments } from "../services/seed";
import { useTheme } from "../theme";
import type { Employee, WorkforceRequest, WorkLocation } from "../types";
import { PageHeading } from "./Home";
import { requestTone } from "./Requests";
export default function Admin({ page }: { page: string }) {
  const { width } = useWindowDimensions();
  const c = useTheme();
  const { db, employee, refresh } = useData();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [status, setStatus] = useState("All");
  const [date, setDate] = useState(dateKey());
  const [person, setPerson] = useState<Employee>();
  const [review, setReview] = useState<{
    request: WorkforceRequest;
    status: "Approved" | "Rejected";
  }>();
  const [location, setLocation] = useState<WorkLocation>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const today = db.sessions.filter((s) => s.date === dateKey());
  const present = today.filter((s) => s.clockIn).length;
  const late = today.filter((s) => s.lateMinutes > 0).length;
  const absent = today.filter((s) => s.status === "Absent").length;
  const leave = today.filter((s) => s.status === "Leave").length;
  const pending = db.requests.filter((r) => r.status === "Pending");
  const employees = db.employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) &&
      (department === "All departments" || e.department === department),
  );
  const sessions = db.sessions.filter(
    (s) =>
      s.date === date &&
      employees.some((e) => e.id === s.employeeId) &&
      (status === "All" || s.status === status),
  );
  const title =
    page === "admin"
      ? "A pulse on your people"
      : page === "employees"
        ? "Good people. One team."
        : page === "monitoring"
          ? "Every workday, in view"
          : page === "approvals"
            ? "A little attention goes a long way"
            : "Places to do great work";
  const subtitle =
    page === "admin"
      ? "A clear view of today, so you can focus on your team."
      : page === "employees"
        ? `${db.employees.length} people making Northstar happen.`
        : page === "monitoring"
          ? "Attendance activity across your organization."
          : page === "approvals"
            ? `${pending.length} requests are waiting for your review.`
            : "Manage the spaces where your team shows up.";
  function filters() {
    return (
      <View style={{ gap: 14, marginBottom: 20 }}>
        <Field
          label="Search employees"
          placeholder="Search by employee name…"
          value={search}
          onChangeText={setSearch}
        />
        <Row style={{ gap: 6, flexWrap: "wrap" }}>
          {["All departments", ...departments].map((d) => (
            <Button
              key={d}
              small
              label={d}
              variant={department === d ? "primary" : "secondary"}
              onPress={() => setDepartment(d)}
            />
          ))}
        </Row>
      </View>
    );
  }
  const attendanceList = (
    <Card>
      <SectionTitle
        title="Attendance activity"
        action={page === "admin" ? "View all" : `${sessions.length} records`}
        onPress={() => router.push("/monitoring")}
      />
      {page === "monitoring" && (
        <>
          {filters()}
          <Field
            label="Attendance date (YYYY-MM-DD)"
            value={date}
            onChangeText={setDate}
          />
          <Row style={{ gap: 6, flexWrap: "wrap", marginVertical: 17 }}>
            {[
              "All",
              "Working",
              "Present",
              "Late",
              "Absent",
              "Leave",
              "Day off",
            ].map((s) => (
              <Button
                key={s}
                small
                label={s}
                variant={s === status ? "primary" : "secondary"}
                onPress={() => setStatus(s)}
              />
            ))}
          </Row>
        </>
      )}
      <Row
        style={{
          paddingBottom: 13,
          borderBottomWidth: 1,
          borderColor: c.border,
        }}
      >
        <T size={9} color={c.muted} style={{ flex: 2 }}>
          Employee
        </T>
        {width >= 750 && (
          <T size={9} color={c.muted} style={{ flex: 1 }}>
            Clock in
          </T>
        )}
        {width >= 1100 && (
          <T size={9} color={c.muted} style={{ flex: 1 }}>
            Clock out
          </T>
        )}
        {width >= 1100 && (
          <T size={9} color={c.muted} style={{ flex: 1 }}>
            Duration
          </T>
        )}
        <T size={9} color={c.muted} style={{ width: 80 }}>
          Status
        </T>
        {width >= 750 && (
          <T size={9} color={c.muted} style={{ width: 110 }}>
            Verification
          </T>
        )}
      </Row>
      {(page === "admin" ? today.slice(0, 6) : sessions).map((s) => {
        const e = db.employees.find((e) => e.id === s.employeeId)!;
        const event = db.events.find((ev) => ev.sessionId === s.id);
        return (
          <Pressable
            key={s.id}
            onPress={() => setPerson(e)}
            accessibilityRole="button"
            style={{
              borderBottomWidth: 1,
              borderColor: c.border,
              paddingVertical: 14,
            }}
          >
            <Row>
              <Row style={{ flex: 2, gap: 9 }}>
                <Avatar employee={e} size={31} radius={10} />
                <View style={{ flex: 1 }}>
                  <T size={10} weight="semibold">
                    {e.name}
                  </T>
                  <T size={8} color={c.muted}>
                    {e.department}
                  </T>
                </View>
              </Row>
              {width >= 750 && (
                <T size={11} style={{ flex: 1 }}>
                  {time(s.clockIn)}
                </T>
              )}
              {width >= 1100 && (
                <T size={11} style={{ flex: 1 }}>
                  {time(s.clockOut)}
                </T>
              )}
              {width >= 1100 && (
                <T size={11} style={{ flex: 1 }}>
                  {s.clockIn ? duration(s.durationMinutes) : "—"}
                </T>
              )}
              <View style={{ width: 80 }}>
                <Badge
                  label={
                    s.status === "Working" && s.lateMinutes > 0
                      ? "Late"
                      : s.status
                  }
                  tone={
                    s.lateMinutes > 0
                      ? "amber"
                      : s.status === "Absent"
                        ? "red"
                        : s.status === "Leave"
                          ? "blue"
                          : s.status === "Day off"
                            ? "neutral"
                            : "green"
                  }
                  dot
                />
              </View>
              {width >= 750 && (
                <View style={{ width: 110 }}>
                  <T size={10} color={c.muted}>
                    {event ? event.verification : "Sample record"}
                  </T>
                </View>
              )}
            </Row>
          </Pressable>
        );
      })}
      {!sessions.length && page === "monitoring" && (
        <Empty
          title="No attendance found"
          message="Try a different date or filter."
        />
      )}
    </Card>
  );
  return (
    <View style={{ gap: 22 }}>
      <View style={{ marginBottom: -22 }}>
        <PageHeading
          title={title}
          subtitle={subtitle}
          right={
            page === "locations" ? (
              <Button
                label="Add location"
                icon={Plus}
                onPress={() =>
                  setLocation({
                    id: uid(),
                    name: "",
                    address: "",
                    latitude: -6.2254,
                    longitude: 106.8098,
                    radius: 150,
                    active: true,
                  })
                }
              />
            ) : (
              <Badge label="HR workspace · Demo" />
            )
          }
        />
      </View>
      {!!feedback && (
        <Card
          style={{ backgroundColor: c.greenBg, padding: 13, borderWidth: 0 }}
        >
          <T color={c.green} size={12}>
            {feedback}
          </T>
        </Card>
      )}
      {page === "admin" && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 13 }}>
            {[
              {
                title: "Total employees",
                value: db.employees.length,
                icon: Users,
                color: c.primaryText,
                bg: c.lavender,
              },
              {
                title: "Present today",
                value: present,
                icon: CheckCheck,
                color: c.green,
                bg: c.greenBg,
              },
              {
                title: "Late arrivals",
                value: late,
                icon: Clock3,
                color: c.amber,
                bg: c.amberBg,
              },
              {
                title: "On leave",
                value: leave,
                icon: Palmtree,
                color: c.blue,
                bg: c.blueBg,
              },
              {
                title: "Absent today",
                value: absent,
                icon: CalendarDays,
                color: c.red,
                bg: c.redBg,
              },
              {
                title: "Currently working",
                value: today.filter((s) => s.clockIn && !s.clockOut).length,
                icon: Activity,
                color: c.primaryText,
                bg: c.lavender,
              },
            ].map((m) => (
              <Card
                key={m.title}
                style={{
                  flex: 1,
                  minWidth: width < 700 ? "42%" : 135,
                  padding: 18,
                }}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <T size={10} color={c.muted}>
                    {m.title}
                  </T>
                  <m.icon size={17} color={m.color} />
                </Row>
                <T size={30} weight="bold" style={{ marginTop: 13 }}>
                  {m.value}
                </T>
                <T size={9} color={c.muted}>
                  Today at Northstar
                </T>
              </Card>
            ))}
          </View>
          <View
            style={{ flexDirection: width >= 1100 ? "row" : "column", gap: 22 }}
          >
            <Card style={{ flex: 1.6 }}>
              <SectionTitle title="The weekly rhythm" action="Last 7 days" />
              <Row style={{ gap: 13, marginBottom: 24 }}>
                <Badge label="Present" tone="primary" />
                <Badge label="Late arrivals" tone="amber" />
              </Row>
              <View
                style={{
                  height: 170,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: 15,
                  paddingHorizontal: 7,
                }}
              >
                {Array.from({ length: 7 }, (_, i) => {
                  const day = new Date(dateKey() + "T12:00:00Z");
                  day.setUTCDate(day.getUTCDate() - 6 + i);
                  const ds = db.sessions.filter(
                    (s) => s.date === day.toISOString().slice(0, 10),
                  );
                  const count = ds.filter((s) => s.clockIn).length;
                  const l = ds.filter((s) => s.lateMinutes > 0).length;
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: "100%",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Row
                        style={{
                          gap: 4,
                          height: 130,
                          alignItems: "flex-end",
                          justifyContent: "center",
                          width: "100%",
                        }}
                      >
                        <View
                          accessibilityLabel={`${count} present`}
                          style={{
                            width: "35%",
                            height: Math.max(
                              4,
                              (count / db.employees.length) * 130,
                            ),
                            backgroundColor: i === 6 ? c.primary : "#B59058",
                            borderTopLeftRadius: 5,
                            borderTopRightRadius: 5,
                          }}
                        />
                        <View
                          accessibilityLabel={`${l} late`}
                          style={{
                            width: "22%",
                            height: Math.max(
                              4,
                              (l / db.employees.length) * 130,
                            ),
                            backgroundColor: "#E8B875",
                            borderTopLeftRadius: 4,
                            borderTopRightRadius: 4,
                          }}
                        />
                      </Row>
                      <T size={9} color={c.muted}>
                        {new Intl.DateTimeFormat("en-GB", {
                          weekday: "short",
                        }).format(day)}
                      </T>
                    </View>
                  );
                })}
              </View>
              <T size={9} color={c.muted} style={{ marginTop: 15 }}>
                Sample attendance across all departments
              </T>
            </Card>
            <Card style={{ flex: 1, gap: 13 }}>
              <SectionTitle title="By department" />
              {departments.map((d) => {
                const all = db.employees.filter((e) => e.department === d);
                const attendance = today.filter(
                  (s) => s.clockIn && all.some((e) => e.id === s.employeeId),
                ).length;
                return (
                  <View key={d} style={{ gap: 7 }}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <T size={10}>{d}</T>
                      <T size={10} color={c.muted}>
                        {attendance}/{all.length}
                      </T>
                    </Row>
                    <View
                      style={{
                        height: 5,
                        borderRadius: 4,
                        backgroundColor: c.subtle,
                      }}
                    >
                      <View
                        style={{
                          height: 5,
                          borderRadius: 4,
                          backgroundColor: c.primary,
                          width: `${(attendance / all.length) * 100}%`,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
          <Card
            style={{ backgroundColor: c.lavender, borderWidth: 0, padding: 20 }}
          >
            <Row style={{ flexWrap: "wrap" }}>
              <IconBox icon={ClipboardCheck} bg={c.surface} />
              <View style={{ flex: 1, minWidth: 130 }}>
                <T size={13} weight="bold">
                  A few things need your attention
                </T>
                <T size={11} color={c.muted}>
                  {pending.length} requests awaiting review. Help your team plan
                  ahead.
                </T>
              </View>
              <Button
                small
                label="Review requests"
                onPress={() => router.push("/approvals")}
              />
            </Row>
          </Card>
          {attendanceList}
        </>
      )}
      {page === "employees" && (
        <Card>
          {filters()}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 15 }}>
            {employees.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => setPerson(e)}
                accessibilityRole="button"
                style={{
                  flexGrow: 1,
                  width: width >= 1100 ? "30%" : width >= 650 ? "45%" : "100%",
                  padding: 20,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 15,
                  gap: 12,
                }}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <Avatar employee={e} size={46} radius={16} />
                  <Badge label={e.department} tone="neutral" />
                </Row>
                <View>
                  <T size={14} weight="bold">
                    {e.name}
                  </T>
                  <T size={11} color={c.muted}>
                    {e.title}
                  </T>
                </View>
                <T size={10} color={c.muted}>
                  {e.email}
                </T>
                <Row style={{ justifyContent: "space-between" }}>
                  <Badge label={e.status} tone="green" />
                  <ChevronRight size={16} color={c.muted} />
                </Row>
              </Pressable>
            ))}
          </View>
          {!employees.length && (
            <Empty
              title="No one found"
              message="Try a different name or department."
            />
          )}
        </Card>
      )}
      {page === "monitoring" && attendanceList}
      {page === "approvals" && (
        <Card>
          <Row style={{ gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
            {["All", "Pending", "Approved", "Rejected"].map((v) => (
              <Button
                key={v}
                small
                label={v}
                variant={status === v ? "primary" : "secondary"}
                onPress={() => setStatus(v)}
              />
            ))}
          </Row>
          {db.requests
            .filter((r) => status === "All" || r.status === status)
            .map((r, i) => {
              const e = db.employees.find((e) => e.id === r.employeeId)!;
              return (
                <View
                  key={r.id}
                  style={{
                    paddingVertical: 20,
                    borderTopWidth: i ? 1 : 0,
                    borderColor: c.border,
                    gap: 15,
                  }}
                >
                  <Row style={{ justifyContent: "space-between" }}>
                    <Row>
                      <Avatar employee={e} size={37} radius={12} />
                      <View>
                        <T size={12} weight="bold">
                          {e.name}
                        </T>
                        <T color={c.muted} size={10}>
                          {e.department}
                        </T>
                      </View>
                    </Row>
                    <Badge label={r.status} tone={requestTone(r.status)} />
                  </Row>
                  <Row>
                    <IconBox
                      icon={r.kind === "leave" ? Palmtree : FilePenLine}
                      size={36}
                    />
                    <View style={{ flex: 1 }}>
                      <T size={12} weight="semibold">
                        {r.type}
                      </T>
                      <T size={10} color={c.muted}>
                        {r.kind === "leave"
                          ? `${r.start} – ${r.end} · ${r.days} working days`
                          : `${r.date} · ${r.time}`}
                      </T>
                    </View>
                  </Row>
                  <T size={12} color={c.muted}>
                    {r.reason}
                  </T>
                  {r.status === "Pending" && (
                    <Row>
                      <Button
                        small
                        icon={Check}
                        label="Approve"
                        onPress={() => {
                          setError("");
                          setReview({ request: r, status: "Approved" });
                        }}
                      />
                      <Button
                        small
                        variant="danger"
                        icon={X}
                        label="Reject"
                        onPress={() => {
                          setError("");
                          setReview({ request: r, status: "Rejected" });
                        }}
                      />
                    </Row>
                  )}
                </View>
              );
            })}
          {!db.requests.some(
            (r) => status === "All" || r.status === status,
          ) && (
            <Empty
              title="All clear"
              message="There are no requests in this category."
            />
          )}
        </Card>
      )}
      {page === "locations" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
          {db.locations.map((l) => (
            <Card
              key={l.id}
              style={{ flex: 1, minWidth: width > 700 ? 300 : "100%", gap: 20 }}
            >
              <View
                style={{
                  height: 165,
                  backgroundColor: c.greenBg,
                  borderRadius: 13,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    width: 300,
                    height: 20,
                    backgroundColor: c.surface,
                    transform: [{ rotate: "-35deg" }],
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    width: 300,
                    height: 17,
                    backgroundColor: c.surface,
                    transform: [{ rotate: "35deg" }],
                  }}
                />
                <View
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: 60,
                    backgroundColor: c.lavender,
                    borderWidth: 1,
                    borderColor: c.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconBox
                    icon={MapPin}
                    bg={c.primary}
                    color={c.white}
                    size={42}
                  />
                </View>
                <View style={{ position: "absolute", bottom: 8, right: 9 }}>
                  <Badge label="Illustrative preview" tone="neutral" />
                </View>
              </View>
              <Row style={{ justifyContent: "space-between" }}>
                <T size={16} weight="bold">
                  {l.name}
                </T>
                <Badge
                  label={l.active ? "Active" : "Inactive"}
                  tone={l.active ? "green" : "neutral"}
                  dot
                />
              </Row>
              <T size={11} color={c.muted}>
                {l.address}
              </T>
              <Row style={{ justifyContent: "space-between" }}>
                <T size={11}>
                  {l.latitude.toFixed(4)}, {l.longitude.toFixed(4)}
                </T>
                <Badge label={`${l.radius} m radius`} />
              </Row>
              <Button
                variant="secondary"
                label="Manage location"
                onPress={() => {
                  setError("");
                  setLocation({ ...l });
                }}
              />
            </Card>
          ))}
        </View>
      )}
      <Sheet
        visible={!!person}
        title="Employee overview"
        onClose={() => setPerson(undefined)}
        wide
      >
        {person && (
          <View style={{ gap: 20 }}>
            <Row>
              <Avatar employee={person} size={62} radius={20} />
              <View>
                <T size={21} weight="bold">
                  {person.name}
                </T>
                <T size={12} color={c.muted}>
                  {person.title} · {person.department}
                </T>
              </View>
            </Row>
            <Badge label={person.status} tone="green" />
            <T size={12} color={c.muted}>
              {person.email}
            </T>
            <SectionTitle title="Assigned schedule" />
            {db.schedules
              .filter((s) => s.employeeId === person.id && s.date >= dateKey())
              .slice(0, 3)
              .map((s) => (
                <Row key={s.id} style={{ justifyContent: "space-between" }}>
                  <T size={11}>{s.date}</T>
                  <T size={11}>
                    {s.dayOff
                      ? "Rest day"
                      : `${time(s.start)} – ${time(s.end)}`}
                  </T>
                  <Badge label={s.arrangement} />
                </Row>
              ))}
            <SectionTitle title="Recent attendance" />
            {db.sessions
              .filter((s) => s.employeeId === person.id)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map((s) => (
                <Row key={s.id} style={{ justifyContent: "space-between" }}>
                  <T size={11}>{s.date}</T>
                  <T size={11}>
                    {time(s.clockIn)} – {time(s.clockOut)}
                  </T>
                  <Badge
                    label={s.status}
                    tone={
                      s.lateMinutes
                        ? "amber"
                        : s.status === "Absent"
                          ? "red"
                          : "green"
                    }
                  />
                </Row>
              ))}
          </View>
        )}
      </Sheet>
      <Sheet
        visible={!!review}
        title={`${review?.status === "Approved" ? "Approve" : "Reject"} this request?`}
        onClose={() => setReview(undefined)}
      >
        <T color={c.muted}>
          {review?.request.type} ·{" "}
          {db.employees.find((e) => e.id === review?.request.employeeId)?.name}
        </T>
        <T size={12}>
          The employee will see the decision in their request history and
          notifications. Demo approvals record a decision; payroll and schedule
          updates require backend integration.
        </T>
        {!!error && <T color={c.red}>{error}</T>}
        <Button
          label={
            review?.status === "Approved"
              ? "Confirm approval"
              : "Confirm rejection"
          }
          variant={review?.status === "Approved" ? "primary" : "danger"}
          loading={busy}
          onPress={async () => {
            if (!review) return;
            setBusy(true);
            try {
              await repository.reviewRequest(
                review.request.id,
                review.status,
                employee.id,
              );
              await refresh();
              setFeedback(
                `Request ${review.status.toLowerCase()}. The employee has been notified.`,
              );
              setReview(undefined);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button
          label="Go back"
          variant="ghost"
          onPress={() => setReview(undefined)}
        />
      </Sheet>
      <Sheet
        visible={!!location}
        title="Office attendance zone"
        onClose={() => setLocation(undefined)}
      >
        {location && (
          <View style={{ gap: 16 }}>
            <Field
              label="Office name"
              value={location.name}
              onChangeText={(name) => setLocation({ ...location, name })}
            />
            <Field
              label="Address"
              value={location.address}
              onChangeText={(address) => setLocation({ ...location, address })}
            />
            <Field
              label="Latitude"
              value={String(location.latitude)}
              onChangeText={(v) =>
                setLocation({ ...location, latitude: Number(v) })
              }
              keyboardType="numbers-and-punctuation"
            />
            <Field
              label="Longitude"
              value={String(location.longitude)}
              onChangeText={(v) =>
                setLocation({ ...location, longitude: Number(v) })
              }
              keyboardType="numbers-and-punctuation"
            />
            <Field
              label="Allowed radius (meters)"
              value={String(location.radius)}
              onChangeText={(v) =>
                setLocation({ ...location, radius: Number(v) })
              }
              keyboardType="numeric"
            />
            <Row style={{ justifyContent: "space-between" }}>
              <T size={12}>Active attendance zone</T>
              <Switch
                accessibilityLabel="Active attendance zone"
                value={location.active}
                onValueChange={(active) => setLocation({ ...location, active })}
                trackColor={{ true: c.primary, false: c.border }}
              />
            </Row>
            {!!error && (
              <T color={c.red} size={12}>
                {error}
              </T>
            )}
            <Button
              label="Save location"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  await repository.saveLocation(location);
                  await refresh();
                  setLocation(undefined);
                  setFeedback("Office location saved.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        )}
      </Sheet>
    </View>
  );
}
