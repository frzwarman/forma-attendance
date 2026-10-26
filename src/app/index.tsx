import { useState } from "react";
import { View } from "react-native";
import { Backdrop, EventHeader } from "../components/Brand";
import { T } from "../components/ui";
import { WhatsAppHelp } from "../components/WhatsAppHelp";
import { CheckIn } from "../features/CheckIn";
import { CheckOut } from "../features/CheckOut";
import { EventIntro } from "../features/intro/EventIntro";
import { EventSlides } from "../features/intro/EventSlides";
import { ThankYou, type CheckInDetails } from "../features/ThankYou";
import { rememberCheckIn, storedCheckIns } from "../services/checkout";
import { useTheme } from "../theme";

export default function Index() {
  const c = useTheme();
  // A phone that already checked someone in opens on the checked-in page: check-out
  // plus the event information. Otherwise the form.
  const [entries, setEntries] = useState(storedCheckIns);
  const [view, setView] = useState<"form" | "checkedIn">(entries.length ? "checkedIn" : "form");
  const [thanks, setThanks] = useState<CheckInDetails>();

  function checkedIn(details: CheckInDetails) {
    if (details.token) rememberCheckIn({ token: details.token, name: details.name, at: details.at });
    setEntries(storedCheckIns());
    setView("checkedIn");
    setThanks(details);
  }

  return (
    <>
      <Backdrop>
        <View style={{ paddingHorizontal: 20, paddingTop: 36, paddingBottom: 104 }}>
          <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 28 }}>
            <EventHeader />
            {view === "form" ? (
              <CheckIn onCheckedIn={checkedIn} />
            ) : (
              <>
                {entries.length > 0 && (
                  <CheckOut
                    key={entries.map((entry) => entry.token).join()}
                    entries={entries}
                    onEmpty={() => {
                      setEntries([]);
                      setView("form");
                    }}
                  />
                )}
                <section
                  aria-label="Informasi acara"
                  style={{ borderRadius: 16, overflow: "hidden", backgroundColor: c.surface, boxShadow: c.shadow }}
                >
                  <EventSlides wide={false} />
                </section>
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
    </>
  );
}
