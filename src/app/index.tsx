import { Link } from "expo-router";
import { Pressable, View, type ViewStyle } from "react-native";
import { Backdrop, EventHeader } from "../components/Brand";
import { ChevronRight, ClipboardList, Vote, type IconComponent } from "../components/icons";
import { T } from "../components/ui";
import { WhatsAppHelp } from "../components/WhatsAppHelp";
import { useSettings } from "../services/settings";
import { useTheme } from "../theme";

// What the event link and QR code open: the guest book (Registrasi) and E-Vote.
export default function Links() {
  const { settings } = useSettings();
  return (
    <>
      <Backdrop>
        <View style={{ paddingHorizontal: 20, paddingTop: 36, paddingBottom: 104 }}>
          <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 28 }}>
            {/* The event name alone: Tampilan's welcome text is for the registration form. */}
            <EventHeader title={settings.event_name} />
            <View style={{ gap: 14 }}>
              <LinkCard href="/registrasi" icon={ClipboardList} title="Registrasi" description="Isi buku tamu / check-in" />
              <LinkCard href="/vote" icon={Vote} title="E-Vote" description="Berikan suara Anda" />
            </View>
          </View>
        </View>
      </Backdrop>
      <WhatsAppHelp />
    </>
  );
}

function LinkCard({ href, icon: Icon, title, description }: { href: string; icon: IconComponent; title: string; description: string }) {
  const c = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link">
        {({ pressed }: { pressed: boolean }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              minHeight: 76,
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderRadius: 16,
              // Solid on hover too: the theme's hover tint is see-through over the backdrop.
              backgroundColor: c.surface,
              boxShadow: c.shadow,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              transitionProperty: "transform",
              transitionDuration: "150ms",
            } as ViewStyle}
          >
            <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <Icon size={24} color={c.accent} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={17} weight="bold">
                {title}
              </T>
              <T size={13} color={c.muted}>
                {description}
              </T>
            </View>
            <ChevronRight size={22} color={c.muted} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}
