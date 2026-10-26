import "../../global.css";
import { Slot } from "expo-router";
import { BAWASLU } from "../domain/theme";
import { ThemeProvider } from "../theme";
export default function RootLayout() {
  return (
    <ThemeProvider colors={BAWASLU}>
      <Slot />
    </ThemeProvider>
  );
}
