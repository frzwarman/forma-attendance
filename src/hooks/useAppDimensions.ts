import { useWindowDimensions } from "react-native";
import { usePreferences } from "../stores/preferences";

export const EMPLOYEE_APP_WIDTH = 480;

// Employee screens use the same phone layout on devices and desktop previews.
export function useAppDimensions() {
  const dimensions = useWindowDimensions();
  const role = usePreferences((state) => state.role);
  const authenticated = usePreferences((state) => state.authenticated);
  return {
    ...dimensions,
    width:
      role === "admin" && authenticated
        ? dimensions.width
        : Math.min(dimensions.width, EMPLOYEE_APP_WIDTH),
  };
}
