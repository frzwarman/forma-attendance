import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Row, T } from "../components/ui";
import { formatWib } from "../domain/time";
import { checkOut, forgetCheckIn, type StoredCheckIn } from "../services/checkout";
import { useTheme } from "../theme";

// Shown instead of the form when this phone holds a check-in that has not checked out.
export function CheckOut({ entries, onEmpty }: { entries: StoredCheckIn[]; onEmpty: () => void }) {
  const c = useTheme();
  const [pending, setPending] = useState<StoredCheckIn[]>(entries);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<{ token: string; message: string }>();
  const [done, setDone] = useState<{ name: string; at: string; already: boolean }>();

  async function submit(entry: StoredCheckIn) {
    if (busy) return;
    setBusy(entry.token);
    setError(undefined);
    try {
      const result = await checkOut(entry.token);
      forgetCheckIn(entry.token);
      setPending((list) => list.filter((item) => item.token !== entry.token));
      setDone({ name: result.name, at: result.checked_out_at, already: result.status === "already" });
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
    if (!rest.length && !done) onEmpty();
  }

  return (
    <Card elevated style={{ gap: 18 }}>
      {done && (
        <View style={{ gap: 6 }}>
          <T size={26} weight="extra" accessibilityRole="header">
            Sampai jumpa, {done.name}!
          </T>
          <T color={c.muted}>
            {done.already ? "Check-out sudah tercatat" : "Check-out tercatat"} pada {formatWib(done.at)}. Terima kasih atas kehadiran Anda.
          </T>
        </View>
      )}
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
