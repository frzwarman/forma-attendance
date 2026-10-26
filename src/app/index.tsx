import { View } from "react-native";
import { Backdrop, EventHeader } from "../components/Brand";
import { CheckIn } from "../features/CheckIn";

export default function Index() {
  return (
    <Backdrop>
      <View style={{ padding: 20, paddingTop: 32, paddingBottom: 48 }}>
        <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 24 }}>
          <EventHeader />
          <CheckIn />
        </View>
      </View>
    </Backdrop>
  );
}
