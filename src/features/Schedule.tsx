import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Coffee,
  MapPin,
  Moon,
  Sun,
} from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  type ScrollViewInstance,
} from "react-native";
import { Calendar } from "../components/Calendar";
import {
  Badge,
  Card,
  IconBox,
  IconButton,
  Row,
  SectionTitle,
  T,
} from "../components/ui";
import { dateKey, time } from "../domain/attendance";
import { useAppDimensions } from "../hooks/useAppDimensions";
import { useData } from "../services/data";
import { useTheme } from "../theme";
import { PageHeading } from "./Home";

export default function Schedule() {
  const c = useTheme();
  const { db, employee } = useData();
  const { width } = useAppDimensions();
  const [selected, setSelected] = useState(dateKey());
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const [weekOffset, setWeekOffset] = useState(0);
  const [showMonth, setShowMonth] = useState(false);
  const weekScroll = useRef<ScrollViewInstance>(null);
  const schedules = db.schedules.filter((s) => s.employeeId === employee.id);
  const schedule = schedules.find((s) => s.date === selected);
  const shift = db.shifts.find((s) => s.id === schedule?.shiftId);
  const office = db.locations.find((l) => l.id === schedule?.locationId);
  const base = new Date(dateKey() + "T12:00:00Z");
  base.setUTCDate(
    base.getUTCDate() - ((base.getUTCDay() + 6) % 7) + weekOffset * 7,
  );
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const selectedLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(selected + "T12:00:00Z"));
  const weekLabel = `${Number(week[0].slice(-2))}–${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(week[6] + "T12:00:00Z"))}`;
  function today() {
    setWeekOffset(0);
    setSelected(dateKey());
    setMonth(dateKey().slice(0, 7));
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={{ marginBottom: -26 }}>
        <PageHeading
          title="Find your rhythm"
          subtitle="Your day, with a little more clarity."
        />
      </View>
      <Card testID="schedule-plan-card" style={{ padding: 20, gap: 18 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <T size={17} weight="bold">
            {selected === dateKey() ? "Today’s plan" : selectedLabel}
          </T>
          <Badge label={selectedLabel} tone="neutral" />
        </Row>
        <Row style={{ gap: 12 }}>
          <IconBox
            icon={
              schedule?.dayOff ? Coffee : shift?.type === "Night" ? Moon : Sun
            }
            size={44}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={18} weight="bold">
              {schedule?.dayOff
                ? "A little time for you"
                : shift?.name || "No shift scheduled"}
            </T>
            <T size={12} color={c.muted}>
              {schedule?.dayOff
                ? "Rest, recharge, repeat."
                : schedule
                  ? "All set for your workday"
                  : "Check another date for your next shift."}
            </T>
          </View>
        </Row>
        {schedule && !schedule.dayOff && (
          <>
            <View
              style={{ backgroundColor: c.bg, borderRadius: 13, padding: 16 }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <T size={11} color={c.muted}>
                    Starts at
                  </T>
                  <T size={27} weight="bold" style={{ letterSpacing: -0.8 }}>
                    {time(schedule.start)}
                  </T>
                </View>
                <ChevronRight size={18} color={c.muted} />
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <T size={11} color={c.muted}>
                    Ends at
                  </T>
                  <T size={27} weight="bold" style={{ letterSpacing: -0.8 }}>
                    {time(schedule.end)}
                  </T>
                </View>
              </Row>
            </View>
            <Badge
              label={`Work from ${schedule.arrangement === "Remote" ? "home" : schedule.arrangement.toLowerCase()}`}
            />
            <Row style={{ alignItems: "flex-start", gap: 16 }}>
              {[
                {
                  label: "Break",
                  value: `${shift?.breakMinutes} min`,
                  icon: Coffee,
                },
                {
                  label: "Grace period",
                  value: `${shift?.graceMinutes} min`,
                  icon: Clock3,
                },
              ].map((item) => (
                <Row
                  key={item.label}
                  style={{ flex: 1, alignItems: "flex-start", gap: 8 }}
                >
                  <item.icon color={c.muted} size={17} />
                  <View style={{ flex: 1 }}>
                    <T size={11} color={c.muted}>
                      {item.label}
                    </T>
                    <T size={14} weight="semibold">
                      {item.value}
                    </T>
                  </View>
                </Row>
              ))}
            </Row>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <Row style={{ alignItems: "flex-start" }}>
              <MapPin size={18} color={c.primaryText} />
              <View style={{ flex: 1 }}>
                <T size={13} weight="semibold">
                  {schedule.arrangement === "Remote"
                    ? "Your home workspace"
                    : office?.name || "Assigned work location"}
                </T>
                <T size={11} color={c.muted}>
                  Asia/Jakarta · GMT+7
                </T>
              </View>
            </Row>
          </>
        )}
      </Card>
      <Card testID="schedule-week-card" style={{ padding: 20 }}>
        <SectionTitle
          title="Your week"
          action="Back to today"
          onPress={today}
        />
        <Row style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <IconButton
            icon={ChevronLeft}
            label="Previous week"
            onPress={() => setWeekOffset((v) => v - 1)}
          />
          <T size={14} weight="semibold">
            {weekLabel}
          </T>
          <IconButton
            icon={ChevronRight}
            label="Next week"
            onPress={() => setWeekOffset((v) => v + 1)}
          />
        </Row>
        <ScrollView
          horizontal
          ref={weekScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7 }}
          onContentSizeChange={() => {
            const index = week.indexOf(selected);
            if (index >= 0)
              weekScroll.current?.scrollTo({
                x: Math.max(0, index * 55 - (width - 104) / 2),
                animated: false,
              });
          }}
        >
          {week.map((date) => {
            const s = schedules.find((s) => s.date === date);
            const active = date === selected;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={`Select ${date}`}
                accessibilityState={{ selected: active }}
                aria-pressed={active}
                onPress={() => {
                  setSelected(date);
                  setMonth(date.slice(0, 7));
                }}
                style={{
                  width: 48,
                  minHeight: 86,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: active ? c.primary : c.bg,
                }}
              >
                <T size={11} color={active ? c.white : c.muted}>
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "short",
                  }).format(new Date(date + "T12:00:00Z"))}
                </T>
                <T size={20} weight="bold" color={active ? c.white : c.text}>
                  {Number(date.slice(-2))}
                </T>
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 3,
                    backgroundColor: active
                      ? c.white
                      : s?.dayOff
                        ? c.muted
                        : c.primary,
                  }}
                />
              </Pressable>
            );
          })}
        </ScrollView>
        <T size={11} color={c.muted} style={{ marginTop: 14 }}>
          Swipe the dates to see your week. Tap a day for its plan.
        </T>
      </Card>
      <Card testID="schedule-month-card" style={{ padding: 20, gap: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showMonth ? "Hide month overview" : "Show month overview"
          }
          accessibilityState={{ expanded: showMonth }}
          onPress={() => setShowMonth((v) => !v)}
          style={{ minHeight: 44 }}
        >
          <Row style={{ justifyContent: "space-between", flex: 1 }}>
            <Row>
              <CalendarDays size={19} color={c.primaryText} />
              <T size={16} weight="bold">
                Month overview
              </T>
            </Row>
            {showMonth ? (
              <ChevronUp size={18} color={c.muted} />
            ) : (
              <ChevronDown size={18} color={c.muted} />
            )}
          </Row>
        </Pressable>
        {showMonth && (
          <Calendar
            month={month}
            onMonth={setMonth}
            selected={selected}
            onSelect={setSelected}
            statuses={Object.fromEntries(
              schedules.map((s) => [s.date, s.dayOff ? "Day off" : "Present"]),
            )}
          />
        )}
      </Card>
    </View>
  );
}
