import { View } from "react-native";
import { Backdrop, EventHeader } from "../components/Brand";
import { WhatsAppHelp } from "../components/WhatsAppHelp";
import { EVote } from "../features/EVote";

// E-Vote on the link page at /.
export default function VotePage() {
  return (
    <>
      <Backdrop>
        <View style={{ paddingHorizontal: 20, paddingTop: 36, paddingBottom: 104 }}>
          <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 28 }}>
            <EventHeader title="E-Vote" />
            <EVote />
          </View>
        </View>
      </Backdrop>
      <WhatsAppHelp />
    </>
  );
}
