import { labelSize, segmentColor, SPIN_MS, wheelLabel } from "../../domain/wheel";
import { FONT_STACK, useTheme } from "../../theme";

const R = 480;
// A point at this radius, the angle clockwise from 12 o'clock: the viewBox is centred and y grows downward.
const at = (angle: number, r: number) => `${(r * Math.sin(angle)).toFixed(1)} ${(-r * Math.cos(angle)).toFixed(1)}`;

function segmentPath(i: number, n: number) {
  if (n === 1) return `M 0 ${-R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 ${-R} Z`;
  const step = (2 * Math.PI) / n;
  return `M 0 0 L ${at(i * step, R)} A ${R} ${R} 0 0 1 ${at((i + 1) * step, R)} Z`;
}

// The wheel in the stage: segments in position order clockwise from the top, the pointer over the rim
// and Putar in the hub. The page owns the rotation and says when the turn (SPIN_MS) is on; onSpun fires
// when the transition ends. The square follows the stage's container units.
export function Wheel({
  names,
  rotation,
  spinning,
  onSpun,
  label,
  disabled,
  onPress,
}: {
  names: string[];
  rotation: number;
  spinning: boolean;
  onSpun: () => void;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const n = names.length;
  const size = labelSize(n, Math.max(0, ...names.map((name) => name.length)));
  return (
    <div style={{ position: "relative", width: "min(84cqh, 84cqw)", aspectRatio: "1" }}>
      <svg
        data-testid="wheel"
        viewBox="-500 -500 1000 1000"
        onTransitionEnd={(event) => event.propertyName === "transform" && onSpun()}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0, 0.08, 1)` : "none",
          willChange: "transform",
        }}
      >
        {n === 0 && <circle r={R} fill="rgba(255, 255, 255, 0.08)" />}
        {names.map((name, i) => (
          <g key={i}>
            <path data-testid="wheel-segment" d={segmentPath(i, n)} fill={segmentColor(i, n)} stroke="#ffffff" strokeWidth={n > 120 ? 0 : 2} />
            {size > 0 && (
              <text
                data-testid="wheel-label"
                transform={`rotate(${((i + 0.5) * 360) / n - 90})`}
                x={0.94 * R}
                y={0}
                textAnchor="end"
                dominantBaseline="central"
                fill="#ffffff"
                fontWeight={700}
                fontSize={size}
              >
                {wheelLabel(name, size)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <svg
        data-testid="wheel-pointer"
        aria-hidden
        viewBox="0 0 40 48"
        style={{
          position: "absolute",
          top: "-3%",
          left: "50%",
          width: "9%",
          transform: "translateX(-50%)",
          filter: "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5))",
        }}
      >
        <path d="M2 2h36L20 46z" fill="#ffffff" />
      </svg>
      {/* Gone while the wheel turns: the eye stays on the pointer. */}
      {!spinning && (
        <button
          type="button"
          disabled={disabled}
          onClick={onPress}
          style={{
            position: "absolute",
            left: "41%",
            top: "41%",
            width: "18%",
            height: "18%",
            padding: 0,
            borderRadius: 999,
            border: "0.4cqw solid #ffffff",
            backgroundColor: c.accent,
            color: c.onAccent,
            fontFamily: FONT_STACK,
            fontSize: "max(14px, 2cqw)",
            fontWeight: 800,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {label}
        </button>
      )}
    </div>
  );
}
