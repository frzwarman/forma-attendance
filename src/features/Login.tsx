import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { z } from "zod";
import { NusantaraLogo } from "../components/NusantaraBrand";
import {
  Button,
  Card,
  Field,
  IconButton,
  Row,
  Sheet,
  T,
} from "../components/ui";
import { useAppDimensions } from "../hooks/useAppDimensions";
import { authRepository } from "../services/repository";
import { usePreferences } from "../stores/preferences";
import { useTheme } from "../theme";
const schema = z.object({
  email: z.email("Enter a valid corporate email."),
  password: z.string().min(8, "Enter at least 8 characters."),
});

export default function Login() {
  const c = useTheme();
  const router = useRouter();
  const { width } = useAppDimensions();
  const prefs = usePreferences();
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [message, setMessage] = useState("");
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "alex@northstar.demo", password: "" },
  });
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 40,
      }}
    >
      <NusantaraLogo width={Math.min(295, width - 40)} />
      <View
        style={{
          width: "100%",
          maxWidth: 350,
          paddingHorizontal: Math.max(12, Math.min(38, (width - 300) / 2)),
          paddingTop: 56,
          gap: 24,
        }}
      >
        <View style={{ alignItems: "center", gap: 24, paddingBottom: 8 }}>
          <T
            size={22.5}
            weight="bold"
            color={c.primary}
            style={{ textAlign: "center", lineHeight: 32 }}
          >
            WORKFORCE{"\n"}ATTENDANCE
          </T>
          <View
            style={{ height: 1, width: "100%", backgroundColor: c.border }}
          />
        </View>
        <View style={{ gap: 7 }}>
          <T size={23} weight="bold">
            Welcome back.
          </T>
          <T size={13} color={c.muted}>
            Sign in to your workspace.
          </T>
        </View>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Field
              label="Corporate email"
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.email?.message}
            />
          )}
        />
        <View>
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Field
                label="Password"
                placeholder="Enter your password"
                secureTextEntry={!show}
                autoComplete="current-password"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.password?.message}
                style={{ paddingRight: 50 }}
              />
            )}
          />
          <View style={{ position: "absolute", right: 3, top: 29 }}>
            <IconButton
              icon={show ? EyeOff : Eye}
              label={show ? "Hide password" : "Show password"}
              onPress={() => setShow((v) => !v)}
            />
          </View>
        </View>
        <Row
          style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}
        >
          <Row style={{ gap: 7 }}>
            <Switch
              accessibilityLabel="Remember session"
              value={remember}
              onValueChange={setRemember}
              trackColor={{ true: c.primary, false: c.border }}
            />
            <T size={11} color={c.muted}>
              Remember me
            </T>
          </Row>
          <Pressable
            accessibilityRole="button"
            onPress={() => setForgot(true)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <T size={11} color={c.primaryText}>
              Forgot password?
            </T>
          </Pressable>
        </Row>
        {!!error && (
          <T color={c.red} size={12}>
            {error}
          </T>
        )}
        <Button
          label="Sign in"
          icon={ArrowRight}
          loading={isSubmitting}
          onPress={handleSubmit(async (values) => {
            setError("");
            try {
              const session = await authRepository.login(
                values.email,
                values.password,
              );
              prefs.setSession(session.employeeId, session.role, remember);
              router.replace(session.role === "admin" ? "/admin" : "/");
            } catch (e) {
              setError((e as Error).message);
            }
          })}
        />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Button
          label="Explore demo"
          icon={Sparkles}
          variant="secondary"
          onPress={() => {
            prefs.setSession("emp-1", "employee");
            router.replace("/");
          }}
        />
        <Card style={{ padding: 15, gap: 6 }}>
          <T size={11} weight="bold">
            Your demo pass
          </T>
          <T size={11} color={c.muted}>
            Employee: alex@northstar.demo
          </T>
          <T size={11} color={c.muted}>
            HR admin: hr@northstar.demo
          </T>
          <T size={11} color={c.muted}>
            Password: Forma2026!
          </T>
        </Card>
        <T size={10} color={c.muted} style={{ textAlign: "center" }}>
          Fictional demo data. No real employee credentials.
        </T>
      </View>
      <Sheet
        visible={forgot}
        title="Find your way back"
        onClose={() => setForgot(false)}
      >
        <T color={c.muted}>
          Enter your corporate email to request a password reset.
        </T>
        <Field
          label="Corporate email"
          value={resetEmail}
          onChangeText={setResetEmail}
          keyboardType="email-address"
        />
        <Button
          label="Request reset"
          onPress={async () => {
            try {
              setMessage(await authRepository.resetPassword(resetEmail));
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        />
        {!!message && (
          <T size={12} color={c.primaryText}>
            {message}
          </T>
        )}
      </Sheet>
    </ScrollView>
  );
}
