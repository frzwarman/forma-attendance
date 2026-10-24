import { EMPLOYEE_APP_WIDTH } from "../hooks/useAppDimensions";
import { Redirect, usePathname, useRouter } from "expo-router";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Headphones,
  House,
  MapPin,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "../services/data";
import { usePreferences } from "../stores/preferences";
import { useTheme } from "../theme";
import { Avatar } from "./Avatar";
import { Badge, Button, Card, IconButton, Row, Sheet, T } from "./ui";
const employeeNav = [
  { label: "Overview", mobile: "Home", path: "/", icon: House },
  { label: "Attendance", mobile: "History", path: "/history", icon: Clock3 },
  {
    label: "My schedule",
    mobile: "Schedule",
    path: "/schedule",
    icon: CalendarDays,
  },
  {
    label: "Requests",
    mobile: "Requests",
    path: "/requests",
    icon: ClipboardList,
  },
];
const adminNav = [
  {
    label: "Dashboard",
    mobile: "Home",
    path: "/admin",
    icon: ChartNoAxesCombined,
  },
  { label: "Employees", mobile: "People", path: "/employees", icon: Users },
  {
    label: "Attendance",
    mobile: "Monitor",
    path: "/monitoring",
    icon: Activity,
  },
  {
    label: "Approvals",
    mobile: "Approvals",
    path: "/approvals",
    icon: ClipboardList,
  },
  {
    label: "Office locations",
    mobile: "Offices",
    path: "/locations",
    icon: MapPin,
  },
];
export function Brand({ compact = false }: { compact?: boolean }) {
  const c = useTheme();
  return (
    <Row style={{ gap: 10 }}>
      <View
        style={{
          width: 35,
          height: 35,
          borderRadius: 10,
          backgroundColor: c.primary,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: "-7deg" }],
        }}
      >
        <View
          style={{
            width: 17,
            height: 20,
            borderLeftWidth: 5,
            borderTopWidth: 5,
            borderColor: "#FFFFFF",
            borderRadius: 1,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: 10,
            height: 4,
            backgroundColor: "#FFFFFF",
            top: 17,
            left: 12,
          }}
        />
      </View>
      {!compact && (
        <T size={29} weight="extra" style={{ letterSpacing: -1.3 }}>
          forma
          <T color={c.primary} size={29}>
            .
          </T>
        </T>
      )}
    </Row>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { db, employee } = useData();
  const prefs = usePreferences();
  const admin = prefs.role === "admin";
  const desktop = admin && width >= 1050;
  const nav = admin ? adminNav : employeeNav;
  const [help, setHelp] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const unread =
    prefs.notificationsEnabled &&
    db.notifications.some((n) => n.employeeId === employee.id && !n.read);
  const login = path === "/login";
  if (login)
    return (
      <View
        style={{ flex: 1, backgroundColor: c.subtle, alignItems: "center" }}
      >
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: EMPLOYEE_APP_WIDTH,
            backgroundColor: c.bg,
          }}
        >
          {children}
        </View>
      </View>
    );
  if (!prefs.hydrated)
    return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (!prefs.authenticated) return <Redirect href="/login" />;
  const selected =
    nav.find((n) => n.path === path)?.label ||
    (path === "/profile"
      ? "My profile"
      : path === "/notifications"
        ? "Notifications"
        : "Workspace");
  function go(p: string) {
    router.push(p as never);
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.subtle, alignItems: "center" }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: admin ? undefined : EMPLOYEE_APP_WIDTH,
          flexDirection: "row",
          backgroundColor: c.bg,
        }}
      >
        {desktop && (
          <View
            style={{
              width: 236,
              backgroundColor: c.surface,
              borderRightWidth: 1,
              borderColor: c.border,
              paddingTop: 33,
              paddingHorizontal: 22,
            }}
          >
            <View style={{ paddingLeft: 9, marginBottom: 34 }}>
              <Brand />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch demo role"
              onPress={() => setSwitcher(true)}
              style={{
                padding: 11,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 11,
                marginBottom: 30,
              }}
            >
              <Row>
                <View
                  style={{
                    width: 31,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: c.subtle,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Building2 size={17} color={c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <T size={11} weight="bold">
                    Northstar
                  </T>
                  <T size={9} color={c.muted}>
                    Your workspace
                  </T>
                </View>
                <ChevronDown size={14} color={c.muted} />
              </Row>
            </Pressable>
            <T
              size={10}
              color={c.muted}
              weight="medium"
              style={{ marginLeft: 13, marginBottom: 12 }}
            >
              WORKSPACE
            </T>
            <View style={{ gap: 7 }}>
              {nav.map((item) => (
                <Pressable
                  key={item.path}
                  onPress={() => go(item.path)}
                  accessibilityRole="button"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 46,
                    paddingHorizontal: 14,
                    borderRadius: 9,
                    backgroundColor:
                      path === item.path ? c.lavender : "transparent",
                  }}
                >
                  <item.icon
                    size={19}
                    color={path === item.path ? c.primaryText : c.muted}
                    strokeWidth={1.8}
                  />
                  <T
                    size={12}
                    weight={path === item.path ? "semibold" : "medium"}
                    color={path === item.path ? c.primaryText : c.muted}
                  >
                    {item.label}
                  </T>
                  {item.path === "/requests" && (
                    <View
                      style={{
                        marginLeft: "auto",
                        backgroundColor: c.subtle,
                        borderRadius: 4,
                        paddingHorizontal: 6,
                      }}
                    >
                      <T size={10} color={c.muted}>
                        {
                          db.requests.filter(
                            (r) =>
                              r.employeeId === employee.id &&
                              r.status === "Pending",
                          ).length
                        }
                      </T>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: c.border,
                marginVertical: 25,
              }}
            />
            <T
              size={10}
              color={c.muted}
              style={{ marginLeft: 13, marginBottom: 12 }}
            >
              PERSONAL
            </T>
            {[
              { label: "My profile", path: "/profile", icon: UserRound },
              { label: "Notifications", path: "/notifications", icon: Bell },
            ].map((item) => (
              <Pressable
                key={item.path}
                onPress={() => go(item.path)}
                accessibilityRole="button"
                style={{
                  flexDirection: "row",
                  gap: 12,
                  padding: 14,
                  borderRadius: 9,
                  backgroundColor:
                    path === item.path ? c.lavender : "transparent",
                }}
              >
                <item.icon size={19} color={c.muted} />
                <T size={12} color={c.muted}>
                  {item.label}
                </T>
              </Pressable>
            ))}
            <View style={{ flex: 1, minHeight: 36 }} />
            <Card
              style={{
                padding: 16,
                backgroundColor: c.bg,
                borderWidth: 0,
                marginBottom: 20,
                borderRadius: 12,
              }}
            >
              <View style={{ marginBottom: 10 }}>
                <IconButton
                  icon={Headphones}
                  label="Contact your People team"
                  onPress={() => setHelp(true)}
                />
              </View>
              <T size={12} weight="bold">
                A little help?
              </T>
              <T
                size={10}
                color={c.muted}
                style={{ marginTop: 4, marginBottom: 12 }}
              >
                Your People team is here for you.
              </T>
              <Pressable
                onPress={() => setHelp(true)}
                accessibilityRole="button"
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <T size={11} weight="semibold" color={c.primaryText}>
                    Get in touch
                  </T>
                  <ArrowUpRight size={14} color={c.primaryText} />
                </Row>
              </Pressable>
            </Card>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open my profile"
              onPress={() => go("/profile")}
              style={{
                borderTopWidth: 1,
                borderColor: c.border,
                paddingVertical: 20,
              }}
            >
              <Row>
                <Avatar employee={employee} size={34} radius={12} />
                <View style={{ flex: 1 }}>
                  <T size={11} weight="semibold">
                    {employee.name}
                  </T>
                  <T size={9} color={c.muted}>
                    {admin ? "HR administrator" : "Employee account"}
                  </T>
                </View>
                <ChevronRight size={15} color={c.muted} />
              </Row>
            </Pressable>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              paddingHorizontal: desktop ? 38 : 16,
              paddingTop: desktop ? 0 : insets.top,
              height: desktop ? 82 : 70 + insets.top,
              backgroundColor: c.surface,
              borderBottomWidth: 1,
              borderColor: c.border,
              justifyContent: "center",
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              {desktop ? (
                <Row>
                  <T size={12} color={c.muted}>
                    Workspace
                  </T>
                  <ChevronRight size={12} color={c.muted} />
                  <T size={12} weight="medium">
                    {selected}
                  </T>
                </Row>
              ) : (
                <Brand />
              )}
              <Row style={{ gap: desktop ? 18 : 5 }}>
                {desktop && (
                  <Row style={{ gap: 6 }}>
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: c.green,
                      }}
                    />
                    <T size={10} color={c.muted}>
                      All systems operational
                    </T>
                  </Row>
                )}
                <Pressable
                  onPress={() => setSwitcher(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Switch demo role"
                >
                  <Badge
                    label={
                      admin ? "HR demo" : desktop ? "Demo workspace" : "Demo"
                    }
                    tone="neutral"
                  />
                </Pressable>
                <View
                  style={{
                    width: 1,
                    height: 22,
                    backgroundColor: c.border,
                    marginHorizontal: 4,
                  }}
                />
                <IconButton
                  icon={Bell}
                  onPress={() => go("/notifications")}
                  label="Notifications"
                  badge={unread}
                />
                {desktop && (
                  <Pressable
                    onPress={() => go("/profile")}
                    accessibilityRole="button"
                    accessibilityLabel="Profile"
                  >
                    <Avatar employee={employee} size={33} radius={12} />
                  </Pressable>
                )}
              </Row>
            </Row>
          </View>
          <ScrollView
            testID="screen-scroll"
            key={path}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: desktop ? 38 : 16,
              paddingTop: desktop ? 31 : 22,
              paddingBottom: desktop ? 28 : 100,
              gap: 24,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: desktop ? 1280 : undefined,
                alignSelf: "center",
              }}
            >
              {children}
              <Row
                style={{
                  marginTop: 30,
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <T size={9} color={c.muted}>
                  © {new Date().getFullYear()} Forma. A better rhythm for work.
                </T>
                <Row style={{ gap: 14 }}>
                  <T size={9} color={c.muted}>
                    Asia/Jakarta (GMT+7)
                  </T>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setHelp(true)}
                  >
                    <T size={9} color={c.muted}>
                      Help & support ↗
                    </T>
                  </Pressable>
                </Row>
              </Row>
            </View>
          </ScrollView>
          {!desktop && (
            <View
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: c.surface,
                borderTopWidth: 1,
                borderColor: c.border,
                paddingBottom: Math.max(
                  insets.bottom,
                  Platform.OS === "web" ? 12 : 0,
                ),
                paddingTop: 8,
              }}
            >
              <Row style={{ gap: 0, justifyContent: "space-around" }}>
                {[
                  ...nav.slice(0, 4),
                  {
                    label: "Profile",
                    mobile: admin ? "Offices" : "Profile",
                    path: admin ? "/locations" : "/profile",
                    icon: admin ? MapPin : UserRound,
                  },
                ].map((item) => (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: path === item.path }}
                    aria-selected={path === item.path}
                    accessibilityLabel={item.mobile}
                    key={item.path}
                    onPress={() => go(item.path)}
                    style={{
                      alignItems: "center",
                      gap: 4,
                      minWidth: 55,
                      minHeight: 49,
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 4,
                        borderRadius: 9,
                        backgroundColor:
                          path === item.path ? c.lavender : "transparent",
                      }}
                    >
                      <item.icon
                        size={20}
                        color={path === item.path ? c.primaryText : c.muted}
                      />
                    </View>
                    <T
                      size={11}
                      weight="semibold"
                      color={path === item.path ? c.primaryText : c.muted}
                    >
                      {item.mobile}
                    </T>
                  </Pressable>
                ))}
              </Row>
            </View>
          )}
        </View>
        <Sheet
          visible={help}
          onClose={() => setHelp(false)}
          title="Your People team"
        >
          <T color={c.muted}>
            Questions about attendance, schedules, or time off? Your Northstar
            People team can help.
          </T>
          <Card style={{ padding: 17 }}>
            <T weight="bold">Sarah Wijaya</T>
            <T color={c.muted}>people@northstar.demo</T>
            <T color={c.muted} size={12}>
              Monday–Friday · 09:00–18:00 WIB
            </T>
          </Card>
          <T size={11} color={c.muted}>
            This is a fictional demo contact. No message will be sent.
          </T>
          <Button label="Got it" onPress={() => setHelp(false)} />
        </Sheet>
        <Sheet
          visible={switcher}
          onClose={() => setSwitcher(false)}
          title="Explore your workspace"
        >
          <T color={c.muted}>
            Demo only. Explore both sides of the workday. Changes persist on
            this device.
          </T>
          <Button
            icon={UserRound}
            label="Employee · Alex Morgan"
            onPress={() => {
              prefs.setSession("emp-1", "employee");
              setSwitcher(false);
              go("/");
            }}
          />
          <Button
            variant="secondary"
            icon={ShieldCheck}
            label="HR administrator · Kevin Santoso"
            onPress={() => {
              prefs.setSession("emp-5", "admin");
              setSwitcher(false);
              go("/admin");
            }}
          />
          <T size={11} color={c.muted}>
            Demo roles do not provide production authorization.
          </T>
        </Sheet>
      </View>
    </View>
  );
}
