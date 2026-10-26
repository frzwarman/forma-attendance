import { createContext, useContext, type ReactNode } from "react";
import { Platform } from "react-native";

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
const Context = createContext(light);
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={light}>{children}</Context.Provider>;
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
