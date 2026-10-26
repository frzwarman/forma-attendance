import { Slot } from "expo-router";
import { View } from "react-native";
import { Backdrop } from "../../components/Brand";
import { T } from "../../components/ui";
import { AdminShell } from "../../features/admin/AdminShell";
import { Masuk } from "../../features/admin/Masuk";
import { useSession } from "../../services/auth";
import { useTheme } from "../../theme";

export default function AdminLayout() {
  const c = useTheme();
  const { session, loading } = useSession();
  if (loading)
    return (
      <Backdrop>
        <View style={{ padding: 24 }}>
          <T color={c.onBackground}>Memuat…</T>
        </View>
      </Backdrop>
    );
  if (!session) return <Masuk />;
  return (
    <AdminShell>
      <Slot />
    </AdminShell>
  );
}
