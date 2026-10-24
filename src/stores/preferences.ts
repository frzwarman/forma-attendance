import { create } from "zustand";
import { createJSONStorage,persist } from "zustand/middleware";
import { storage } from "../services/storage";
import type { Role } from "../types";
interface Preferences {
  employeeId: string;
  role: Role;
  authenticated: boolean;
  rememberSession: boolean;
  theme: "light" | "dark" | "system";
  notificationsEnabled: boolean;
  hydrated: boolean;
  setSession: (
    employeeId: string,
    role: Role,
    rememberSession?: boolean,
  ) => void;
  logout: () => void;
  setTheme: (theme: Preferences["theme"]) => void;
  setNotifications: (value: boolean) => void;
  setHydrated: () => void;
}
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      employeeId: "emp-1",
      role: "employee",
      authenticated: true,
      rememberSession: true,
      theme: "light",
      notificationsEnabled: true,
      hydrated: false,
      setSession: (employeeId, role, rememberSession = true) =>
        set({ employeeId, role, authenticated: true, rememberSession }),
      logout: () => set({ authenticated: false }),
      setTheme: (theme) => set({ theme }),
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "forma.preferences.v1",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        employeeId: state.employeeId,
        role: state.role,
        authenticated: state.authenticated && state.rememberSession,
        rememberSession: state.rememberSession,
        theme: state.theme,
        notificationsEnabled: state.notificationsEnabled,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
