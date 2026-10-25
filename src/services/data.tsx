import { useQuery,useQueryClient } from "@tanstack/react-query";
import React,{ createContext,useContext,useEffect,useState } from "react";
import { AppState,Platform,View } from "react-native";
import { Button,Card,Sheet,T } from "../components/ui";
import { usePreferences } from "../stores/preferences";
import type { DemoDatabase,Employee,Organization } from "../types";
import { repository } from "./repository";
import { organization } from "./seed";
const Context = createContext<{
  db: DemoDatabase;
  employee: Employee;
  organization: Organization;
  isRefreshing: boolean;
  refreshError: string | null;
  refresh: () => Promise<void>;
}>({} as never);
export function DataProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const id = usePreferences((s) => s.employeeId);
  const query = useQuery({ queryKey: ["workforce"], queryFn: repository.read });
  const client = useQueryClient();
  const [recovery, setRecovery] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: ["workforce"] }); };
    if (Platform.OS === "web") {
      const onStorage = (event: StorageEvent) => {
        if (event.key === "forma.demo.v1" || event.key === null) refresh();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener("focus", refresh);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("focus", refresh);
      };
    }
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    return () => subscription.remove();
  }, [client]);
  if (query.isError && !query.data)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Card style={{ maxWidth: 460, alignSelf: "center", gap: 16 }}>
          <T weight="bold" size={20}>
            Couldn’t open your workspace
          </T>
          <T>
            Check that storage is available on this device, then try again. Your saved
            demo data has not been reset.
          </T>
          <Button
            label="Try again"
            loading={query.isFetching}
            loadingLabel="Trying again…"
            onPress={() => {
              void query.refetch();
            }}
          />
          <Button label="Restore demo workspace" variant="secondary" onPress={() => setRecovery(true)} />
        </Card>
        <Sheet visible={recovery} title="Restore the demo workspace?" busy={resetting} onClose={() => setRecovery(false)}>
          <T>This replaces saved demo attendance and requests on this device with a fresh workspace. Your appearance and login preferences are kept. Try again first if the storage problem is temporary.</T>
          {!!recoveryError && <T accessibilityRole="alert">{recoveryError}</T>}
          <Button label="Restore demo data" variant="danger" loading={resetting} loadingLabel="Restoring workspace…" onPress={async () => {
            setResetting(true);
            setRecoveryError("");
            try {
              await repository.reset();
              await query.refetch({ throwOnError: true });
              setRecovery(false);
            } catch (error) {
              setRecoveryError((error as Error).message);
            } finally {
              setResetting(false);
            }
          }} />
          <Button label="Keep saved data" disabled={resetting} variant="ghost" onPress={() => setRecovery(false)} />
        </Sheet>
      </View>
    );
  if (!query.data) return fallback;
  return (
    <Context.Provider
      value={{
        db: query.data,
        organization,
        isRefreshing: query.isFetching,
        refreshError: query.isError ? "Couldn’t update your workspace. Your last loaded data is still available." : null,
        employee:
          query.data.employees.find((e) => e.id === id) ||
          query.data.employees[0],
        refresh: async () => {
          await client.invalidateQueries({ queryKey: ["workforce"] });
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useData = () => useContext(Context);
