import { Link, usePathname } from "expo-router";
import { ChartColumn, ClipboardList, FileText, Gift, LayoutList, LogOut, Palette, Presentation, Vote, type IconComponent } from "../../components/icons";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View, useWindowDimensions, type ViewStyle } from "react-native";
import { Logo } from "../../components/Brand";
import { Button, printAs, Row, T } from "../../components/ui";
import { signOut } from "../../services/adminApi";
import { useSettings } from "../../services/settings";
import { useTheme } from "../../theme";

// The pages by when they are used: during the event, after it, and the set-up done beforehand.
const groups: { title: string; items: [string, string, IconComponent][] }[] = [
  {
    title: "Saat acara",
    items: [
      ["Daftar Check-in", "/admin", LayoutList],
      ["E-Vote", "/admin/evote", Vote],
      ["Hasil E-Vote", "/admin/hasil-evote", ChartColumn],
      ["Undian", "/admin/undian", Gift],
    ],
  },
  { title: "Setelah acara", items: [["Laporan", "/admin/laporan", FileText]] },
  {
    title: "Pengaturan",
    items: [
      ["Formulir", "/admin/formulir", ClipboardList],
      ["Info acara", "/admin/acara", Presentation],
      ["Tampilan", "/admin/tampilan", Palette],
    ],
  },
];

function NavItem({ label, href, icon: Icon, active, compact }: { label: string; href: string; icon: IconComponent; active: boolean; compact: boolean }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link">
        {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: compact ? 12 : 14,
              paddingVertical: compact ? 8 : 11,
              borderRadius: 10,
              backgroundColor: active ? "rgba(255, 255, 255, 0.16)" : hovered ? "rgba(255, 255, 255, 0.08)" : "transparent",
              transitionProperty: "background-color",
              transitionDuration: "150ms",
            } as ViewStyle}
          >
            <Icon size={18} color={active ? "#ffffff" : "rgba(255, 255, 255, 0.72)"} strokeWidth={2} />
            <T size={14} weight={active ? "bold" : "medium"} color={active ? "#ffffff" : "rgba(255, 255, 255, 0.8)"}>
              {label}
            </T>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

// Navy sidebar carries the brand so the content area can stay quiet.
export function AdminShell({ children }: { children: ReactNode }) {
  const c = useTheme();
  const { settings } = useSettings();
  const path = usePathname();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const item = ([label, href, Icon]: [string, string, IconComponent]) => <NavItem key={href} label={label} href={href} icon={Icon} active={path === href} compact={!wide} />;
  // Wide: each group under its title. Narrow: one scrolling row, a thin rule between the groups.
  const nav = wide
    ? groups.map((group) => (
        <View key={group.title} style={{ gap: 4 }}>
          <T size={12} weight="semibold" color="rgba(255, 255, 255, 0.5)" style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
            {group.title}
          </T>
          {group.items.map(item)}
        </View>
      ))
    : groups.flatMap((group, i) => [
        ...(i ? [<View key={`rule-${group.title}`} style={{ width: 1, backgroundColor: "rgba(255, 255, 255, 0.2)", marginVertical: 8, marginHorizontal: 4 }} />] : []),
        ...group.items.map(item),
      ]);
  // data-print: Laporan's Cetak hides the navigation and lets the content run over the pages (global.css).
  const content = (
    <ScrollView {...printAs("page")} style={{ flex: 1, backgroundColor: c.ground }} contentContainerStyle={{ padding: wide ? 32 : 16, paddingBottom: 64 }}>
      <View style={{ width: "100%", maxWidth: 1180, alignSelf: "center", gap: 24 }}>{children}</View>
    </ScrollView>
  );
  if (wide)
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View
          {...printAs("hide")}
          style={{
            width: 256,
            backgroundColor: c.background,
            paddingHorizontal: 16,
            paddingVertical: 24,
            justifyContent: "space-between",
          }}
        >
          <View style={{ gap: 28 }}>
            <View style={{ paddingHorizontal: 6 }}>
              <Logo width={150} />
            </View>
            <View style={{ gap: 18 }}>{nav}</View>
          </View>
          <View style={{ gap: 12, paddingHorizontal: 6 }}>
            <T size={12} color="rgba(255, 255, 255, 0.6)">
              {settings.event_name}
            </T>
            <Button variant="inverse" small icon={LogOut} label="Keluar" onPress={() => void signOut()} />
          </View>
        </View>
        {content}
      </View>
    );
  return (
    <View style={{ flex: 1 }}>
      <View {...printAs("hide")} style={{ backgroundColor: c.background, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 12 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Logo width={104} />
          <Button variant="inverse" small icon={LogOut} label="Keluar" onPress={() => void signOut()} />
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
          {nav}
        </ScrollView>
      </View>
      {content}
    </View>
  );
}
