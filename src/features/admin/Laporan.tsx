import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import * as XLSX from "xlsx";
import { CalendarCheck, Download, FileSpreadsheet, LogOut, Paperclip, Trophy, UserRound, Users } from "../../components/icons";
import { FileInput, useInputStyle } from "../../components/NativeInput";
import { Badge, Button, Card, printAs, Row, SectionTitle, Stat, T } from "../../components/ui";
import { shares, voteTitle } from "../../domain/evote";
import { answerTallies, arrivalHours, eventRows, formQuotes, parseSheetVisits, perDay, summary, tally, type Quote, type Tally } from "../../domain/report";
import { formatWib } from "../../domain/time";
import { useAdminApi, useCheckIns, useWheel } from "../../services/adminContext";
import { useTheme } from "../../theme";

const num = (n: number) => n.toLocaleString("id-ID");
// "2026-11-02" -> "02/11/2026".
const dayLabel = (day: string) => day.split("-").reverse().join("/");
const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
const TOP = 10;
const SHEET_ACCEPT = ".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// The event's story for the organisers, live from the database; Cetak / simpan PDF prints it without the
// sidebar (global.css). Attendance per session needs every visit, which only the Google Sheet has: its
// Check-in tab, dropped onto the page, is read in the browser and kept nowhere.
export function Laporan() {
  const c = useTheme();
  const api = useAdminApi();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const checkins = useCheckIns();
  const wheel = useWheel();
  const feedback = useQuery({ queryKey: ["feedback"], queryFn: api.fetchFeedback });
  const history = useQuery({ queryKey: ["poll-history"], queryFn: api.fetchPollHistory });
  const inputStyle = useInputStyle();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hideNames, setHideNames] = useState(false);
  const [sheet, setSheet] = useState<ReturnType<typeof parseSheetVisits>>();
  const [sheetError, setSheetError] = useState("");
  const [dragging, setDragging] = useState(false);

  const rows = eventRows(checkins.data ?? [], { from: from || undefined, to: to || undefined });
  const total = summary(rows);
  const days = perDay(rows);
  const hours = arrivalHours(rows).filter((h) => h.count);
  const divisi = tally(rows.map((row) => row.divisi), "Tidak diisi");
  const questions = answerTallies(rows);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const quotes: Quote[] = [
    ...(feedback.data ?? [])
      .filter((row) => byId.has(row.checkin_id))
      .map((row) => ({ name: byId.get(row.checkin_id)!.name, text: row.message, at: row.created_at, source: "Kesan & Pesan" })),
    ...formQuotes(rows),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const winners = (wheel.data ?? []).filter((entry) => entry.won_at).sort((a, b) => (a.won_at ?? "").localeCompare(b.won_at ?? ""));

  async function readSheet(file: File | null) {
    if (!file) return;
    setSheetError("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const first = workbook.Sheets[workbook.SheetNames[0]];
      setSheet(parseSheetVisits(first ? XLSX.utils.sheet_to_json<unknown[]>(first, { header: 1, defval: "", raw: false }) : []));
    } catch (cause) {
      setSheet(undefined);
      setSheetError((cause as Error).message);
    }
  }

  const problem = (query: { isError: boolean; error: unknown; data: unknown }) => (query.isError && !query.data ? (query.error as Error).message : "");
  return (
    <View style={{ gap: 20 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <View style={{ gap: 2, flex: 1, minWidth: 280 }}>
          <T size={28} weight="extra" accessibilityRole="header">
            Laporan
          </T>
          <T size={14} color={c.muted}>
            Cerita acara dari basis data: kehadiran, peserta, jawaban formulir, E-Vote, Kesan & Pesan dan Undian. Baris demo (@example.com) tidak dihitung.
          </T>
        </View>
        <View {...printAs("hide")}>
          <Button icon={Download} label="Cetak / simpan PDF" onPress={() => window.print()} />
        </View>
      </Row>
      {[problem(checkins), problem(feedback), problem(history), problem(wheel)].filter(Boolean).map((message) => (
        <T key={message} accessibilityRole="alert" color={c.danger}>
          {message}
        </T>
      ))}

      <Card style={{ gap: 12 }}>
        <SectionTitle title="Rentang tanggal" description="Peserta yang check-in pertama kali dalam rentang ini (WIB). Kosong: seluruh acara." />
        <Row style={{ gap: 12, flexWrap: "wrap" }}>
          {(
            [
              ["Dari tanggal", from, setFrom],
              ["Sampai tanggal", to, setTo],
            ] as const
          ).map(([label, value, set]) => (
            <View key={label} style={{ gap: 6, minWidth: 200 }}>
              <T size={14} weight="semibold">
                {label}
              </T>
              <input type="date" aria-label={label} value={value} onChange={(event) => set(event.target.value)} style={inputStyle} />
            </View>
          ))}
        </Row>
      </Card>

      <View style={{ gap: 12 }}>
        <T size={20} weight="extra" accessibilityRole="header">
          Ringkasan
        </T>
        <Row style={{ gap: 12, flexWrap: "wrap" }}>
          <Stat testID="stat-attendees" label="Peserta unik" value={num(total.attendees)} icon={Users} hint={total.firstDay ? `${dayLabel(total.firstDay)} – ${dayLabel(total.lastDay!)}` : "Belum ada check-in"} />
          <Stat testID="stat-visits" label="Total check-in" value={num(total.visits)} icon={CalendarCheck} hint={`Rata-rata ${num(total.perPerson)} per orang`} />
          <Stat testID="stat-days" label="Hari acara" value={num(total.days)} icon={CalendarCheck} hint="Hari dengan check-in" />
          <Stat testID="stat-checked-out" label="Sudah check-out" value={num(total.checkedOut)} icon={LogOut} hint={`Tanpa check-out: ${num(total.attendees - total.checkedOut)}`} />
          <Stat testID="stat-rooms" label="Luar kota" value={num(total.rooms)} icon={UserRound} hint="Mengisi nomor kamar hotel" />
          <Stat testID="stat-files" label="Unggahan berkas" value={num(total.files)} icon={Paperclip} hint="Foto atau PDF saat check-in" />
        </Row>
      </View>

      <Row style={{ gap: 20, flexDirection: wide ? "row" : "column", alignItems: "stretch" }}>
        <Card style={{ flex: 1, gap: 12 }}>
          <SectionTitle title="Kehadiran per hari" description="Peserta baru (check-in pertama) per hari; di kanan, berapa yang terakhir hadir hari itu." />
          {days.length === 0 ? (
            <T color={c.muted}>Belum ada check-in.</T>
          ) : (
            <Bars testID="day-row" items={days.map((d) => ({ label: dayLabel(d.day), value: d.first, note: `· terakhir hadir ${num(d.last)}` }))} />
          )}
        </Card>
        <Card style={{ flex: 1, gap: 12 }}>
          <SectionTitle title="Jam kedatangan" description="Check-in pertama dan terakhir tiap peserta, per jam (WIB)." />
          {hours.length === 0 ? <T color={c.muted}>Belum ada check-in.</T> : <Bars testID="hour-row" items={hours.map((h) => ({ label: hourLabel(h.hour), value: h.count }))} />}
        </Card>
      </Row>

      <Card style={{ gap: 12 }}>
        <SectionTitle
          title="Kehadiran per sesi"
          description="Basis data menyimpan check-in pertama dan terakhir tiap orang; setiap kunjungan ada di Google Sheet. Unggah ekspor tab Check-in (File → Download → CSV atau Excel) untuk hitungan per sesi. Dibaca di browser, tidak disimpan."
        />
        <div
          data-testid="sheet-dropzone"
          data-print="hide"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void readSheet(event.dataTransfer.files[0] ?? null);
          }}
          style={{ padding: 12, borderRadius: 12, border: `2px dashed ${dragging ? c.accent : c.border}`, backgroundColor: dragging ? c.accentSoft : "transparent" }}
        >
          <FileInput label="Unggah ekspor tab Check-in" accept={SHEET_ACCEPT} buttonLabel="Pilih file" icon={FileSpreadsheet} hint="Atau tarik file ke kotak ini." error={sheetError} onChange={(file) => void readSheet(file)} />
        </div>
        {sheet && (
          <View style={{ gap: 12 }}>
            <T accessibilityRole="status" weight="semibold">
              {num(sheet.visits)} check-in dalam {num(sheet.sessions.length)} sesi.
            </T>
            <Bars testID="session-row" items={sheet.sessions.map((s) => ({ label: s.label, value: s.visits, note: `· ${num(s.people)} orang` }))} />
          </View>
        )}
      </Card>

      <Row style={{ gap: 20, flexDirection: wide ? "row" : "column", alignItems: "stretch" }}>
        <Card style={{ flex: 1, gap: 12 }}>
          <SectionTitle title="Peserta per Divisi" description={`${num(total.attendees)} peserta; ${num(divisi.length)} divisi.`} />
          <TopBars testID="divisi-row" items={divisi} />
        </Card>
        <Card style={{ flex: 1, gap: 12 }}>
          <SectionTitle title="Undian" description="Pemenang roda putar, dari yang pertama." />
          {winners.length === 0 ? (
            <T color={c.muted}>Belum ada pemenang.</T>
          ) : (
            winners.map((entry) => (
              <Row key={entry.id} testID="winner-row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap", borderTopWidth: 1, borderColor: c.border, paddingVertical: 10 }}>
                <Badge tone="gold" icon={Trophy} label={entry.prize || "Undian"} />
                <T weight="bold" style={{ flex: 1, minWidth: 160 }}>
                  {entry.name}
                </T>
                <T size={12} color={c.muted}>
                  {formatWib(entry.won_at!)}
                </T>
              </Row>
            ))
          )}
        </Card>
      </Row>

      <View style={{ gap: 12 }}>
        <T size={20} weight="extra" accessibilityRole="header">
          Jawaban formulir
        </T>
        {questions.length === 0 ? (
          <Card>
            <T color={c.muted}>Tidak ada pertanyaan tambahan yang dijawab.</T>
          </Card>
        ) : (
          <Row style={{ gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
            {questions.map((question) => (
              <Card key={question.label} testID="question-card" style={{ flex: 1, minWidth: wide ? 380 : undefined, gap: 12 }}>
                <SectionTitle title={question.label} description={`${num(question.answers)} jawaban`} />
                <TopBars items={question.tally} />
              </Card>
            ))}
          </Row>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <T size={20} weight="extra" accessibilityRole="header">
          E-Vote
        </T>
        {!history.data || history.data.length === 0 ? (
          <Card>
            <T color={c.muted}>{history.data ? "Belum ada voting." : "Memuat…"}</T>
          </Card>
        ) : (
          <Row style={{ gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
            {history.data.map(({ poll, voters, counts }) => {
              const percent = shares(counts, voters);
              return (
                <Card key={poll.id} testID="poll-card" style={{ flex: 1, minWidth: wide ? 380 : undefined, gap: 12 }}>
                  <SectionTitle
                    title={voteTitle(poll, "E-Vote")}
                    description={`${formatWib(poll.created_at)} · ${num(voters)} orang memilih${poll.max_picks > 1 ? ` · maksimal ${poll.max_picks} pilihan` : ""}`}
                    right={<Badge tone={poll.is_open ? "success" : "neutral"} label={poll.is_open ? "Dibuka" : "Ditutup"} />}
                  />
                  <Bars items={poll.options.map((option, i) => ({ label: option, value: counts[i] ?? 0, note: `· ${percent[i] ?? 0}%` }))} max={Math.max(1, voters)} />
                </Card>
              );
            })}
          </Row>
        )}
      </View>

      <Card style={{ gap: 12 }}>
        <SectionTitle
          title="Kesan & Pesan"
          description={`${num(quotes.length)} pesan: dari halaman peserta dan dari pertanyaan formulir tentang kesan dan pesan.`}
          right={
            <View {...printAs("hide")}>
              <Button small variant="secondary" label={hideNames ? "Tampilkan nama" : "Sembunyikan nama"} onPress={() => setHideNames(!hideNames)} />
            </View>
          }
        />
        {quotes.length === 0 ? (
          <T color={c.muted}>Belum ada pesan.</T>
        ) : (
          quotes.map((quote, i) => (
            <View key={i} testID="quote" style={{ gap: 4, borderTopWidth: 1, borderColor: c.border, paddingVertical: 10 }}>
              <T size={15}>“{quote.text}”</T>
              <Row style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <T size={12} weight="semibold" color={c.muted}>
                  {hideNames ? "Peserta" : quote.name}
                </T>
                <T size={12} color={c.muted}>
                  {formatWib(quote.at)}
                </T>
                <Badge label={quote.source.length > 40 ? `${quote.source.slice(0, 39)}…` : quote.source} />
              </Row>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

// One series, one colour: the value beside each label does the reading, the bar the comparing.
function Bars({ items, max, testID }: { items: { label: string; value: number; note?: string }[]; max?: number; testID?: string }) {
  const c = useTheme();
  const top = Math.max(1, max ?? Math.max(0, ...items.map((item) => item.value)));
  return (
    <View style={{ gap: 10 }}>
      {items.map((item, i) => (
        <View key={i} testID={testID} style={{ gap: 4 }}>
          <Row style={{ justifyContent: "space-between", gap: 12 }}>
            <T size={14} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
              {item.label}
            </T>
            <T size={14} weight="bold">
              {num(item.value)}
              {item.note && (
                <T size={13} color={c.muted}>
                  {" "}
                  {item.note}
                </T>
              )}
            </T>
          </Row>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: c.inputSurface, overflow: "hidden" }}>
            <View style={{ width: `${(item.value / top) * 100}%`, height: "100%", borderRadius: 999, backgroundColor: c.background }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// The most common values, the rest folded into one "Lainnya" line.
function TopBars({ items, testID }: { items: Tally; testID?: string }) {
  const c = useTheme();
  if (items.length === 0) return <T color={c.muted}>Tidak ada data.</T>;
  const shown = items.slice(0, TOP);
  const rest = items.slice(TOP);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const bars = shown.map((item) => ({ label: item.label, value: item.count, note: `· ${Math.round((item.count * 100) / total)}%` }));
  if (rest.length) bars.push({ label: `Lainnya (${num(rest.length)} nilai)`, value: rest.reduce((sum, item) => sum + item.count, 0), note: "" });
  return <Bars testID={testID} items={bars} max={shown[0].count} />;
}
