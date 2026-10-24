import React,{ createContext,useContext } from "react";
import { useColorScheme } from "react-native";
import { usePreferences } from "../stores/preferences";
export const light = {
  bg: "#F7F8FA",
  surface: "#FFFFFF",
  text: "#232438",
  muted: "#727485",
  subtle: "#F1F2F6",
  border: "#EDEEF3",
  primary: "#5851DB",
  lavender: "#F0EEFF",
  primaryText: "#6258D6",
  green: "#279777",
  greenBg: "#EAF7F0",
  amber: "#C58A36",
  amberBg: "#FFF5E5",
  red: "#D4676D",
  redBg: "#FDEEF0",
  blue: "#548ECC",
  blueBg: "#EDF5FD",
  hero: "#5851DB",
  white: "#FFFFFF",
};
export type Theme = typeof light;
const dark: Theme = {
  ...light,
  bg: "#14151D",
  green: "#6DDEB7",
  amber: "#F1C17C",
  red: "#FE99A5",
  blue: "#8CC0F6",
  surface: "#1D1E29",
  text: "#F2F1FA",
  muted: "#A0A0B3",
  subtle: "#272836",
  border: "#30313F",
  lavender: "#302A4C",
  primaryText: "#B9B2FF",
  greenBg: "#173D33",
  amberBg: "#42351E",
  redBg: "#44272F",
  blueBg: "#20364D",
};
const Context = createContext(light);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
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
export const fonts = {
  regular: "JakartaRegular",
  medium: "JakartaMedium",
  semibold: "JakartaSemiBold",
  bold: "JakartaBold",
  extra: "JakartaExtraBold",
};
