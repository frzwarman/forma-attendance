import { useState } from "react";
import { View } from "react-native";
import { CircleCheck } from "../components/icons";
import { Modal } from "../components/Modal";
import { Button, Card, Row, T } from "../components/ui";
import { formatWib } from "../domain/time";
import { checkOut, forgetCheckIn, type StoredCheckIn } from "../services/checkout";
import { useTheme } from "../theme";

export type CheckedOut = { name: string; at: string; already: boolean };

// Popup after a check-out, like the thank-you one after a check-in.
export function Goodbye({ done, onClose }: { done: CheckedOut; onClose: () => void }) {
  const c = useTheme();
  return (
    <Modal label="Check-out berhasil" maxWidth={440} onClose={onClose}>
      <View style={{ padding: 24, paddingTop: 28, gap: 18 }}>
        <CircleCheck size={48} color={c.success} strokeWidth={2} />
        <View style={{ gap: 6 }}>
          <T size={26} weight="extra" accessibilityRole="header">
            Sampai jumpa, {done.name}!
          </T>
          <T color={c.muted}>
            {done.already ? "Check-out sudah tercatat" : "Check-out tercatat"} pada {formatWib(done.at)}. Terima kasih atas kehadiran Anda.
          </T>
        </View>
        <Button large label="Selesai" onPress={onClose} />
      </View>
    </Modal>
  );
}

// Shown instead of the form when this phone holds a check-in that has not checked out. Each
// check-out goes to onCheckedOut (the popup); once none is left, onEmpty takes the page back to
// the form, for the next session.
export function CheckOut({
  entries,
  onCheckedOut,
  onEmpty,
}: {
  entries: StoredCheckIn[];
  onCheckedOut: (done: CheckedOut) => void;
  onEmpty: () => void;
}) {
  const c = useTheme();
  const [pending, setPending] = useState<StoredCheckIn[]>(entries);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<{ token: string; message: string }>();

  async function submit(entry: StoredCheckIn) {
    if (busy) return;
    setBusy(entry.token);
    setError(undefined);
    try {
      const result = await checkOut(entry.token);
      forgetCheckIn(entry.token);
      onCheckedOut({ name: result.name, at: result.checked_out_at, already: result.status === "already" });
      const rest = pending.filter((item) => item.token !== entry.token);
      if (!rest.length) return onEmpty();
      setPending(rest);
    } catch (cause) {
      setError({ token: entry.token, message: (cause as Error).message });
    } finally {
      setBusy("");
    }
  }

  function remove(token: string) {
    forgetCheckIn(token);
    setError(undefined);
    const rest = pending.filter((item) => item.token !== token);
    setPending(rest);
    if (!rest.length) onEmpty();
  }

  return (
    <Card elevated style={{ gap: 18 }}>
      {pending.length > 0 && (
        <View style={{ gap: 14 }}>
          <T size={22} weight="extra" accessibilityRole="header">
            Anda sudah check-in
          </T>
          <T size={14} color={c.muted}>
            Tekan check-out saat meninggalkan lokasi acara.
          </T>
          {pending.map((entry) => (
            <View key={entry.token} style={{ gap: 10, padding: 14, borderRadius: 12, backgroundColor: c.ground }}>
              <Row style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <T weight="bold">{entry.name}</T>
                <T size={13} color={c.muted}>
                  Check-in {formatWib(entry.at)}
                </T>
              </Row>
              <Button
                large
                label={pending.length === 1 ? "Check out sekarang" : `Check out ${entry.name}`}
                loading={busy === entry.token}
                loadingLabel="Mencatat check-out…"
                onPress={() => void submit(entry)}
              />
              {error?.token === entry.token && (
                <View style={{ gap: 8 }}>
                  <T size={13} color={c.danger} accessibilityRole="alert">
                    {error.message}. Hubungi panitia untuk check-out.
                  </T>
                  <Button small variant="ghost" label="Hapus dari HP ini" onPress={() => remove(entry.token)} />
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
