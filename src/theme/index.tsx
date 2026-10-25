import { createContext, useContext, type ReactNode } from "react";
import { Platform, useColorScheme } from "react-native";
import { usePreferences } from "../stores/preferences";

// Measured from the supplied Nusantara Jotform reference.
export const brand = {
  gold: "#DBAF6D",
  charcoal: "#1D1B1A",
  input: "rgba(29, 27, 26, 0.54)",
  reference: "https://form.jotform.com/241414717939059",
};
export const light = {
  bg: brand.charcoal,
  surface: "rgba(29, 27, 26, 0.78)",
  text: brand.gold,
  muted: "#D7CCB9",
  subtle: "rgba(29, 27, 26, 0.54)",
  border: "rgba(219, 175, 109, 0.40)",
  primary: brand.gold,
  lavender: "rgba(219, 175, 109, 0.12)",
  primaryText: brand.gold,
  onPrimary: brand.charcoal,
  inputSurface: brand.input,
  buttonSurface: "rgba(229, 231, 242, 0.04)",
  green: "#9BD1AD",
  greenBg: "rgba(25, 72, 44, 0.74)",
  amber: "#EAC88E",
  amberBg: "rgba(87, 62, 26, 0.75)",
  red: "#FFB4AB",
  redBg: "rgba(91, 35, 35, 0.75)",
  blue: "#B6CEEA",
  blueBg: "rgba(37, 57, 78, 0.75)",
  hero: "rgba(29, 27, 26, 0.72)",
  heroText: brand.gold,
  white: "#FFFFFF",
};
export type Theme = typeof light;
const dark: Theme = {
  ...light,
  bg: "#151B16",
  surface: "rgba(16, 23, 18, 0.94)",
  text: "#F3E6D2",
  muted: "#D6C6AC",
  subtle: "rgba(10, 16, 12, 0.88)",
  border: "rgba(219, 175, 109, 0.46)",
  inputSurface: "rgba(9, 15, 11, 0.82)",
  hero: "rgba(12, 20, 15, 0.92)",
};
const Context = createContext(light);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const setting = usePreferences((s) => s.theme);
  const system = useColorScheme();
  return (
    <Context.Provider
      value={
        setting === "dark" || (setting === "system" && system === "dark")
          ? dark
          : light
      }
    >
      {children}
    </Context.Provider>
  );
}
export const useTheme = () => useContext(Context);
const family = Platform.OS === "android" ? "sans-serif" : "Arial";
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
