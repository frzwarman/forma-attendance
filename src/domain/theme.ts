export type ThemeColors = { accent: string; background: string; surface: string; text: string };

// Measured from the Bawaslu key visual and website (see assets/brand/README.md).
export const BAWASLU: ThemeColors = {
  accent: "#ec1c24",
  background: "#00243f",
  surface: "#ffffff",
  text: "#1e1e1e",
};
export const GOLD = "#d1aa67";

export const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
// Opaque mix of two colours: amount 0 gives base, 1 gives tint.
function mix(base: string, tint: string, amount: number) {
  const a = rgb(base);
  const b = rgb(tint);
  return `#${a.map((v, i) => toHex(v + (b[i] - v) * amount)).join("")}`;
}

// WCAG relative luminance of an sRGB colour.
export function relativeLuminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const contrastText = (hex: string): "#ffffff" | "#1e1e1e" =>
  relativeLuminance(hex) < 0.4 ? "#ffffff" : "#1e1e1e";

export type Theme = {
  accent: string;
  onAccent: string;
  accentSoft: string;
  background: string;
  onBackground: string;
  onBackgroundMuted: string;
  surface: string;
  ground: string;
  text: string;
  muted: string;
  border: string;
  inputSurface: string;
  overlay: string;
  gold: string;
  goldSoft: string;
  danger: string;
  success: string;
  shadow: string;
};

export function deriveTheme(colors: ThemeColors): Theme {
  const onBackground = contrastText(colors.background);
  return {
    accent: colors.accent,
    onAccent: contrastText(colors.accent),
    accentSoft: rgba(colors.accent, 0.1),
    background: colors.background,
    onBackground,
    onBackgroundMuted: rgba(onBackground, 0.74),
    surface: colors.surface,
    ground: mix(colors.surface, colors.background, 0.05),
    text: colors.text,
    muted: rgba(colors.text, 0.65),
    border: rgba(colors.background, 0.14),
    inputSurface: rgba(colors.background, 0.04),
    overlay: rgba(colors.background, 0.72),
    gold: GOLD,
    goldSoft: rgba(GOLD, 0.18),
    danger: "#c62828",
    success: "#2e7d32",
    shadow: `0 18px 40px ${rgba(colors.background, 0.18)}`,
  };
}
