import { View } from "react-native";
import { Backdrop, EventHeader } from "../components/Brand";
import { WhatsAppHelp } from "../components/WhatsAppHelp";
import { voteTitle } from "../domain/evote";
import { EVote } from "../features/EVote";
import { useCurrentPoll } from "../services/evote";

// E-Vote on the link page at /.
export default function VotePage() {
  // The same query as EVote below (one request); the admin's title heads the page while a vote is loaded.
  const poll = useCurrentPoll();
  return (
    <>
      <Backdrop>
        <View style={{ paddingHorizontal: 20, paddingTop: 36, paddingBottom: 104 }}>
          <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 28 }}>
            <EventHeader title={poll.data ? voteTitle(poll.data, "E-Vote") : "E-Vote"} />
            <EVote />
          </View>
        </View>
      </Backdrop>
      <WhatsAppHelp />
    </>
  );
}
