import { useQueryClient } from "@tanstack/react-query";
import { Gift } from "../../components/icons";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useBrandBackground } from "../../components/Brand";
import { Badge, Button, Card, Field, Row, T } from "../../components/ui";
import { maskPhone } from "../../domain/phone";
import { formatWib } from "../../domain/time";
import { useAdminApi, useCheckIns, useWinners } from "../../services/adminContext";
import type { DrawResult } from "../../services/draw";
import { FONT_STACK, useTheme } from "../../theme";

export function Undian() {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const client = useQueryClient();
  const api = useAdminApi();
  const checkins = useCheckIns();
  const winners = useWinners();
  const background = useBrandBackground();
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
      setResult(await api.drawWinner(prize.trim()));
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
      await api.removeWinner(id);
      if (result?.status === "drawn" && result.winner.id === id) setResult(undefined);
      await client.invalidateQueries({ queryKey: ["winners"] });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  const list = winners.data ?? [];
  const total = (checkins.data ?? []).length;
  const remaining = Math.max(0, total - list.length);
  const stage = (
    <div
      style={{
        flex: 1,
        minHeight: wide ? 360 : 260,
        borderRadius: 20,
        padding: 32,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 10,
        color: c.onBackground,
        backgroundColor: c.background,
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        fontFamily: FONT_STACK,
      }}
    >
      {result?.status === "drawn" ? (
        <div key={result.winner.id} style={{ animation: "reveal 420ms ease-out", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <T size={14} weight="semibold" color={c.onBackgroundMuted}>
            {result.winner.prize || "Pemenang"}
          </T>
          <T testID="winner-name" size={wide ? 56 : 36} weight="extra" color={c.gold} style={{ textAlign: "center" }}>
            {result.checkin.name}
          </T>
          <T testID="winner-phone" size={15} color={c.onBackgroundMuted}>
            {maskPhone(result.checkin.phone)}
          </T>
        </div>
      ) : (
        <T size={16} color={c.onBackgroundMuted} style={{ textAlign: "center", maxWidth: 360 }}>
          {checkins.isLoading
            ? "Memuat peserta…"
            : total === 0
              ? "Belum ada peserta yang check-in."
              : result?.status === "empty"
                ? "Semua peserta sudah mendapat hadiah."
                : `Tekan Undi untuk memilih satu dari ${remaining.toLocaleString("id-ID")} peserta secara acak.`}
        </T>
      )}
    </div>
  );

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 2 }}>
        <T size={28} weight="extra" accessibilityRole="header">
          Undian
        </T>
        <T size={14} color={c.muted}>
          Satu peserta dipilih secara acak oleh basis data; pemenang tidak akan terpilih dua kali.
        </T>
      </View>
      <Row style={{ gap: 20, alignItems: "stretch", flexDirection: wide ? "row" : "column" }}>
        <Card style={{ gap: 16, width: wide ? 340 : undefined, alignSelf: wide ? "flex-start" : "stretch" }}>
          <Field label="Nama hadiah" value={prize} onChangeText={setPrize} editable={!busy} placeholder="Hadiah 1" />
          <Button
            large
            icon={Gift}
            label="Undi"
            loading={busy}
            loadingLabel="Mengundi…"
            disabled={checkins.isLoading || total === 0}
            onPress={() => void draw()}
          />
          <T size={13} color={c.muted}>
            Sisa peserta yang belum menang: {remaining.toLocaleString("id-ID")}
          </T>
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
        </Card>
        {stage}
      </Row>
      <Card style={{ gap: 12 }}>
        <T size={17} weight="bold" accessibilityRole="header">
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
                gap: 10,
                borderTopWidth: 1,
                borderColor: c.border,
                paddingVertical: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
                <T weight="bold">{personById.get(winner.checkin_id)?.name ?? "Peserta"}</T>
                <Row style={{ gap: 8, flexWrap: "wrap" }}>
                  <Badge tone="gold" label={winner.prize || "Undian"} />
                  <T size={12} color={c.muted}>
                    {formatWib(winner.drawn_at)}
                  </T>
                </Row>
              </View>
              <Button small variant="danger" label="Hapus" onPress={() => void remove(winner.id)} />
            </Row>
          ))
        )}
      </Card>
    </View>
  );
}
