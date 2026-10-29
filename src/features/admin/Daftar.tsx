import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, FileSpreadsheet, FileText, LogOut, Search, Trophy, Users } from "../../components/icons";
import { useState, type CSSProperties } from "react";
import { View, useWindowDimensions } from "react-native";
import { Badge, Button, Card, Empty, Field, Row, Stat, T } from "../../components/ui";
import { exportFileName, exportRows, toCsv, toXlsx } from "../../domain/export";
import { formFieldsFrom } from "../../domain/formFields";
import { formatWib } from "../../domain/time";
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
  const client = useQueryClient();
  const checkins = useCheckIns();
  const winners = useWinners();
  const { settings } = useSettings();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(STEP);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rowBusy, setRowBusy] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [allBusy, setAllBusy] = useState(false);
  // The table needs about 820 px; the card is narrower when the sidebar takes its share, so the
  // card's own width (not the window's) picks the table or the stacked list.
  const [listWidth, setListWidth] = useState(0);
  const tableFits = listWidth ? listWidth >= 820 : wide;
  const rows = checkins.data ?? [];
  const winnerById = new Map((winners.data ?? []).map((w) => [w.checkin_id, w]));
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((row) => [row.name, row.divisi ?? "", row.phone, row.email, row.room_number ?? "", ...Object.values(row.answers ?? {})].some((value) => value.toLowerCase().includes(needle)))
    : rows;
  const todayKey = formatWib(new Date().toISOString()).slice(0, 10);
  const today = rows.filter((row) => formatWib(row.created_at).slice(0, 10) === todayKey).length;
  const checkedOut = rows.filter((row) => row.checked_out_at).length;
  const present = rows.length - checkedOut;

  async function toggleCheckOut(row: CheckIn) {
    if (rowBusy) return;
    setRowBusy(row.id);
    setError("");
    setNotice("");
    try {
      await api.adminCheckOut(row.id, !!row.checked_out_at);
      await client.invalidateQueries({ queryKey: ["checkins"] });
    } catch (cause) {
      setError(`Check-out gagal disimpan: ${(cause as Error).message}`);
    } finally {
      setRowBusy("");
    }
  }

  async function checkOutEveryone() {
    if (allBusy) return;
    setAllBusy(true);
    setError("");
    try {
      const count = await api.checkOutAll();
      await client.invalidateQueries({ queryKey: ["checkins"] });
      setConfirmAll(false);
      setNotice(`${count.toLocaleString("id-ID")} peserta di-check-out.`);
    } catch (cause) {
      setError(`Check-out semua gagal: ${(cause as Error).message}`);
    } finally {
      setAllBusy(false);
    }
  }

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
    const table = exportRows(rows, winners.data ?? [], formFieldsFrom(settings.form_fields));
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
        {/* flexShrink: React Native children do not shrink by default, so the row would never wrap. */}
        <Row style={{ gap: 10, flexWrap: "wrap", flexShrink: 1 }}>
          <Button small icon={FileSpreadsheet} label="Ekspor Excel" disabled={checkins.isLoading} onPress={() => exportAs("xlsx")} />
          <Button small variant="secondary" icon={FileText} label="Ekspor CSV" disabled={checkins.isLoading} onPress={() => exportAs("csv")} />
          <Button
            small
            variant="secondary"
            icon={LogOut}
            label="Check out semua"
            disabled={checkins.isLoading || present === 0}
            onPress={() => {
              setNotice("");
              setConfirmAll(true);
            }}
          />
        </Row>
      </Row>
      {confirmAll && (
        <Card style={{ gap: 12, borderColor: c.danger }}>
          <T weight="semibold">
            Check out {present.toLocaleString("id-ID")} peserta yang belum check-out? Waktu check-out dicatat sekarang dan bisa dibatalkan per peserta.
          </T>
          <Row style={{ gap: 10, flexWrap: "wrap" }}>
            <Button small variant="danger" label="Ya, check out semua" loading={allBusy} loadingLabel="Mencatat…" onPress={() => void checkOutEveryone()} />
            <Button small variant="ghost" label="Batal" disabled={allBusy} onPress={() => setConfirmAll(false)} />
          </Row>
        </Card>
      )}
      {!!notice && (
        <T accessibilityRole="status" color={c.success} weight="semibold">
          {notice}
        </T>
      )}
      <Row style={{ gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label="Total peserta" value={rows.length.toLocaleString("id-ID")} icon={Users} hint="Diperbarui setiap 10 detik" />
        <Stat label="Check-in hari ini" value={today.toLocaleString("id-ID")} icon={CalendarCheck} hint="Waktu Indonesia Barat" />
        <Stat label="Sudah check-out" value={checkedOut.toLocaleString("id-ID")} icon={LogOut} hint={`Masih di lokasi: ${present.toLocaleString("id-ID")}`} />
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
      <Card style={{ gap: 16, padding: wide ? 20 : 16 }} onLayout={(event) => setListWidth(event.nativeEvent.layout.width)}>
        <Field
          label="Cari nama, divisi, telepon, e-mail, atau kamar"
          labelHidden
          placeholder="Cari nama, divisi, telepon, e-mail, atau kamar"
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
        ) : tableFits ? (
          <CheckInTable rows={visible} winnerById={winnerById} onOpenFile={openFile} onToggle={toggleCheckOut} busy={rowBusy} />
        ) : (
          <View>
            {visible.map((row) => (
              <CheckInRow
                key={row.id}
                row={row}
                winner={winnerById.get(row.id)}
                onOpenFile={openFile}
                onToggle={toggleCheckOut}
                busy={rowBusy === row.id}
              />
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

function CheckOutAction({ row, busy, onToggle }: { row: CheckIn; busy: boolean; onToggle: (row: CheckIn) => void }) {
  return (
    <Button
      small
      variant={row.checked_out_at ? "ghost" : "secondary"}
      label={row.checked_out_at ? "Batalkan" : "Check out"}
      loading={busy}
      loadingLabel="Menyimpan…"
      onPress={() => onToggle(row)}
    />
  );
}

// "26/10/2026" over "10:00 WIB", so the time columns stay narrow.
function DateTime({ at }: { at: string }) {
  const text = formatWib(at);
  const space = text.indexOf(" ");
  return (
    <>
      <div>{text.slice(0, space)}</div>
      <div>{text.slice(space + 1)}</div>
    </>
  );
}

function CheckInTable({
  rows,
  winnerById,
  onOpenFile,
  onToggle,
  busy,
}: {
  rows: CheckIn[];
  winnerById: Map<string, Winner>;
  onOpenFile: (path: string) => void;
  onToggle: (row: CheckIn) => void;
  busy: string;
}) {
  const c = useTheme();
  const head: CSSProperties = {
    textAlign: "left",
    padding: "10px",
    fontSize: 12,
    fontWeight: 600,
    color: c.muted,
    borderBottom: `1px solid ${c.border}`,
    whiteSpace: "nowrap",
  };
  const cell: CSSProperties = { padding: "12px 10px", verticalAlign: "top", borderBottom: `1px solid ${c.border}`, fontSize: 14, color: c.text };
  const sub: CSSProperties = { color: c.muted, fontSize: 13, marginTop: 2 };
  return (
    // Scrolls sideways on its own when the columns need more room than the card, so no column is cut off.
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontFamily: FONT_STACK }}>
        <thead>
          <tr>
            {["Waktu check-in", "Peserta", "Kontak", "Kamar", "Check-out", "Berkas"].map((label) => (
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
                <td style={{ ...cell, whiteSpace: "nowrap", color: c.muted }}>
                  <DateTime at={row.created_at} />
                </td>
                <td style={cell}>
                  <div style={{ fontWeight: 700 }}>{row.name}</div>
                  {!!row.divisi && <div style={sub}>{row.divisi}</div>}
                  {Object.entries(row.answers ?? {}).map(([label, value]) => (
                    <div key={label} style={{ ...sub, overflowWrap: "anywhere" }}>
                      {label}: {value}
                    </div>
                  ))}
                  {winner && (
                    <div style={{ marginTop: 6 }}>
                      <Badge tone="gold" label={`Pemenang ${winner.prize || "undian"}`} />
                    </div>
                  )}
                </td>
                <td style={cell}>
                  <div>{row.phone}</div>
                  <div style={{ ...sub, overflowWrap: "anywhere" }}>{row.email}</div>
                </td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>{row.room_number || <span style={{ color: c.muted }}>Tidak ada</span>}</td>
                <td style={cell}>
                  <div style={{ whiteSpace: "nowrap", color: row.checked_out_at ? c.text : c.muted }}>
                    {row.checked_out_at ? <DateTime at={row.checked_out_at} /> : "Belum"}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <CheckOutAction row={row} busy={busy === row.id} onToggle={onToggle} />
                  </div>
                </td>
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
    </div>
  );
}

function CheckInRow({
  row,
  winner,
  onOpenFile,
  onToggle,
  busy,
}: {
  row: CheckIn;
  winner?: Winner;
  onOpenFile: (path: string) => void;
  onToggle: (row: CheckIn) => void;
  busy: boolean;
}) {
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
      {!!row.divisi && (
        <T size={13} color={c.muted}>
          {row.divisi}
        </T>
      )}
      {Object.entries(row.answers ?? {}).map(([label, value]) => (
        <T key={label} size={13} color={c.muted}>
          {label}: {value}
        </T>
      ))}
      <T size={14}>{row.phone}</T>
      <T size={13} color={c.muted}>
        {row.email}
      </T>
      {!!row.room_number && (
        <T size={13} color={c.muted}>
          Kamar hotel {row.room_number}
        </T>
      )}
      <T size={13} color={c.muted}>
        Check-out: {row.checked_out_at ? formatWib(row.checked_out_at) : "belum"}
      </T>
      <Row style={{ gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <CheckOutAction row={row} busy={busy} onToggle={onToggle} />
        {winner && <Badge tone="gold" label={`Pemenang ${winner.prize || "undian"}`} />}
        {!!row.file_path && (
          <Button small variant="secondary" label="Lihat berkas" onPress={() => onOpenFile(row.file_path!)} />
        )}
      </Row>
    </View>
  );
}
