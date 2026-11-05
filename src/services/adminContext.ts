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

// E-Vote's current poll and count; Hasil E-Vote asks every 2 s so the monitor follows the votes.
export function usePollResults(refetchInterval: number) {
  const api = useAdminApi();
  return useQuery({ queryKey: ["poll-results"], queryFn: api.fetchPollResults, refetchInterval });
}

export function useWinners() {
  const api = useAdminApi();
  return useQuery({ queryKey: ["winners"], queryFn: api.fetchWinners, refetchInterval: 10_000 });
}

// Undian's list, winners included.
export function useWheel() {
  const api = useAdminApi();
  return useQuery({ queryKey: ["wheel"], queryFn: api.fetchWheel, refetchInterval: 10_000 });
}
