import { useQuery,useQueryClient } from "@tanstack/react-query";
import React,{ createContext,useContext } from "react";
import { View } from "react-native";
import { Button,Card,T } from "../components/ui";
import { usePreferences } from "../stores/preferences";
import type { DemoDatabase,Employee,Organization } from "../types";
import { repository } from "./repository";
import { organization } from "./seed";
const Context = createContext<{
  db: DemoDatabase;
  employee: Employee;
  organization: Organization;
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
  if (query.isError)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Card style={{ maxWidth: 460, alignSelf: "center", gap: 16 }}>
          <T weight="bold" size={20}>
            Couldn’t open your workspace
          </T>
          <T>
            Check that browser storage is enabled, then try again. Your saved
            demo data has not been reset.
          </T>
          <Button
            label="Try again"
            onPress={() => {
              void query.refetch();
            }}
          />
        </Card>
      </View>
    );
  if (!query.data) return fallback;
  return (
    <Context.Provider
      value={{
        db: query.data,
        organization,
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
