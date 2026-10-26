import { useQuery } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { View } from "react-native";
import { Backdrop } from "../../components/Brand";
import { T } from "../../components/ui";
import { AdminShell } from "../../features/admin/AdminShell";
import { Masuk } from "../../features/admin/Masuk";
import { NoAccess } from "../../features/admin/NoAccess";
import { adminApi, useSession } from "../../services/adminApi";
import { AdminApiContext } from "../../services/adminContext";
import { useTheme } from "../../theme";

export default function AdminLayout() {
  const c = useTheme();
  const { session, loading } = useSession();
  // Admin rights come from guestbook_admins, so check them right after sign-in.
  const access = useQuery({
    queryKey: ["is-admin", session?.user.id],
    queryFn: adminApi.isAdmin,
    enabled: !!session,
    retry: 1,
  });
  if (loading || (session && access.isLoading))
    return (
      <Backdrop>
        <View style={{ padding: 24 }}>
          <T color={c.onBackground}>Memuat…</T>
        </View>
      </Backdrop>
    );
  if (!session) return <Masuk />;
  if (access.isError || access.data !== true)
    return (
      <NoAccess
        email={session.user.email ?? ""}
        error={access.isError ? `Gagal memeriksa akses: ${(access.error as Error).message}` : undefined}
        onRetry={() => void access.refetch()}
      />
    );
  return (
    <AdminApiContext.Provider value={adminApi}>
      <AdminShell>
        <Slot />
      </AdminShell>
    </AdminApiContext.Provider>
  );
}
