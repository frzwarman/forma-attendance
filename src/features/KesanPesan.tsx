import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Field, T } from "../components/ui";
import { sendFeedback, type StoredCheckIn } from "../services/checkout";
import { useTheme } from "../theme";

// Kesan & Pesan on the checked-in page, sent with the check-out code this phone holds, so it is
// stored under the attendee's check-in. They can send another one later.
export function KesanPesan({ entry }: { entry: StoredCheckIn }) {
  const c = useTheme();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (sending) return;
    setSent(false);
    if (!message.trim()) return setError("Tulis kesan & pesan Anda dulu.");
    setSending(true);
    setError("");
    try {
      await sendFeedback(entry.token, message.trim());
      setMessage("");
      setSent(true);
    } catch (cause) {
      const { code, message: text } = cause as Error & { code?: string };
      // PGRST202: the database does not have the function yet (migration not applied).
      setError(code === "PGRST202" ? "Kesan & pesan belum bisa dikirim. Coba lagi nanti." : text);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card elevated style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <T size={22} weight="extra" accessibilityRole="header">
          Kesan & Pesan
        </T>
        <T size={14} color={c.muted}>
          Bagikan kesan Anda tentang acara ini dan pesan untuk panitia.
        </T>
      </View>
      <Field
        labelHidden
        label="Kesan & pesan"
        multiline
        value={message}
        onChangeText={(text) => {
          setMessage(text);
          setSent(false);
          setError("");
        }}
        placeholder="Tulis kesan & pesan Anda di sini…"
        maxLength={2000}
        editable={!sending}
        error={error}
        hint={`Dikirim atas nama ${entry.name}.`}
        style={{ minHeight: 120, textAlignVertical: "top" }}
      />
      <Button variant="secondary" label="Kirim kesan & pesan" loading={sending} loadingLabel="Mengirim…" onPress={() => void send()} />
      {sent && (
        <T accessibilityRole="status" color={c.success} weight="semibold">
          Terima kasih! Kesan & pesan Anda sudah terkirim.
        </T>
      )}
    </Card>
  );
}
