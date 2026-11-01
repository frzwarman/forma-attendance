import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "../../components/icons";
import type { Speaker } from "../../domain/eventContent";
import { FONT_STACK, useTheme } from "../../theme";
import { BANNER, CLOSING, INTRO, type SlidePicture, type SlideVideo } from "./slides";

type Picture = { src: string; width: number; height: number; alt: string };

// The opening popup's carousel: swipe, arrows, dots, and arrow keys once focused. The two
// animations in ./slides.ts, then the speakers, one per slide with the name-and-photo
// part of their CV, then the closing picture, which comes with the action (Mulai check-in).
//
// Every slide gets the same height, so the centred popup keeps its size and the arrows stay
// put: when it resized to each slide, they jumped under the finger and the next tap missed.
export function EventSlides({
  wide,
  action,
  speakers = [],
}: {
  wide: boolean;
  // Takes the place of the counter and the next arrow on the last slide, e.g. Mulai check-in.
  action?: ReactNode;
  speakers?: Speaker[];
}) {
  const c = useTheme();
  const [index, setIndex] = useState(0);
  // Images load for the current and next slide only, so the page stays light.
  const [loaded, setLoaded] = useState(() => new Set([0, 1]));
  const track = useRef<HTMLDivElement>(null);
  // The slide an arrow tap is heading to. A second quick tap counts on from there, not from the slide
  // still on screen while the first one scrolls (which would turn two taps into one step).
  const aim = useRef<number | null>(null);
  const videos = [INTRO, BANNER];
  // The animations come first, then the speakers from here.
  const first = videos.length;
  const count = first + speakers.length + 1;
  const last = index === count - 1;
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function go(target: number) {
    const element = track.current;
    if (!element) return;
    const next = Math.max(0, Math.min(count - 1, target));
    aim.current = next;
    element.scrollTo({ left: next * element.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  }
  function onScroll() {
    const element = track.current;
    if (!element) return;
    const current = Math.round(element.scrollLeft / element.clientWidth);
    if (aim.current === current && Math.abs(element.scrollLeft - current * element.clientWidth) < 2) aim.current = null;
    if (current === index) return;
    setIndex(current);
    setLoaded((previous) => new Set([...previous, current, current + 1]));
  }
  const step = (by: number) => go((aim.current ?? index) + by);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") step(1);
    if (event.key === "ArrowLeft") step(-1);
  }

  // border-box: a slide's padding must not widen it past the track, or the last one never lines up.
  const slide: CSSProperties = { flex: "0 0 100%", boxSizing: "border-box", scrollSnapAlign: "start", display: "flex", flexDirection: "column", minWidth: 0 };
  const round: CSSProperties = {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 999,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
  const pad = wide ? 32 : 20;
  // The room around a wide picture filled with a blurred, darkened copy of it rather than empty bands.
  const blurred: CSSProperties = { position: "absolute", inset: -24, width: "calc(100% + 48px)", height: "calc(100% + 48px)", objectFit: "cover", filter: "blur(18px) brightness(0.55)" };

  // A picture fits inside its slide whole.
  const show = (picture: Picture) => (
    <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
      <img {...picture} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
  const pictureSlide = (picture: SlidePicture, n: number) => (
    <section
      key={picture.alt}
      aria-roledescription="slide"
      aria-label={`Slide ${n + 1} dari ${count}`}
      style={{ ...slide, position: "relative", overflow: "hidden", backgroundColor: c.background }}
    >
      {loaded.has(n) && <img src={picture.src()} alt="" aria-hidden style={blurred} />}
      {loaded.has(n) && show({ src: picture.src(), width: picture.width, height: picture.height, alt: picture.alt })}
    </section>
  );

  return (
    <div onKeyDown={onKeyDown} style={{ display: "flex", flexDirection: "column" }}>
      <div
        ref={track}
        className="intro-track"
        onScroll={onScroll}
        // A swipe takes over from an arrow tap still under way.
        onPointerDown={() => (aim.current = null)}
        onTouchStart={() => (aim.current = null)}
        style={{
          display: "flex",
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          flexShrink: 0,
          // Short enough for the arrows below on small phones.
          height: wide ? "min(480px, calc(100dvh - 220px))" : "min(380px, calc(100dvh - 200px))",
        }}
      >
        {videos.map((clip, i) => (
          <section
            key={clip.label}
            aria-roledescription="slide"
            aria-label={`Slide ${i + 1} dari ${count}`}
            style={{ ...slide, position: "relative", overflow: "hidden", backgroundColor: c.background }}
          >
            <img src={clip.poster()} alt="" aria-hidden style={blurred} />
            {loaded.has(i) && <LoopingVideo clip={clip} reduceMotion={reduceMotion} active={index === i} />}
          </section>
        ))}
        {speakers.map((speaker, i) => (
          <section key={speaker.title} aria-roledescription="slide" aria-label={`Slide ${first + i + 1} dari ${count}`} style={slide}>
            <div style={{ padding: `${wide ? 24 : 20}px ${pad}px 12px`, display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontFamily: FONT_STACK, fontWeight: 800, fontSize: wide ? 24 : 19, lineHeight: 1.25, color: c.text }}>
                {speaker.title}
              </h2>
              <p style={{ margin: 0, fontFamily: FONT_STACK, fontSize: 14, color: c.muted }}>CV lengkap tersedia setelah check-in.</p>
            </div>
            {/* Only the name-and-photo part of the CV, fitted into the rest of the slide. */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: `4px ${pad}px 12px` }}>
              {loaded.has(first + i) && show({ ...speaker.profile, alt: `Profil ${speaker.title}` })}
            </div>
          </section>
        ))}
        {pictureSlide(CLOSING, count - 1)}
      </div>
      {/* minHeight: the row is as tall on every slide, including the last with its bigger button. */}
      <div style={{ padding: wide ? "16px 32px 24px" : "14px 20px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 54 }}>
        <button type="button" aria-label="Slide sebelumnya" aria-disabled={index === 0} onClick={() => step(-1)} style={{ ...round, opacity: index === 0 ? 0.35 : 1 }}>
          <ChevronLeft size={20} color={c.text} />
        </button>
        {last && action ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{action}</div>
        ) : (
          <>
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
            {/* aria-disabled, not disabled: a disabled button drops focus out of the popup. */}
            <button type="button" aria-label="Slide berikutnya" aria-disabled={last} onClick={() => step(1)} style={{ ...round, opacity: last ? 0.35 : 1 }}>
              <ChevronRight size={20} color={c.text} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// An animation slide. Its small poster shows while the video (about 250 KB) downloads, with the popup for
// the first two slides.
// It loops, like the GIF it was made from, while its slide is showing, and pauses on the others. With
// reduced motion, or where the video cannot load or play (autoplay refused, as in iOS Low Power Mode), its
// last frame (the logos) shows as a picture instead, and the video is not downloaded.
//
// The file is fetched whole and played from memory: Cloudflare's static assets ignore Range requests,
// which a video played from its URL relies on (Safari stalls on the poster, Chrome re-downloads at every loop).
function LoopingVideo({ clip, reduceMotion, active }: { clip: SlideVideo; reduceMotion: boolean; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(reduceMotion);
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (still) return;
    // AV1 where supported, H.264 elsewhere (older Safari).
    const av1 = 'video/webm; codecs="av01.0.04M.08"';
    const [url, type] = document.createElement("video").canPlayType(av1) ? [clip.webm(), av1] : [clip.mp4(), "video/mp4"];
    let objectUrl: string | undefined;
    let cancelled = false;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type }));
        setSrc(objectUrl);
      })
      .catch(() => !cancelled && setStill(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clip, still]);
  useEffect(() => {
    const element = video.current;
    if (still || !src || !element) return;
    if (!active) return element.pause();
    // Muted before play(): browsers only start silent video on their own. A pause() before play()
    // settles rejects it with AbortError, which is no reason to give up on the video.
    element.muted = true;
    element.play().catch((error: Error) => error.name !== "AbortError" && setStill(true));
  }, [active, src, still]);
  const fit: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" };
  return still ? (
    <img src={clip.end()} alt={clip.label} style={fit} />
  ) : (
    <video ref={video} src={src} aria-label={clip.label} poster={clip.poster()} muted loop playsInline style={fit} />
  );
}
