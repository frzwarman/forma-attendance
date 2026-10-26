import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Field, Row, T } from "../../components/ui";
import { maskPhone } from "../../domain/phone";
import { formatWib } from "../../domain/time";
import { useCheckIns, useWinners } from "../../services/checkins";
import { drawWinner, removeWinner, type DrawResult } from "../../services/draw";
import { useTheme } from "../../theme";

export function Undian() {
  const c = useTheme();
  const client = useQueryClient();
  const checkins = useCheckIns();
  const winners = useWinners();
  const [prize, setPrize] = useState("Hadiah 1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DrawResult>();
  const personById = new Map((checkins.data ?? []).map((row) => [row.id, row]));

  async function draw() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setResult(await drawWinner(prize.trim()));
      await client.invalidateQueries({ queryKey: ["winners"] });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await removeWinner(id);
      if (result?.status === "drawn" && result.winner.id === id) setResult(undefined);
      await client.invalidateQueries({ queryKey: ["winners"] });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  const list = winners.data ?? [];
  return (
    <View style={{ gap: 20 }}>
      <Card style={{ gap: 16 }}>
        <T size={22} weight="bold" accessibilityRole="header">
          Undian
        </T>
        <Field label="Nama hadiah" value={prize} onChangeText={setPrize} editable={!busy} />
        <Button label="Undi" loading={busy} loadingLabel="Mengundi…" onPress={() => void draw()} />
        {!!error && (
          <T accessibilityRole="alert" color={c.danger}>
            {error}
          </T>
        )}
        {result?.status === "empty" && (
          <T accessibilityRole="alert" color={c.danger}>
            Semua peserta sudah mendapat hadiah.
          </T>
        )}
        {result?.status === "drawn" && (
          <View style={{ backgroundColor: c.background, borderRadius: 6, padding: 28, alignItems: "center", gap: 6 }}>
            <T size={14} color={c.onBackground}>
              {result.winner.prize || "Pemenang"}
            </T>
            <T testID="winner-name" size={48} weight="bold" color={c.gold} style={{ textAlign: "center" }}>
              {result.checkin.name}
            </T>
            <T size={18} color={c.onBackground}>
              {result.checkin.jabatan}
            </T>
            <T testID="winner-phone" size={18} color={c.onBackground}>
              {maskPhone(result.checkin.phone)}
            </T>
          </View>
        )}
      </Card>
      <Card style={{ gap: 12 }}>
        <T size={16} weight="bold" accessibilityRole="header">
          Pemenang sebelumnya
        </T>
        {list.length === 0 ? (
          <T color={c.muted}>Belum ada pemenang.</T>
        ) : (
          list.map((winner) => (
            <Row
              key={winner.id}
              testID="winner-row"
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                borderTopWidth: 1,
                borderColor: c.border,
                paddingVertical: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 180 }}>
                <T weight="bold">{personById.get(winner.checkin_id)?.name ?? "Peserta"}</T>
                <T size={12} color={c.muted}>
                  {winner.prize || "Undian"} · {formatWib(winner.drawn_at)}
                </T>
              </View>
              <Button small variant="danger" label="Hapus" onPress={() => void remove(winner.id)} />
            </Row>
          ))
        )}
      </Card>
    </View>
  );
}
