import { useAppDimensions } from "../hooks/useAppDimensions";
import { zodResolver } from "@hookform/resolvers/zod";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  Sparkles,
} from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { z } from "zod";
import { Brand } from "../components/AppShell";
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Row,
  Sheet,
  T,
} from "../components/ui";
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
      contentContainerStyle={{
        flexGrow: 1,
        flexDirection: width >= 900 ? "row" : "column",
      }}
    >
      {width >= 900 && (
        <LinearGradient
          colors={["#635CDF", "#433CB3"]}
          style={{
            flex: 1,
            padding: 70,
            justifyContent: "space-between",
            minHeight: 850,
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              padding: 13,
              alignSelf: "flex-start",
            }}
          >
            <Brand />
          </View>
          <View style={{ gap: 23 }}>
            <Fingerprint size={67} strokeWidth={1} color="#DAD5FF" />
            <T
              size={55}
              weight="bold"
              color="#FFFFFF"
              style={{ letterSpacing: -2, lineHeight: 66 }}
            >
              Good work.{"\n"}Better balance.
            </T>
            <T color="#DED9FF" size={16} style={{ maxWidth: 360 }}>
              A little less admin. A little more room to do what you love. Meet
              your new workday rhythm.
            </T>
            <Row style={{ marginTop: 20 }}>
              <Badge label="Built around people" tone="primary" />
              <Badge label="Made for your everyday" tone="primary" />
            </Row>
          </View>
          <T color="#C1BBF5" size={11}>
            Forma · A better rhythm for work.
          </T>
        </LinearGradient>
      )}
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: width < 500 ? 25 : 60,
          minHeight: 760,
        }}
      >
        <View style={{ width: "100%", maxWidth: 390, gap: 23 }}>
          {width < 900 && (
            <View style={{ marginBottom: 24 }}>
              <Brand />
            </View>
          )}
          <View>
            <Badge label="Your workday, simplified" />
            <T
              size={32}
              weight="bold"
              style={{ marginTop: 20, letterSpacing: -1 }}
            >
              Welcome back.
            </T>
            <T color={c.muted} size={13} style={{ marginTop: 8 }}>
              A good day starts here. Sign in to your workspace.
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
            <View style={{ position: "absolute", right: 5, top: 26 }}>
              <IconButton
                icon={show ? EyeOff : Eye}
                label={show ? "Hide password" : "Show password"}
                onPress={() => setShow((v) => !v)}
              />
            </View>
          </View>
          <Row style={{ justifyContent: "space-between" }}>
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
            >
              <T color={c.primaryText} size={11} weight="semibold">
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
          <Row>
            <View style={{ height: 1, flex: 1, backgroundColor: c.border }} />
            <T size={10} color={c.muted}>
              or take a look around
            </T>
            <View style={{ height: 1, flex: 1, backgroundColor: c.border }} />
          </Row>
          <Button
            variant="secondary"
            label="Explore demo"
            icon={Sparkles}
            onPress={() => {
              prefs.setSession("emp-1", "employee");
              router.replace("/");
            }}
          />
          <Card
            style={{
              padding: 16,
              backgroundColor: c.bg,
              borderWidth: 0,
              gap: 6,
            }}
          >
            <T size={10} weight="bold">
              Your demo pass
            </T>
            <T size={10} color={c.muted}>
              Employee: alex@northstar.demo
            </T>
            <T size={10} color={c.muted}>
              HR admin: hr@northstar.demo
            </T>
            <T size={10} color={c.muted}>
              Password: Forma2026!
            </T>
          </Card>
          <T size={9} color={c.muted} style={{ textAlign: "center" }}>
            A fictional workspace. No real employee data or secure
            authentication.
          </T>
        </View>
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
          keyboardType="email-address"
          value={resetEmail}
          onChangeText={setResetEmail}
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
