import { View } from "react-native";
import { Backdrop, EventHeader } from "../components/Brand";
import { Card, T } from "../components/ui";

export default function Index() {
  return (
    <Backdrop>
      <View style={{ padding: 20, paddingTop: 32, paddingBottom: 48 }}>
        <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 24 }}>
          <EventHeader />
          <Card style={{ gap: 18 }}>
            <T size={18} weight="bold" accessibilityRole="header">
              Formulir Check-in
            </T>
          </Card>
        </View>
      </View>
    </Backdrop>
  );
}
