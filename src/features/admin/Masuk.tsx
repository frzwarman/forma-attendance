import { useState } from "react";
import { View } from "react-native";
import { Backdrop, Logo } from "../../components/Brand";
import { Button, Card, Field, T } from "../../components/ui";
import { signIn } from "../../services/adminApi";
import { useTheme } from "../../theme";

export function Masuk() {
  const c = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Backdrop>
      <View style={{ flex: 1, justifyContent: "center", padding: 20, paddingVertical: 48 }}>
        <Card elevated style={{ width: "100%", maxWidth: 420, alignSelf: "center", gap: 20, padding: 28 }}>
          <Logo width={190} variant="bare" />
          <View style={{ gap: 4 }}>
            <T size={26} weight="extra" accessibilityRole="header">
              Masuk Admin
            </T>
            <T size={14} color={c.muted}>
              Gunakan akun admin acara untuk melihat daftar check-in.
            </T>
          </View>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="nama@instansi.go.id"
            editable={!busy}
          />
          <Field
            label="Kata sandi"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            editable={!busy}
            onSubmitEditing={() => void submit()}
          />
          {!!error && (
            <T accessibilityRole="alert" color={c.danger}>
              {error}
            </T>
          )}
          <Button large label="Masuk" loading={busy} loadingLabel="Memeriksa…" onPress={() => void submit()} />
        </Card>
      </View>
    </Backdrop>
  );
}
