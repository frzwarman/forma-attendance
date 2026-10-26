import { Link, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Backdrop, Logo } from "../../components/Brand";
import { Button, Card, Row, T } from "../../components/ui";
import { signOut } from "../../services/adminApi";
import { useSettings } from "../../services/settings";
import { useTheme } from "../../theme";

const items = [
  ["Daftar Check-in", "/admin"],
  ["Undian", "/admin/undian"],
  ["Tampilan", "/admin/tampilan"],
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const c = useTheme();
  const { settings } = useSettings();
  const path = usePathname();
  return (
    <Backdrop>
      <View style={{ padding: 20, paddingBottom: 48 }}>
        <View style={{ width: "100%", maxWidth: 1100, alignSelf: "center", gap: 20 }}>
          <Card style={{ padding: 16 }}>
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
              <Row style={{ gap: 14, flexWrap: "wrap" }}>
                <Logo width={120} />
                <T weight="bold">{settings.event_name}</T>
              </Row>
              <Row style={{ gap: 6, flexWrap: "wrap" }}>
                {items.map(([label, href]) => {
                  const active = path === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 100,
                        backgroundColor: active ? c.accent : "transparent",
                        color: active ? c.onAccent : c.text,
                        fontFamily: "Arial",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {label}
                    </Link>
                  );
                })}
                <Button small variant="ghost" label="Keluar" onPress={() => void signOut()} />
              </Row>
            </Row>
          </Card>
          {children}
        </View>
      </View>
    </Backdrop>
  );
}
