import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Platform } from "react-native";
import { BAWASLU, deriveTheme, type Theme, type ThemeColors } from "../domain/theme";

const Context = createContext<Theme>(deriveTheme(BAWASLU));

// Four admin-chosen colours; every other token is derived (see domain/theme.ts).
export function ThemeProvider({ colors, children }: { colors: ThemeColors; children: ReactNode }) {
  const theme = useMemo(() => deriveTheme(colors), [colors]);
  return <Context.Provider value={theme}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);

// Plus Jakarta Sans (Tokotype, Jakarta) with system fallbacks until it loads.
export const FONT_STACK = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const family = Platform.OS === "web" ? FONT_STACK : "sans-serif";
export const fonts = {
  regular: family,
  medium: family,
  semibold: family,
  bold: family,
  extra: family,
};
export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extra: "800",
} as const;
