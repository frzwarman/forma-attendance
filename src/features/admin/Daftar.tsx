import { CalendarCheck, FileSpreadsheet, FileText, Paperclip, Search, Trophy, Users } from "../../components/icons";
import { useState, type CSSProperties } from "react";
import { View, useWindowDimensions } from "react-native";
import { Badge, Button, Card, Empty, Field, Row, Stat, T } from "../../components/ui";
import { exportFileName, exportRows, toCsv, toXlsx } from "../../domain/export";
import { formatDateRange, formatWib } from "../../domain/time";
import { useAdminApi, useCheckIns, useWinners } from "../../services/adminContext";
import { downloadFile } from "../../services/download";
import { useSettings } from "../../services/settings";
import { FONT_STACK, useTheme } from "../../theme";
import type { CheckIn, Winner } from "../../types/guestbook";

const STEP = 200;

export function Daftar() {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const api = useAdminApi();
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
  const todayKey = formatWib(new Date().toISOString()).slice(0, 10);
  const today = rows.filter((row) => formatWib(row.created_at).slice(0, 10) === todayKey).length;
  const withFiles = rows.filter((row) => row.file_path).length;

  // Open the tab synchronously so popup blockers allow it, then point it at the signed URL.
  async function openFile(path: string) {
    const tab = window.open("", "_blank");
    try {
      const url = await api.signedFileUrl(path);
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

  const visible = filtered.slice(0, shown);
  return (
    <View style={{ gap: 20 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <View style={{ gap: 2 }}>
          <T size={28} weight="extra" accessibilityRole="header">
            Daftar Check-in
          </T>
          <T size={14} color={c.muted}>
            Total check-in: {rows.length.toLocaleString("id-ID")}
          </T>
        </View>
        <Row style={{ gap: 10, flexWrap: "wrap" }}>
          <Button small icon={FileSpreadsheet} label="Ekspor Excel" disabled={checkins.isLoading} onPress={() => exportAs("xlsx")} />
          <Button small variant="secondary" icon={FileText} label="Ekspor CSV" disabled={checkins.isLoading} onPress={() => exportAs("csv")} />
        </Row>
      </Row>
      <Row style={{ gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label="Total peserta" value={rows.length.toLocaleString("id-ID")} icon={Users} hint="Diperbarui setiap 10 detik" />
        <Stat label="Check-in hari ini" value={today.toLocaleString("id-ID")} icon={CalendarCheck} hint="Waktu Indonesia Barat" />
        <Stat label="Dengan berkas" value={withFiles.toLocaleString("id-ID")} icon={Paperclip} hint="Lampiran yang diunggah" />
        <Stat label="Pemenang undian" value={(winners.data ?? []).length.toLocaleString("id-ID")} icon={Trophy} tone="gold" hint="Lihat halaman Undian" />
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
      <Card style={{ gap: 16, padding: wide ? 20 : 16 }}>
        <Field
          label="Cari nama, telepon, atau e-mail"
          labelHidden
          placeholder="Cari nama, telepon, atau e-mail"
          leading={<Search size={16} color={c.muted} strokeWidth={2} />}
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setShown(STEP);
          }}
          autoCapitalize="none"
        />
        {checkins.isLoading ? (
          <T color={c.muted}>Memuat daftar…</T>
        ) : filtered.length === 0 ? (
          <Empty
            title={needle ? "Tidak ada yang cocok" : "Belum ada check-in"}
            message={needle ? "Coba kata kunci lain." : "Bagikan tautan halaman check-in; peserta akan muncul di sini begitu mengisi formulir."}
          />
        ) : wide ? (
          <CheckInTable rows={visible} winnerById={winnerById} onOpenFile={openFile} />
        ) : (
          <View>
            {visible.map((row) => (
              <CheckInRow key={row.id} row={row} winner={winnerById.get(row.id)} onOpenFile={openFile} />
            ))}
          </View>
        )}
        {filtered.length > shown && (
          <Button
            variant="secondary"
            label={`Tampilkan ${Math.min(STEP, filtered.length - shown)} berikutnya`}
            onPress={() => setShown(shown + STEP)}
          />
        )}
      </Card>
    </View>
  );
}

function CheckInTable({
  rows,
  winnerById,
  onOpenFile,
}: {
  rows: CheckIn[];
  winnerById: Map<string, Winner>;
  onOpenFile: (path: string) => void;
}) {
  const c = useTheme();
  const head: CSSProperties = {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: c.muted,
    borderBottom: `1px solid ${c.border}`,
    whiteSpace: "nowrap",
  };
  const cell: CSSProperties = { padding: "12px", verticalAlign: "top", borderBottom: `1px solid ${c.border}`, fontSize: 14, color: c.text };
  const sub: CSSProperties = { color: c.muted, fontSize: 13, marginTop: 2 };
  return (
    <table style={{ width: "100%", fontFamily: FONT_STACK }}>
      <thead>
        <tr>
          {["Waktu", "Peserta", "Kontak", "Kunjungan", "Berkas"].map((label) => (
            <th key={label} style={head}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const winner = winnerById.get(row.id);
          return (
            <tr key={row.id}>
              <td style={{ ...cell, whiteSpace: "nowrap", color: c.muted }}>{formatWib(row.created_at)}</td>
              <td style={cell}>
                <div style={{ fontWeight: 700 }}>{row.name}</div>
                {winner && (
                  <div style={{ marginTop: 6 }}>
                    <Badge tone="gold" label={`Pemenang ${winner.prize || "undian"}`} />
                  </div>
                )}
              </td>
              <td style={cell}>
                <div>{row.phone}</div>
                <div style={sub}>{row.email}</div>
              </td>
              <td style={{ ...cell, whiteSpace: "nowrap" }}>{formatDateRange(row.check_in_date, row.check_out_date)}</td>
              <td style={cell}>
                {row.file_path ? (
                  <Button small variant="secondary" label="Lihat berkas" onPress={() => onOpenFile(row.file_path!)} />
                ) : (
                  <span style={{ color: c.muted }}>Tidak ada</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CheckInRow({ row, winner, onOpenFile }: { row: CheckIn; winner?: Winner; onOpenFile: (path: string) => void }) {
  const c = useTheme();
  return (
    <View style={{ borderTopWidth: 1, borderColor: c.border, paddingVertical: 14, gap: 6 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <T weight="bold" style={{ flex: 1 }}>
          {row.name}
        </T>
        <T size={12} color={c.muted}>
          {formatWib(row.created_at)}
        </T>
      </Row>
      <T size={14}>{row.phone}</T>
      <T size={13} color={c.muted}>
        {row.email}
      </T>
      <Row style={{ gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <T size={13} color={c.muted}>
          {formatDateRange(row.check_in_date, row.check_out_date)}
        </T>
        {winner && <Badge tone="gold" label={`Pemenang ${winner.prize || "undian"}`} />}
        {!!row.file_path && (
          <Button small variant="secondary" label="Lihat berkas" onPress={() => onOpenFile(row.file_path!)} />
        )}
      </Row>
    </View>
  );
}
