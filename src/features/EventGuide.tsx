import type { ReactNode } from "react";
import { View } from "react-native";
import { Download, FileText, Presentation } from "../components/icons";
import { Card, Divider, SectionTitle, T } from "../components/ui";
import { formatFileSize } from "../domain/files";
import { isMentimeterUrl } from "../domain/mentimeter";
import { useEventInfo } from "../services/eventInfo";
import { FONT_STACK, useTheme } from "../theme";

// What a checked-in attendee needs during the event: polling and materials.
export function EventGuide() {
  const c = useTheme();
  const { mentimeter_url, materials } = useEventInfo();
  const menti = mentimeter_url && isMentimeterUrl(mentimeter_url) ? mentimeter_url : null;
  const sections: ReactNode[] = [];
  if (menti)
    sections.push(
      <View key="menti" style={{ gap: 14 }}>
        <SectionTitle title="Polling dan tanya jawab" description="Jawab polling dan kirim pertanyaan untuk narasumber di Mentimeter." />
        <a
          href={menti}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            minHeight: 52,
            padding: "0 22px",
            borderRadius: 999,
            backgroundColor: c.background,
            color: c.onBackground,
            fontFamily: FONT_STACK,
            fontWeight: 700,
            fontSize: 16,
            textDecoration: "none",
          }}
        >
          <Presentation size={20} color={c.onBackground} />
          Ikut polling di Mentimeter
        </a>
      </View>,
    );
  if (materials.length)
    sections.push(
      <View key="materials" style={{ gap: 12 }}>
        <SectionTitle title="Materi" description="Unduh materi acara dalam format PDF." />
        <View role="list" aria-label="Materi" style={{ gap: 8 }}>
          {materials.map((material, i) => (
            <View key={i} role="listitem">
              <a
                href={material.url}
                download={material.file_name}
                aria-label={`Unduh ${material.title}`}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: c.ground, textDecoration: "none" }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
                  <FileText size={20} color={c.muted} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={14} weight="semibold">
                    {material.title}
                  </T>
                  <T size={12} color={c.muted}>
                    PDF, {formatFileSize(material.size)}
                  </T>
                </View>
                <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
                  <Download size={18} color={c.text} />
                </View>
              </a>
            </View>
          ))}
        </View>
      </View>,
    );
  if (!sections.length) return null;
  return (
    <section aria-label="Panduan acara">
      <Card elevated style={{ gap: 22 }}>
        {sections.flatMap((section, i) => (i ? [<Divider key={`divider-${i}`} />, section] : [section]))}
      </Card>
    </section>
  );
}
