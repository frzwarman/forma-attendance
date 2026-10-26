import { View } from "react-native";
import { Backdrop, Logo } from "../../components/Brand";
import { Button, Card, T } from "../../components/ui";
import { signOut } from "../../services/adminApi";
import { useTheme } from "../../theme";

// Signed in, but the account is not an admin (or the check failed): say so plainly.
export function NoAccess({ email, error, onRetry }: { email: string; error?: string; onRetry: () => void }) {
  const c = useTheme();
  return (
    <Backdrop>
      <View style={{ flex: 1, justifyContent: "center", padding: 20, paddingVertical: 48 }}>
        <Card elevated style={{ width: "100%", maxWidth: 460, alignSelf: "center", gap: 16, padding: 28 }}>
          <Logo width={170} variant="bare" />
          <T size={24} weight="extra" accessibilityRole="header">
            {error ? "Akses admin belum bisa diperiksa" : "Akun ini belum menjadi admin"}
          </T>
          {error ? (
            <T color={c.danger} accessibilityRole="alert">
              {error}
            </T>
          ) : (
            <T color={c.muted}>
              Anda masuk sebagai {email}, tetapi akun ini belum terdaftar sebagai admin acara. Pemilik proyek perlu
              menambahkan akun ini ke daftar admin di Supabase, lalu muat ulang halaman ini.
            </T>
          )}
          <Button label="Periksa lagi" variant="secondary" onPress={onRetry} />
          <Button label="Keluar" variant="ghost" onPress={() => void signOut()} />
        </Card>
      </View>
    </Backdrop>
  );
}
