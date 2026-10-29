import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Logo, Sphere, useBrandBackground } from "../../components/Brand";
import { ChevronLeft, ChevronRight } from "../../components/icons";
import type { Speaker } from "../../services/eventInfo";
import { FONT_STACK, useTheme } from "../../theme";
import { EVENT } from "./slides";

// The event information carousel: swipe, arrows, dots, and arrow keys once focused.
// In the opening popup the speakers come first, one per slide with the name-and-photo
// part of their CV, then the Bawaslu title card; after check-in the page shows the
// title card alone.
export function EventSlides({
  wide,
  action,
  reserveCloseButton = false,
  speakers = [],
}: {
  wide: boolean;
  action?: ReactNode;
  reserveCloseButton?: boolean;
  speakers?: Speaker[];
}) {
  const c = useTheme();
  const background = useBrandBackground();
  const [index, setIndex] = useState(0);
  // Speaker images load for the current and next slide only, so the page stays light.
  const [loaded, setLoaded] = useState(() => new Set([0, 1]));
  const track = useRef<HTMLDivElement>(null);
  const count = speakers.length + 1;
  // The track takes the height of the slide on screen, so the popup fits each slide's content.
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const current = track.current?.children[index];
    if (!(current instanceof HTMLElement)) return;
    const observer = new ResizeObserver(() => setHeight(current.offsetHeight));
    observer.observe(current);
    return () => observer.disconnect();
  }, [index]);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
    if (event.key === "ArrowRight") go(index + 1);
    if (event.key === "ArrowLeft") go(index - 1);
  }

  // border-box: the title card's padding must not widen it past the track, or the last slide never lines up.
  const slide: CSSProperties = { flex: "0 0 100%", boxSizing: "border-box", scrollSnapAlign: "start", display: "flex", flexDirection: "column", minWidth: 0 };
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
  const pad = wide ? 32 : 20;

  return (
    <div onKeyDown={onKeyDown} style={{ display: "flex", flexDirection: "column" }}>
      <div
        ref={track}
        className="intro-track"
        onScroll={onScroll}
        style={{
          display: "flex",
          alignItems: "flex-start",
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          flexShrink: 0,
          height,
          transition: reduceMotion ? undefined : "height 220ms ease",
        }}
      >
        {speakers.map((speaker, i) => (
          <section key={speaker.title} aria-roledescription="slide" aria-label={`Slide ${i + 1} dari ${count}`} style={slide}>
            <div style={{ padding: `${wide ? 24 : 20}px ${reserveCloseButton ? 64 : pad}px 12px ${pad}px`, display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontFamily: FONT_STACK, fontWeight: 800, fontSize: wide ? 24 : 19, lineHeight: 1.25, color: c.text }}>
                {speaker.title}
              </h2>
              <p style={{ margin: 0, fontFamily: FONT_STACK, fontSize: 14, color: c.muted }}>CV lengkap tersedia setelah check-in.</p>
            </div>
            {/* Only the name-and-photo part of the CV; a tall one is capped so the dots and Mulai check-in stay on screen. */}
            <div style={{ display: "flex", justifyContent: "center", padding: `4px ${pad}px 12px` }}>
              {loaded.has(i) && (
                <img
                  src={speaker.profile.src}
                  width={speaker.profile.width}
                  height={speaker.profile.height}
                  alt={`Profil ${speaker.title}`}
                  style={{
                    display: "block",
                    width: "auto",
                    height: "auto",
                    maxWidth: "100%",
                    maxHeight: "max(200px, min(480px, calc(100dvh - 320px)))",
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                  }}
                />
              )}
            </div>
          </section>
        ))}
        <section
          aria-roledescription="slide"
          aria-label={`Slide ${count} dari ${count}`}
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  paddingRight: reserveCloseButton ? 44 : 0,
                }}
              >
                <Logo width={118} />
                {sphere}
              </div>
              <h2 style={kvTitle}>{EVENT.title}</h2>
              <p style={kvWhen}>{EVENT.when}</p>
            </>
          )}
        </section>
      </div>
      {(count > 1 || action) && (
        <div style={{ padding: wide ? "16px 32px 24px" : "14px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {count > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <button type="button" aria-label="Slide sebelumnya" aria-disabled={index === 0} onClick={() => go(index - 1)} style={{ ...round, opacity: index === 0 ? 0.35 : 1 }}>
                <ChevronLeft size={20} color={c.text} />
              </button>
              {/* A dot per speaker no longer fits beside the arrows on a phone, so it counts instead. */}
              {!wide ? (
                <p aria-live="polite" style={{ margin: 0, fontFamily: FONT_STACK, fontSize: 14, color: c.muted }}>
                  {index + 1} dari {count}
                </p>
              ) : (
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
              )}
              {/* aria-disabled, not disabled: a disabled button drops focus out of the popup, and Escape with it. */}
              <button
                type="button"
                aria-label="Slide berikutnya"
                aria-disabled={index === count - 1}
                onClick={() => go(index + 1)}
                style={{ ...round, opacity: index === count - 1 ? 0.35 : 1 }}
              >
                <ChevronRight size={20} color={c.text} />
              </button>
            </div>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
