import { whatsappLink } from "../domain/phone";
import { useSettings } from "../services/settings";
import { FONT_STACK } from "../theme";
import { MessageCircle } from "./icons";

// Always-visible help button in the bottom-right corner when an organiser number is set.
// WhatsApp-like green dark enough for white text (5.2:1 contrast).
export function WhatsAppHelp() {
  const { settings } = useSettings();
  if (!settings.whatsapp_number) return null;
  return (
    <a
      href={whatsappLink(settings.whatsapp_number)}
      target="_blank"
      rel="noreferrer"
      aria-label="Hubungi Panitia via WhatsApp"
      style={{
        position: "fixed",
        right: 16,
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        zIndex: 900,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 48,
        padding: "0 18px 0 14px",
        borderRadius: 999,
        backgroundColor: "#0B7A6E",
        color: "#ffffff",
        fontFamily: FONT_STACK,
        fontWeight: 700,
        fontSize: 15,
        textDecoration: "none",
        boxShadow: "0 12px 28px rgba(0, 0, 0, 0.3)",
      }}
    >
      <MessageCircle size={22} color="#ffffff" />
      Hubungi panitia
    </a>
  );
}
