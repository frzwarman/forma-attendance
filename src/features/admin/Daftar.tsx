import { useState } from "react";
import { View } from "react-native";
import { Badge, Button, Card, Empty, Field, Row, T } from "../../components/ui";
import { exportFileName, exportRows, toCsv, toXlsx } from "../../domain/export";
import { formatWib } from "../../domain/time";
import { signedFileUrl, useCheckIns, useWinners } from "../../services/checkins";
import { downloadFile } from "../../services/download";
import { useSettings } from "../../services/settings";
import { useTheme } from "../../theme";
import type { CheckIn, Winner } from "../../types/guestbook";

const STEP = 200;

export function Daftar() {
  const c = useTheme();
  const checkins = useCheckIns();
  const winners = useWinners();
  const { settings } = useSettings();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(STEP);
  const [error, setError] = useState("");
  const rows = checkins.data ?? [];
  const winnerById = new Map((winners.data ?? []).map((w) => [w.checkin_id, w]));
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((row) => [row.name, row.phone, row.email].some((value) => value.toLowerCase().includes(needle)))
    : rows;

  // Open the tab synchronously so popup blockers allow it, then point it at the signed URL.
  async function openFile(path: string) {
    const tab = window.open("", "_blank");
    try {
      const url = await signedFileUrl(path);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch (cause) {
      tab?.close();
      setError(`Gagal membuka berkas: ${(cause as Error).message}`);
    }
  }

  function exportAs(ext: "csv" | "xlsx") {
    const table = exportRows(rows, winners.data ?? []);
    const name = exportFileName(settings.event_name, ext);
    if (ext === "csv") downloadFile(name, new Blob([toCsv(table)], { type: "text/csv;charset=utf-8" }));
    else
      downloadFile(
        name,
        new Blob([toXlsx(table)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
  }

  return (
    <Card style={{ gap: 16 }}>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <T size={22} weight="bold" accessibilityRole="header">
          Daftar Check-in
        </T>
        <T weight="medium">Total check-in: {rows.length.toLocaleString("id-ID")}</T>
      </Row>
      <Row style={{ gap: 10, flexWrap: "wrap" }}>
        <Button small label="Ekspor Excel" disabled={checkins.isLoading} onPress={() => exportAs("xlsx")} />
        <Button small variant="secondary" label="Ekspor CSV" disabled={checkins.isLoading} onPress={() => exportAs("csv")} />
      </Row>
      {checkins.isError && (
        <T accessibilityRole="alert" color={c.danger}>
          Gagal memuat daftar: {(checkins.error as Error).message}
        </T>
      )}
      {!!error && (
        <T accessibilityRole="alert" color={c.danger}>
          {error}
        </T>
      )}
      <Field
        label="Cari nama, telepon, atau e-mail"
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setShown(STEP);
        }}
        placeholder="Ketik untuk mencari"
        autoCapitalize="none"
      />
      {checkins.isLoading ? (
        <T color={c.muted}>Memuat daftar…</T>
      ) : filtered.length === 0 ? (
        <Empty title="Belum ada check-in" message="Daftar akan terisi saat peserta melakukan check-in." />
      ) : (
        <View>
          {filtered.slice(0, shown).map((row) => (
            <CheckInRow key={row.id} row={row} winner={winnerById.get(row.id)} onOpenFile={openFile} />
          ))}
          {filtered.length > shown && (
            <View style={{ marginTop: 12 }}>
              <Button
                variant="secondary"
                label={`Tampilkan ${Math.min(STEP, filtered.length - shown)} berikutnya`}
                onPress={() => setShown(shown + STEP)}
              />
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

function CheckInRow({ row, winner, onOpenFile }: { row: CheckIn; winner?: Winner; onOpenFile: (path: string) => void }) {
  const c = useTheme();
  return (
    <View style={{ borderTopWidth: 1, borderColor: c.border, paddingVertical: 12, gap: 4 }}>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <T weight="bold">{row.name}</T>
        <T size={12} color={c.muted}>
          {formatWib(row.created_at)}
        </T>
      </Row>
      <T size={13}>
        {row.jabatan} · {row.phone} · {row.email}
      </T>
      <T size={12} color={c.muted}>
        {row.address}
      </T>
      <Row style={{ gap: 10, flexWrap: "wrap" }}>
        <T size={12} color={c.muted}>
          {row.check_in_date} → {row.check_out_date}
        </T>
        {winner && <Badge tone="gold" label={`Pemenang · ${winner.prize || "Undian"}`} />}
        {!!row.file_path && (
          <Button small variant="secondary" label="Lihat berkas" onPress={() => onOpenFile(row.file_path!)} />
        )}
      </Row>
    </View>
  );
}
