import { View } from "react-native";
import { Backdrop, EventHeader } from "../components/Brand";
import { T } from "../components/ui";
import { CheckIn } from "../features/CheckIn";
import { useTheme } from "../theme";

export default function Index() {
  const c = useTheme();
  return (
    <Backdrop>
      <View style={{ paddingHorizontal: 20, paddingTop: 36, paddingBottom: 56 }}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 28 }}>
          <EventHeader />
          <CheckIn />
          <T size={12} color={c.onBackgroundMuted}>
            Data Anda hanya digunakan untuk keperluan acara ini.
          </T>
        </View>
      </View>
    </Backdrop>
  );
}
