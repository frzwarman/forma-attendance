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
      <View style={{ padding: 20, paddingTop: 48, paddingBottom: 48 }}>
        <View style={{ width: "100%", maxWidth: 420, alignSelf: "center", gap: 20 }}>
          <Logo />
          <Card style={{ gap: 16 }}>
            <T size={22} weight="bold" accessibilityRole="header">
              Masuk Admin
            </T>
            <Field
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
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
            <Button label="Masuk" loading={busy} loadingLabel="Memeriksa…" onPress={() => void submit()} />
          </Card>
        </View>
      </View>
    </Backdrop>
  );
}
