import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ScrollView, View } from "react-native";
import { Backdrop, EventHeader } from "../components/Brand";
import { Card, T } from "../components/ui";
import { WhatsAppHelp } from "../components/WhatsAppHelp";
import { CheckIn } from "../features/CheckIn";
import { CheckOut, Goodbye, type CheckedOut } from "../features/CheckOut";
import { EventGuide } from "../features/EventGuide";
import { EventIntro } from "../features/intro/EventIntro";
import { KesanPesan } from "../features/KesanPesan";
import { OPENING } from "../features/intro/slides";
import { ThankYou, type CheckInDetails } from "../features/ThankYou";
import { refreshCheckIn, rememberCheckIn, storedCheckIns } from "../services/checkout";
import { inSession, useCurrentSession } from "../services/session";
import { useFormFields } from "../services/settings";
import { useTheme } from "../theme";

// The guest book: Registrasi on the link page at /.
export default function Registrasi() {
  const c = useTheme();
  // A phone that already checked someone in opens on the checked-in page: the event information,
  // Kesan & Pesan and check-out. Otherwise the form.
  const [entries, setEntries] = useState(storedCheckIns);
  const [view, setView] = useState<"form" | "checkedIn">(entries.length ? "checkedIn" : "form");
  const [thanks, setThanks] = useState<CheckInDetails>();
  const [goodbye, setGoodbye] = useState<CheckedOut>();
  // The page changes under a button near the bottom (Kirim, Check out): start the new one at the top.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const toTop = () => scroll.current?.scrollTo({ y: 0, animated: false });
  const fields = useFormFields();
  // Only check-ins of the session under way count. Once an admin starts the next one (Mulai Sesi 1 or 2),
  // the page moves on to the form, so the attendee checks in again for it; nobody is checked out. A page
  // left open does so when looked at again: the session is asked for again on visibilitychange.
  const session = useCurrentSession();
  // After one failed attempt the page goes on without it, keeping every check-in on this phone.
  const sessionKnown = session.isSuccess || session.failureCount > 0;
  const live = entries.filter((entry) => inSession(entry.at, session.data));
  const mode = view === "checkedIn" && (!sessionKnown || live.length) ? "checkedIn" : "form";
  // Moved on to the form while scrolled down the event information: start it at the top.
  useEffect(() => {
    if (mode === "form") toTop();
  }, [mode]);

  function checkedIn(details: CheckInDetails) {
    if (details.token) rememberCheckIn({ token: details.token, name: details.name, at: details.at });
    else refreshCheckIn(details.name, details.at);
    setEntries(storedCheckIns());
    setView("checkedIn");
    setGoodbye(undefined);
    setThanks(details);
    toTop();
  }

  return (
    <>
      <Backdrop scrollRef={scroll}>
        <View style={{ paddingHorizontal: 20, paddingTop: 36, paddingBottom: 104 }}>
          <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 28 }}>
            <EventHeader title={mode === "checkedIn" ? "Informasi acara" : undefined} />
            {mode === "form" ? (
              fields ? (
                // A new form when the admin's questions change, so its rules always match what it shows.
                <CheckIn key={JSON.stringify(fields)} fields={fields} onCheckedIn={checkedIn} />
              ) : (
                <Card elevated>
                  <T color={c.muted}>Memuat formulir…</T>
                </Card>
              )
            ) : !sessionKnown ? (
              <Card elevated>
                <T color={c.muted}>Memuat…</T>
              </Card>
            ) : (
              <>
                <section
                  aria-label="Informasi acara"
                  style={{ borderRadius: 16, overflow: "hidden", backgroundColor: c.surface, boxShadow: c.shadow }}
                >
                  {/* The banner from the opening popup's first slide. */}
                  <img
                    src={OPENING[0].src()}
                    width={OPENING[0].width}
                    height={OPENING[0].height}
                    alt={OPENING[0].alt}
                    style={{ display: "block", width: "100%", height: "auto" }}
                  />
                </section>
                <EventGuide />
                {/* Last: Kesan & Pesan, then check-out at the very bottom. The newest check-in on this phone sends it.
                    No key: CheckOut's key is the same code, and siblings must not share one. */}
                {live.length > 0 && <KesanPesan entry={live[live.length - 1]} />}
                {live.length > 0 && (
                  <CheckOut
                    key={live.map((entry) => entry.token).join()}
                    entries={live}
                    onCheckedOut={setGoodbye}
                    onEmpty={() => {
                      setEntries([]);
                      setView("form");
                      toTop();
                    }}
                  />
                )}
              </>
            )}
            <T size={12} color={c.onBackgroundMuted}>
              Data Anda hanya digunakan untuk keperluan acara ini.
            </T>
          </View>
        </View>
      </Backdrop>
      <WhatsAppHelp />
      <EventIntro />
      {thanks && <ThankYou details={thanks} onClose={() => setThanks(undefined)} />}
      {goodbye && <Goodbye done={goodbye} onClose={() => setGoodbye(undefined)} />}
    </>
  );
}
