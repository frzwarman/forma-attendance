import { useRouter } from "expo-router";
import {
  BriefcaseBusiness,
  Building2,
  Globe,
  LogOut,
  Mail,
  MapPin,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { Avatar } from "../components/Avatar";
import {
  Badge,
  Button,
  Card,
  IconBox,
  Row,
  SectionTitle,
  Sheet,
  T,
} from "../components/ui";
import { useAppDimensions } from "../hooks/useAppDimensions";
import { useData } from "../services/data";
import { useTheme } from "../theme";
import { usePreferences } from "../stores/preferences";
import { organization } from "../services/seed";
import { repository } from "../services/repository";
import { PageHeading } from "./Home";

export default function Profile() {
  const c = useTheme();
  const { db, employee, refresh } = useData();
  const prefs = usePreferences();
  const { width } = useAppDimensions();
  const wide = width >= 1100;
  const router = useRouter();
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <View style={{ gap: 20 }}>
      <View style={{ marginBottom: -26 }}>
        <PageHeading
          title="A little about you"
          subtitle="Your details and everyday preferences."
        />
      </View>
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          alignItems: "stretch",
          gap: 20,
        }}
      >
        <Card
          testID="profile-identity-card"
          style={{
            flex: wide ? 1 : undefined,
            alignSelf: wide ? "flex-start" : "stretch",
            padding: 20,
            gap: 18,
          }}
        >
          <Row style={{ gap: 15, alignItems: "center" }}>
            <Avatar employee={employee} size={64} radius={22} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <T size={22} weight="bold" style={{ letterSpacing: -0.5 }}>
                {employee.name}
              </T>
              <T color={c.muted} size={12}>
                {employee.title}
              </T>
              <Badge label={employee.status} tone="green" dot />
            </View>
          </Row>
          <View style={{ height: 1, backgroundColor: c.border }} />
          <Row style={{ alignItems: "flex-start" }}>
            <Building2 size={17} color={c.muted} />
            <View style={{ flex: 1 }}>
              <T size={13} weight="medium">
                {organization.name}
              </T>
              <T size={12} color={c.muted} style={{ marginTop: 3 }}>
                {employee.email}
              </T>
            </View>
          </Row>
        </Card>
        <View style={{ flex: wide ? 1.7 : undefined, gap: 20 }}>
          <Card testID="profile-work-card" style={{ padding: 20 }}>
            <SectionTitle title="Work information" />
            <View style={{ gap: 18 }}>
              {[
                {
                  label: "Employee ID",
                  value: `NST-${employee.id.slice(4).padStart(4, "0")}`,
                  icon: UserRound,
                },
                {
                  label: "Department",
                  value: employee.department,
                  icon: BriefcaseBusiness,
                },
                {
                  label: "Job title",
                  value: employee.title,
                  icon: BriefcaseBusiness,
                },
                {
                  label: "Office",
                  value:
                    db.locations.find((l) => l.id === employee.locationId)
                      ?.name || "—",
                  icon: MapPin,
                },
                { label: "Corporate email", value: employee.email, icon: Mail },
              ].map((row) => (
                <Row
                  key={row.label}
                  style={{ gap: 12, alignItems: "flex-start" }}
                >
                  <row.icon color={c.muted} size={18} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T color={c.muted} size={11}>
                      {row.label}
                    </T>
                    <T size={14} weight="medium">
                      {row.value}
                    </T>
                  </View>
                </Row>
              ))}
            </View>
          </Card>
          <Card
            testID="profile-preferences-card"
            style={{ padding: 20, gap: 18 }}
          >
            <T size={16} weight="bold">
              Make yourself at home
            </T>
            <View style={{ gap: 10 }}>
              <T size={13} weight="semibold">
                Appearance
              </T>
              <Row style={{ gap: 7 }}>
                {(["light", "dark", "system"] as const).map((theme) => {
                  const selected = prefs.theme === theme;
                  const Icon =
                    theme === "light" ? Sun : theme === "dark" ? Moon : Globe;
                  return (
                    <Pressable
                      key={theme}
                      accessibilityRole="button"
                      accessibilityLabel={
                        theme[0].toUpperCase() + theme.slice(1)
                      }
                      accessibilityState={{ selected }}
                      aria-pressed={selected}
                      onPress={() => prefs.setTheme(theme)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 72,
                        paddingVertical: 11,
                        borderRadius: 12,
                        backgroundColor: selected ? c.primary : c.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <Icon size={19} color={selected ? c.white : c.muted} />
                      <T
                        size={12}
                        weight="semibold"
                        color={selected ? c.white : c.text}
                      >
                        {theme[0].toUpperCase() + theme.slice(1)}
                      </T>
                    </Pressable>
                  );
                })}
              </Row>
            </View>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <Row style={{ justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <T size={13} weight="semibold">
                  In-app notifications
                </T>
                <T size={11} color={c.muted}>
                  Updates in your notification center
                </T>
              </View>
              <Switch
                accessibilityLabel="Enable in-app notifications"
                value={prefs.notificationsEnabled}
                onValueChange={prefs.setNotifications}
                trackColor={{ false: c.border, true: c.primary }}
              />
            </Row>
            <T size={11} color={c.muted}>
              English · Indonesia · Asia/Jakarta
            </T>
          </Card>
          <Card testID="profile-demo-card" style={{ padding: 20, gap: 14 }}>
            <Row style={{ alignItems: "flex-start" }}>
              <IconBox icon={ShieldCheck} size={36} />
              <View style={{ flex: 1 }}>
                <T size={13} weight="bold">
                  Your demo workspace
                </T>
                <T size={11} color={c.muted}>
                  Fictional data, saved on this device.
                </T>
              </View>
            </Row>
            <Button
              variant="secondary"
              label="Switch to HR demo"
              icon={ShieldCheck}
              onPress={() => {
                prefs.setSession("emp-5", "admin");
                router.push("/admin");
              }}
            />
            <Button
              variant="secondary"
              label="Reset demo data"
              icon={RefreshCw}
              onPress={() => setReset(true)}
            />
            <Button
              variant="danger"
              label="Log out"
              icon={LogOut}
              onPress={() => {
                prefs.logout();
                router.replace("/login");
              }}
            />
            {!!message && (
              <T color={c.green} size={12}>
                {message}
              </T>
            )}
          </Card>
        </View>
      </View>
      <Sheet
        visible={reset}
        title="A fresh start?"
        onClose={() => setReset(false)}
      >
        <T color={c.muted}>
          This resets attendance, requests, approvals, and locations to the
          original demo data on this device.
        </T>
        <Button
          variant="danger"
          label="Reset demo workspace"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await repository.reset();
              await refresh();
              setMessage("Demo workspace reset.");
              setReset(false);
            } catch (e) {
              setMessage(`Couldn’t reset your demo: ${(e as Error).message}`);
              setReset(false);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button
          variant="ghost"
          label="Keep my changes"
          onPress={() => setReset(false)}
        />
      </Sheet>
    </View>
  );
}
