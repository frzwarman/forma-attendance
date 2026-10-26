import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import type { AdminApi } from "./adminApi";

export const AdminApiContext = createContext<AdminApi | null>(null);

export function useAdminApi(): AdminApi {
  const api = useContext(AdminApiContext);
  if (!api) throw new Error("Admin API is only available inside the admin layout");
  return api;
}

export function useCheckIns() {
  const api = useAdminApi();
  return useQuery({ queryKey: ["checkins"], queryFn: api.fetchAllCheckIns, refetchInterval: 10_000 });
}

export function useWinners() {
  const api = useAdminApi();
  return useQuery({ queryKey: ["winners"], queryFn: api.fetchWinners, refetchInterval: 10_000 });
}
