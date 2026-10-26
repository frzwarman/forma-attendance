import { Asset } from "expo-asset";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useWindowDimensions } from "react-native";
import { Logo, Sphere, useBrandBackground } from "../../components/Brand";
import { ChevronLeft, ChevronRight, X } from "../../components/icons";
import { Button } from "../../components/ui";
import { FONT_STACK, useTheme } from "../../theme";
import { EVENT, PHOTO_SLIDES } from "./slides";

// Shown once per browser session when the public page opens.
const SEEN_KEY = "guestbook.intro.seen";
function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage unavailable: the slideshow simply shows again next time */
  }
}

export function EventIntro() {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const background = useBrandBackground();
  const [open, setOpen] = useState(() => !alreadySeen());
  const [index, setIndex] = useState(0);
  // Photos load for the current and next slide only, so opening the page stays light.
  const [loaded, setLoaded] = useState(() => new Set([0, 1]));
  const track = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const count = PHOTO_SLIDES.length + 1;

  useEffect(() => {
    if (open) dialog.current?.focus();
  }, [open]);

  if (!open) return null;

  function close() {
    rememberSeen();
    setOpen(false);
  }
  function go(target: number) {
    const element = track.current;
    if (!element) return;
    const next = Math.max(0, Math.min(count - 1, target));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: next * element.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }
  function onScroll() {
    const element = track.current;
    if (!element) return;
    const current = Math.round(element.scrollLeft / element.clientWidth);
    if (current === index) return;
    setIndex(current);
    setLoaded((previous) => new Set([...previous, current, current + 1]));
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") return close();
    if (event.key === "ArrowRight") return go(index + 1);
    if (event.key === "ArrowLeft") return go(index - 1);
    if (event.key !== "Tab") return;
    // Keep keyboard focus inside the dialog while it is open.
    const items = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [role='button'][tabindex='0']") ?? [],
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const slide: CSSProperties = { flex: "0 0 100%", scrollSnapAlign: "start", display: "flex", flexDirection: "column", minWidth: 0 };
  const round: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
  const kvTitle: CSSProperties = {
    margin: 0,
    fontFamily: FONT_STACK,
    fontWeight: 800,
    textTransform: "uppercase",
    fontSize: wide ? 20 : 15,
    lineHeight: 1.35,
    color: "#ffffff",
  };
  const kvWhen: CSSProperties = { margin: 0, fontFamily: FONT_STACK, fontWeight: 700, fontSize: wide ? 20 : 16, color: "#ffffff" };
  const sphere = <Sphere width={wide ? 230 : 112} />;

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundColor: "rgba(0, 18, 33, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Informasi acara"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: wide ? 780 : 440,
          maxHeight: "100%",
          overflowY: "auto",
          backgroundColor: c.surface,
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.45)",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          animation: "reveal 320ms ease-out",
        }}
      >
        <button
          type="button"
          aria-label="Tutup"
          onClick={close}
          style={{ ...round, position: "absolute", top: 12, right: 12, zIndex: 2, border: "none", boxShadow: "0 6px 16px rgba(0, 0, 0, 0.25)" }}
        >
          <X size={20} color={c.text} />
        </button>
        <div
          ref={track}
          className="intro-track"
          onScroll={onScroll}
          style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", flexShrink: 0 }}
        >
          <section
            aria-roledescription="slide"
            aria-label={`Slide 1 dari ${count}`}
            style={{
              ...slide,
              gap: 16,
              justifyContent: "center",
              padding: wide ? "40px 36px" : "22px 20px",
              backgroundColor: c.background,
              backgroundImage: `url(${background})`,
              backgroundSize: "cover",
              backgroundPosition: "left center",
            }}
          >
            {wide ? (
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
                  <Logo width={150} />
                  <h2 style={kvTitle}>{EVENT.title}</h2>
                  <p style={kvWhen}>{EVENT.when}</p>
                </div>
                {sphere}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingRight: 44 }}>
                  <Logo width={118} />
                  {sphere}
                </div>
                <h2 style={kvTitle}>{EVENT.title}</h2>
                <p style={kvWhen}>{EVENT.when}</p>
              </>
            )}
          </section>
          {PHOTO_SLIDES.map((photo, i) => (
            <section key={photo.title} aria-roledescription="slide" aria-label={`Slide ${i + 2} dari ${count}`} style={slide}>
              {loaded.has(i + 1) ? (
                <img
                  src={Asset.fromModule(photo.image).uri}
                  alt={photo.alt}
                  style={{ width: "100%", aspectRatio: wide ? "16 / 7" : "16 / 10", objectFit: "cover", display: "block", backgroundColor: c.background }}
                />
              ) : (
                <div style={{ width: "100%", aspectRatio: wide ? "16 / 7" : "16 / 10", backgroundColor: c.background }} />
              )}
              <div style={{ padding: wide ? "24px 32px 8px" : "20px 20px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
                <h2 style={{ margin: 0, fontFamily: FONT_STACK, fontWeight: 800, fontSize: wide ? 26 : 21, lineHeight: 1.2, color: c.text }}>
                  {photo.title}
                </h2>
                <p style={{ margin: 0, fontFamily: FONT_STACK, fontSize: 15, lineHeight: 1.55, color: c.muted, maxWidth: 560 }}>{photo.body}</p>
              </div>
            </section>
          ))}
        </div>
        <div style={{ padding: wide ? "16px 32px 24px" : "14px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <button type="button" aria-label="Slide sebelumnya" disabled={index === 0} onClick={() => go(index - 1)} style={{ ...round, opacity: index === 0 ? 0.35 : 1 }}>
              <ChevronLeft size={20} color={c.text} />
            </button>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: count }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Ke slide ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => go(i)}
                  style={{ width: 24, height: 24, padding: 0, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <span style={{ display: "block", height: 8, width: i === index ? 20 : 8, borderRadius: 999, backgroundColor: i === index ? c.accent : c.border, transition: "width 200ms ease" }} />
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Slide berikutnya"
              disabled={index === count - 1}
              onClick={() => go(index + 1)}
              style={{ ...round, opacity: index === count - 1 ? 0.35 : 1 }}
            >
              <ChevronRight size={20} color={c.text} />
            </button>
          </div>
          <Button large label="Mulai check-in" onPress={close} />
        </div>
      </div>
    </div>
  );
}
