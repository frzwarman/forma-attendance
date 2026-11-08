import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { Row, T } from "../../components/ui";
import { FONT_STACK, useTheme } from "../../theme";

// Laporan's charts: plain SVG and HTML, one ink (navy) for the data, the brand red only on "the answer"
// (the peak, the leading option). Every mark can be hovered or focused for its exact numbers, and the
// numbers also stand beside the marks, so nothing is read from colour alone.

export type Point = { label: string; value: number; detail: string };

const num = (n: number) => n.toLocaleString("id-ID");

// Columns in order (days, hours, sessions); the tallest is marked as the peak.
export function ColumnChart({ points, testID, peakLabel = "Puncak", emptyText = "Belum ada data." }: { points: Point[]; testID?: string; peakLabel?: string; emptyText?: string }) {
  const c = useTheme();
  const [active, setActive] = useState<number>();
  const [width, setWidth] = useState(0);
  if (points.length === 0) return <T color={c.muted}>{emptyText}</T>;
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));
  const peak = points.findIndex((p) => p.value === max);
  // Drawn at the card's own width, one unit per pixel, so text and bars keep their size whatever the count.
  const W = Math.max(240, width);
  const H = 180;
  const top = 28;
  const bottom = 26;
  const plot = H - top - bottom;
  const slot = W / n;
  const bar = Math.min(28, slot * 0.62);
  // Not every label fits under narrow columns: every k-th, the peak's always.
  const every = Math.ceil(n / 9);
  const shown = active ?? peak;
  const current = points[shown];
  return (
    <View style={{ gap: 8 }} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
      <div style={{ position: "relative", visibility: width ? "visible" : "hidden" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${points.map((p) => `${p.label}: ${num(p.value)}`).join("; ")}`} style={{ display: "block", maxWidth: "100%", fontFamily: FONT_STACK }} onMouseLeave={() => setActive(undefined)}>
          {[0.5, 1].map((f) => (
            <line key={f} x1={0} x2={W} y1={top + plot - plot * f} y2={top + plot - plot * f} stroke={c.border} strokeWidth={1} />
          ))}
          <line x1={0} x2={W} y1={top + plot} y2={top + plot} stroke={c.muted} strokeWidth={1} />
          {points.map((p, i) => {
            const h = Math.max(p.value ? 3 : 0, (p.value / max) * plot);
            const x = i * slot + (slot - bar) / 2;
            const y = top + plot - h;
            const isPeak = i === peak;
            const isActive = i === shown;
            return (
              <g
                key={i}
                data-testid={testID}
                tabIndex={0}
                role="img"
                aria-label={`${p.label}: ${p.detail}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(undefined)}
                style={{ outline: "none", cursor: "default" }}
              >
                <rect x={i * slot} y={top} width={slot} height={plot} fill={isActive ? c.inputSurface : "transparent"} />
                <rect x={x} y={y} width={bar} height={h} rx={4} fill={isPeak ? c.accent : c.background} opacity={isActive || isPeak ? 1 : 0.82} />
                {(isPeak || n <= 12) && p.value > 0 && (
                  <text x={x + bar / 2} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill={c.text}>
                    {num(p.value)}
                  </text>
                )}
                {(i % every === 0 || isPeak) && (
                  <text x={i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={c.muted}>
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <Row style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }} testID={testID ? `${testID}-tooltip` : undefined}>
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: shown === peak ? c.accent : c.background }} />
        <T size={13} weight="semibold">
          {current.label}
        </T>
        <T size={13} color={c.muted}>
          {current.detail}
          {shown === peak ? ` (${peakLabel})` : ""}
        </T>
      </Row>
    </View>
  );
}

// Share of a whole for up to four slices: the leading slice in red, the rest in navy steps, the legend
// carrying the numbers.
export function Donut({ slices, total, testID }: { slices: { label: string; value: number }[]; total: number; testID?: string }) {
  const c = useTheme();
  const [active, setActive] = useState<number>();
  const sum = Math.max(1, total);
  const lead = slices.reduce((best, s, i) => (s.value > slices[best].value ? i : best), 0);
  const inks = [c.background, "rgba(0, 36, 63, 0.62)", "rgba(0, 36, 63, 0.38)", "rgba(0, 36, 63, 0.2)"];
  const R = 54;
  const CIRC = 2 * Math.PI * R;
  // Where each slice starts along the ring.
  const offsets = slices.reduce<number[]>((acc, s, i) => [...acc, (acc[i - 1] ?? 0) + (i ? (slices[i - 1].value / sum) * CIRC : 0)], []);
  return (
    <Row style={{ gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 140 140" width={150} height={150} role="img" aria-label={slices.map((s) => `${s.label}: ${num(s.value)}`).join("; ")} style={{ flexShrink: 0 }} onMouseLeave={() => setActive(undefined)}>
        <circle cx={70} cy={70} r={R} fill="none" stroke={c.inputSurface} strokeWidth={18} />
        {slices.map((s, i) => {
          const length = (s.value / sum) * CIRC;
          // A 2px gap between slices, drawn as a shorter dash.
          const dash = Math.max(0, length - 2);
          return (
            <circle
              key={i}
              data-testid={testID}
              tabIndex={0}
              role="img"
              aria-label={`${s.label}: ${num(s.value)} (${Math.round((s.value * 100) / sum)}%)`}
              cx={70}
              cy={70}
              r={R}
              fill="none"
              stroke={i === lead ? c.accent : inks[Math.min(i, inks.length - 1)]}
              strokeWidth={active === i ? 22 : 18}
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={-offsets[i]}
              transform="rotate(-90 70 70)"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(undefined)}
              style={{ outline: "none", transition: "stroke-width 150ms" }}
            />
          );
        })}
        <text x={70} y={66} textAnchor="middle" fontSize={22} fontWeight={800} fill={c.text} fontFamily={FONT_STACK}>
          {num(active === undefined ? total : slices[active].value)}
        </text>
        <text x={70} y={84} textAnchor="middle" fontSize={11} fill={c.muted} fontFamily={FONT_STACK}>
          {active === undefined ? "suara" : `${Math.round((slices[active].value * 100) / sum)}%`}
        </text>
      </svg>
      <View style={{ flex: 1, minWidth: 180, gap: 8 }}>
        {slices.map((s, i) => (
          <Row key={i} style={{ gap: 10, alignItems: "center", opacity: active === undefined || active === i ? 1 : 0.5 }}>
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: i === lead ? c.accent : inks[Math.min(i, inks.length - 1)] }} />
            <T size={14} weight={i === lead ? "bold" : "medium"} style={{ flex: 1 }} numberOfLines={2}>
              {s.label}
            </T>
            <T size={14} weight="bold">
              {num(s.value)}
            </T>
            <T size={13} color={c.muted} style={{ minWidth: 40, textAlign: "right" }}>
              {Math.round((s.value * 100) / sum)}%
            </T>
          </Row>
        ))}
      </View>
    </Row>
  );
}

// Horizontal bars, one series, the value beside each label. With onSelect the rows are buttons that
// filter the report; the selected one is marked.
export function HBars({
  items,
  max,
  testID,
  selected,
  onSelect,
  trailing,
}: {
  items: { key: string; label: string; value: number; note?: string }[];
  max?: number;
  testID?: string;
  selected?: string;
  onSelect?: (key: string) => void;
  trailing?: (key: string) => ReactNode;
}) {
  const c = useTheme();
  const top = Math.max(1, max ?? Math.max(0, ...items.map((item) => item.value)));
  return (
    <View style={{ gap: 6 }}>
      {items.map((item) => {
        const isSelected = selected === item.key;
        const body = (
          <View style={{ gap: 4, paddingVertical: 4 }}>
            <Row style={{ justifyContent: "space-between", gap: 12 }}>
              <T size={14} weight={isSelected ? "bold" : "semibold"} numberOfLines={1} style={{ flex: 1 }}>
                {item.label}
              </T>
              <T size={14} weight="bold">
                {num(item.value)}
                {!!item.note && (
                  <T size={13} color={c.muted}>
                    {" "}
                    {item.note}
                  </T>
                )}
              </T>
              {trailing?.(item.key)}
            </Row>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: c.inputSurface, overflow: "hidden" }}>
              <View style={{ width: `${(item.value / top) * 100}%`, height: "100%", borderRadius: 999, backgroundColor: isSelected ? c.accent : c.background }} />
            </View>
          </View>
        );
        if (!onSelect) return <View key={item.key} testID={testID}>{body}</View>;
        return (
          <button
            key={item.key}
            type="button"
            data-testid={testID}
            aria-pressed={isSelected}
            onClick={() => onSelect(item.key)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "2px 8px",
              margin: "0 -8px",
              border: "none",
              borderRadius: 10,
              backgroundColor: isSelected ? c.accentSoft : "transparent",
              cursor: "pointer",
              fontFamily: FONT_STACK,
            }}
          >
            {body}
          </button>
        );
      })}
    </View>
  );
}
