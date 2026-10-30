import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { View } from "react-native";
import { ChevronLeft, ChevronRight, Download, FileText, Presentation, UserRound } from "../components/icons";
import { Modal } from "../components/Modal";
import { Card, Divider, SectionTitle, T } from "../components/ui";
import { formatFileSize } from "../domain/files";
import { isMentimeterUrl } from "../domain/mentimeter";
import type { Material, PagedDoc } from "../domain/eventContent";
import { useEventContent } from "../services/eventInfo";
import { FONT_STACK, useTheme } from "../theme";

// ponytail: mock. Every speaker offers the same sample PDF; when the real files arrive, give each
// speaker their own materials (a list on StoredSpeaker, uploaded in Info acara) and link those here.
const SPEAKER_MATERIAL = "/materi/materi-kecerdasan-buatan.pdf";

// What a checked-in attendee needs during the event: polling, the rundown, materials and speaker CVs.
export function EventGuide() {
  const c = useTheme();
  const content = useEventContent();
  const [cv, setCv] = useState<PagedDoc | null>(null);
  // The speaker whose choices are open; one at a time.
  const [openSpeaker, setOpenSpeaker] = useState<string | null>(null);
  if (!content) return null;
  const { mentimeter_url, rundown, speakers, materials } = content;
  const menti = mentimeter_url && isMentimeterUrl(mentimeter_url) ? mentimeter_url : null;
  const sections: ReactNode[] = [];
  // Lihat CV and Unduh materi under an opened speaker.
  const choice: CSSProperties = {
    flex: "1 1 140px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 999,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface,
    color: c.text,
    fontFamily: FONT_STACK,
    fontWeight: 600,
    fontSize: 14,
    textDecoration: "none",
    cursor: "pointer",
  };
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
  if (rundown)
    sections.push(
      <View key="rundown" style={{ gap: 12 }}>
        <SectionTitle title="Rundown acara" description="Geser untuk halaman berikutnya; cubit layar untuk memperbesar." />
        <PageSlider doc={rundown} />
      </View>,
    );
  if (materials.length)
    sections.push(
      <View key="materials" style={{ gap: 12 }}>
        <SectionTitle title="Materi" description="Unduh materi acara dalam format PDF." />
        <PdfList label="Materi" files={materials} />
      </View>,
    );
  if (speakers.length)
    sections.push(
      <View key="speakers" style={{ gap: 12 }}>
        <SectionTitle title="Narasumber" description="Ketuk nama narasumber untuk melihat CV atau mengunduh materinya." />
        <View role="list" aria-label="Narasumber" style={{ gap: 8 }}>
          {speakers.map((speaker, i) => {
            const open = openSpeaker === speaker.title;
            return (
              <View key={speaker.title} role="listitem" style={{ borderRadius: 12, backgroundColor: c.ground }}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`narasumber-${i}`}
                  onClick={() => setOpenSpeaker(open ? null : speaker.title)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
                    <UserRound size={20} color={c.muted} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={14} weight="semibold">
                      {speaker.title}
                    </T>
                    <T size={12} color={c.muted}>
                      CV dan materi
                    </T>
                  </View>
                  <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
                    <ChevronRight size={20} color={c.muted} />
                  </View>
                </button>
                {open && (
                  <div id={`narasumber-${i}`} style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 12px 12px" }}>
                    <button type="button" aria-label={`Lihat CV ${speaker.title}`} onClick={() => setCv(speaker)} style={choice}>
                      <FileText size={18} color={c.text} />
                      Lihat CV
                    </button>
                    <a href={SPEAKER_MATERIAL} download={`Materi ${speaker.title}.pdf`} aria-label={`Unduh materi ${speaker.title}`} style={choice}>
                      <Download size={18} color={c.text} />
                      Unduh materi
                    </a>
                  </div>
                )}
              </View>
            );
          })}
        </View>
      </View>,
    );
  if (!sections.length) return null;
  return (
    <section aria-label="Panduan acara">
      <Card elevated style={{ gap: 22 }}>
        {sections.flatMap((section, i) => (i ? [<Divider key={`divider-${i}`} />, section] : [section]))}
      </Card>
      {cv && (
        <Modal label={`CV ${cv.title}`} maxWidth={720} onClose={() => setCv(null)}>
          <View style={{ padding: 16, paddingTop: 22, gap: 14 }}>
            <T size={18} weight="extra" accessibilityRole="header" style={{ paddingRight: 56, paddingLeft: 4 }}>
              {cv.title}
            </T>
            <Pages doc={cv} />
          </View>
        </Modal>
      )}
    </section>
  );
}

function PdfList({ label, files }: { label: string; files: Material[] }) {
  const c = useTheme();
  return (
    <View role="list" aria-label={label} style={{ gap: 8 }}>
      {files.map((material, i) => (
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
  );
}

// Each page as an image; the width and height reserve its space before it loads.
function PageImage({ doc, index }: { doc: PagedDoc; index: number }) {
  const c = useTheme();
  return (
    <img
      src={doc.pages[index].src}
      width={doc.pages[index].width}
      height={doc.pages[index].height}
      loading="lazy"
      alt={`${doc.title}, halaman ${index + 1} dari ${doc.pages.length}`}
      style={{ display: "block", width: "100%", height: "auto", borderRadius: 8, border: `1px solid ${c.border}` }}
    />
  );
}

function Pages({ doc }: { doc: PagedDoc }) {
  return (
    <View style={{ gap: 8 }}>
      {doc.pages.map((page, i) => (
        <PageImage key={page.src} doc={doc} index={i} />
      ))}
    </View>
  );
}

// One page at a time: swipe, the arrow buttons, or the arrow keys once focused (as in the event slideshow).
function PageSlider({ doc }: { doc: PagedDoc }) {
  const c = useTheme();
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const count = doc.pages.length;

  function go(target: number) {
    const element = track.current;
    if (!element) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: Math.max(0, Math.min(count - 1, target)) * element.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") go(index + 1);
    if (event.key === "ArrowLeft") go(index - 1);
  }
  const round = (disabled: boolean): CSSProperties => ({
    width: 44,
    height: 44,
    borderRadius: 999,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    opacity: disabled ? 0.35 : 1,
  });
  return (
    <div onKeyDown={onKeyDown} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        ref={track}
        className="intro-track"
        onScroll={(event) => setIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
        style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory" }}
      >
        {doc.pages.map((page, i) => (
          <section key={page.src} aria-roledescription="slide" aria-label={`Halaman ${i + 1} dari ${count}`} style={{ flex: "0 0 100%", minWidth: 0, scrollSnapAlign: "start" }}>
            <PageImage doc={doc} index={i} />
          </section>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button type="button" aria-label="Halaman sebelumnya" disabled={index === 0} onClick={() => go(index - 1)} style={round(index === 0)}>
          <ChevronLeft size={20} color={c.text} />
        </button>
        <T size={14} color={c.muted} aria-live="polite">
          Halaman {index + 1} dari {count}
        </T>
        <button type="button" aria-label="Halaman berikutnya" disabled={index === count - 1} onClick={() => go(index + 1)} style={round(index === count - 1)}>
          <ChevronRight size={20} color={c.text} />
        </button>
      </div>
    </div>
  );
}
