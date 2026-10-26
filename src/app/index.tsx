import { useState } from "react";
import { View } from "react-native";
import { Backdrop, EventHeader } from "../components/Brand";
import { T } from "../components/ui";
import { CheckIn } from "../features/CheckIn";
import { CheckOut } from "../features/CheckOut";
import { EventIntro } from "../features/intro/EventIntro";
import { storedCheckIns } from "../services/checkout";
import { useTheme } from "../theme";

export default function Index() {
  const c = useTheme();
  // A phone that already checked someone in opens on check-out instead of the form.
  const [stored] = useState(storedCheckIns);
  const [showForm, setShowForm] = useState(stored.length === 0);
  return (
    <>
      <Backdrop>
        <View style={{ paddingHorizontal: 20, paddingTop: 36, paddingBottom: 56 }}>
          <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 28 }}>
            <EventHeader />
            {showForm ? <CheckIn /> : <CheckOut entries={stored} onNewCheckIn={() => setShowForm(true)} />}
            <T size={12} color={c.onBackgroundMuted}>
              Data Anda hanya digunakan untuk keperluan acara ini.
            </T>
          </View>
        </View>
      </Backdrop>
      <EventIntro />
    </>
  );
}
