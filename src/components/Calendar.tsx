import { ChevronLeft,ChevronRight } from "lucide-react-native";
import { Pressable,View } from "react-native";
import { dateKey } from "../domain/attendance";
import { useTheme } from "../theme";
import type { AttendanceStatus } from "../types";
import { IconButton,Row,T } from "./ui";
export const statusTone = (status: string) =>
  status === "Present" || status === "Working"
    ? "green"
    : status === "Late"
      ? "amber"
      : status === "Absent"
        ? "red"
        : status === "Leave"
          ? "blue"
          : "neutral";
export function Calendar({
  month,
  onMonth,
  selected,
  onSelect,
  statuses = {},
}: {
  month: string;
  onMonth: (m: string) => void;
  selected: string;
  onSelect: (d: string) => void;
  statuses?: Record<string, AttendanceStatus>;
}) {
  const c = useTheme();
  const [year, mo] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, mo - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  const cells = Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, i) => i - offset + 1,
  );
  function move(delta: number) {
    const d = new Date(Date.UTC(year, mo - 1 + delta, 1));
    onMonth(d.toISOString().slice(0, 7));
  }
  return (
    <View style={{ gap: 18 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T weight="bold" size={17}>
          {new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
          }).format(new Date(month + "-15T12:00:00Z"))}
        </T>
        <Row>
          <IconButton
            icon={ChevronLeft}
            label="Previous month"
            onPress={() => move(-1)}
          />
          <IconButton
            icon={ChevronRight}
            label="Next month"
            onPress={() => move(1)}
          />
        </Row>
      </Row>
      <Row style={{ gap: 0 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <T
            key={d}
            size={10}
            color={c.muted}
            style={{ width: "14.2857%", textAlign: "center" }}
          >
            {d}
          </T>
        ))}
      </Row>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((day, i) => {
          const valid = day > 0 && day <= days;
          const date = month + "-" + String(day).padStart(2, "0");
          const tone = statusTone(statuses[date]);
          const color = tone === "neutral" ? c.muted : c[tone];
          const active = date === selected;
          return (
            <Pressable
              key={i}
              disabled={!valid}
              accessibilityRole="button"
              accessibilityLabel={
                valid
                  ? `${date}${statuses[date] ? ", " + statuses[date] : ""}`
                  : ""
              }
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(date)}
              style={{
                width: "14.2857%",
                height: 57,
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                backgroundColor: active ? c.primary : "transparent",
                borderRadius: 11,
                borderWidth: date === dateKey() && !active ? 1 : 0,
                borderColor: c.primary,
              }}
            >
              <T
                size={12}
                weight={active ? "bold" : "medium"}
                color={active ? c.onPrimary : c.text}
              >
                {valid ? day : ""}
              </T>
              <View
                style={{
                  height: 4,
                  width: 4,
                  borderRadius: 2,
                  backgroundColor:
                    valid && statuses[date]
                      ? active
                        ? c.onPrimary
                        : color
                      : "transparent",
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <Row
        style={{
          gap: 12,
          flexWrap: "wrap",
          borderTopWidth: 1,
          borderColor: c.border,
          paddingTop: 18,
        }}
      >
        {["Present", "Late", "Absent", "Leave", "Day off"].map((status) => {
          const tone = statusTone(status);
          return (
            <Row key={status} style={{ gap: 4 }}>
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: tone === "neutral" ? c.muted : c[tone],
                }}
              />
              <T size={9} color={c.muted}>
                {status}
              </T>
            </Row>
          );
        })}
      </Row>
    </View>
  );
}
