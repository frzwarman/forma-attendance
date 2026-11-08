import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";
import * as XLSX from "xlsx";
import { CalendarCheck, Download, FileSpreadsheet, LogOut, Paperclip, Trophy, UserRound, Users, X } from "../../components/icons";
import { Dropdown } from "../../components/Dropdown";
import { FileInput, useInputStyle } from "../../components/NativeInput";
import { Badge, Button, Card, printAs, Row, SectionTitle, Stat, T } from "../../components/ui";
import { voteTitle } from "../../domain/evote";
import { answerTallies, arrivalHours, availableDays, defaultPoll, eventRows, formQuotes, isTestRow, narrative, parseSheetVisits, perDay, realPolls, REAL_VOTERS, shiftDay, summary, tally, tallyKey, type Quote, type Tally } from "../../domain/report";
import { formatWib } from "../../domain/time";
import { useAdminApi, useCheckIns, useWheel } from "../../services/adminContext";
import type { PollHistory } from "../../services/report";
import { FONT_STACK, useTheme } from "../../theme";
import { ColumnChart, Donut, HBars } from "./charts";

const num = (n: number) => n.toLocaleString("id-ID");
// "2026-11-02" -> "02/11/2026"; short: "02/11".
const dayLabel = (day: string) => day.split("-").reverse().join("/");
const shortDay = (day: string) => dayLabel(day).slice(0, 5);
const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
// "02-11-2026 Sesi 1" -> "02/11 S1" under a narrow column.
const shortSession = (label: string) => label.replace(/^(\d{2})-(\d{2})-\d{4} Sesi (\d+)$/, "$1/$2 S$3");
const TOP = 10;
const BLANK = "Tidak diisi";
const SHEET_ACCEPT = ".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type Preset = "all" | "week" | "custom";

// The event's story for the organisers, live from the database. One set of filters (days, a division)
// drives every number, chart and the written conclusion; Cetak / simpan PDF prints it without the sidebar.
// Attendance per session needs every visit, which only the Google Sheet has: its Check-in tab, dropped
// onto the page, is read in the browser and kept nowhere.
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
  const [preset, setPreset] = useState<Preset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [division, setDivision] = useState<string>();
  const [pollId, setPollId] = useState<string>();
  const [showTrials, setShowTrials] = useState(false);
  const [search, setSearch] = useState("");
  const [hideNames, setHideNames] = useState(false);
  const [sheet, setSheet] = useState<ReturnType<typeof parseSheetVisits>>();
  const [sheetError, setSheetError] = useState("");
  const [dragging, setDragging] = useState(false);

  // Days first, then the division: the division chart shows every division of those days, so the
  // selection can be changed.
  const all = eventRows(checkins.data ?? []);
  const trials = (checkins.data ?? []).filter(isTestRow).length;
  const days_ = availableDays(all);
  const lastDay = summary(all).lastDay;
  const range = preset === "all" ? {} : preset === "week" && lastDay ? { from: shiftDay(lastDay, -6), to: lastDay } : { from: from || undefined, to: to || undefined };
  const inRange = eventRows(all, range);
  const divisi = tally(
    inRange.map((row) => row.divisi),
    BLANK,
  );
  const divisionLabel = division ? divisi.find((d) => tallyKey(d.label) === division)?.label : undefined;
  const rows = division ? inRange.filter((row) => tallyKey(row.divisi?.trim() ? row.divisi : BLANK) === division) : inRange;

  const total = summary(rows);
  const days = perDay(rows);
  const hoursAll = arrivalHours(rows);
  const firstHour = hoursAll.findIndex((h) => h.count);
  const lastHour = hoursAll.length - 1 - [...hoursAll].reverse().findIndex((h) => h.count);
  const hours = firstHour < 0 ? [] : hoursAll.slice(firstHour, lastHour + 1);
  const questions = answerTallies(rows);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const quotes: Quote[] = [
    ...(feedback.data ?? [])
      .filter((row) => byId.has(row.checkin_id))
      .map((row) => ({ name: byId.get(row.checkin_id)!.name, text: row.message, at: row.created_at, source: "Kesan & Pesan" })),
    ...formQuotes(rows),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const needle = search.trim().toLowerCase();
  const shownQuotes = needle ? quotes.filter((q) => q.text.toLowerCase().includes(needle) || q.name.toLowerCase().includes(needle)) : quotes;
  const winners = (wheel.data ?? []).filter((entry) => entry.won_at).sort((a, b) => (a.won_at ?? "").localeCompare(b.won_at ?? ""));
  // The vote shown big: the one chosen, else the one most people voted in (a later poll is often a test).
  const polls = history.data ?? [];
  const real = realPolls(polls);
  // Chips: the real votes, or every vote when none is real or the trials are asked for.
  const choices = [...(showTrials || real.length === 0 ? polls : real)].sort((a, b) => b.voters - a.voters);
  const poll: PollHistory | undefined = polls.find((p) => p.poll.id === pollId) ?? defaultPoll(polls);
  const conclusion = narrative({
    total,
    days,
    divisi: division ? tally(rows.map((row) => row.divisi), BLANK) : divisi,
    poll: poll ? { title: voteTitle(poll.poll, "E-Vote"), options: poll.poll.options, counts: poll.counts, voters: poll.voters } : undefined,
    sessions: sheet?.sessions,
    quotes: quotes.length,
    winners: winners.length,
  });

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
  const presets: [Preset, string][] = [
    ["all", "Seluruh acara"],
    ["week", "Minggu terakhir"],
    ["custom", "Pilih tanggal"],
  ];
  return (
    <View style={{ gap: 20 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <View style={{ gap: 2, flex: 1, minWidth: 280 }}>
          <T size={28} weight="extra" accessibilityRole="header">
            Laporan
          </T>
          <T size={14} color={c.muted}>
            Pilih hari atau divisi; semua angka mengikuti.
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

      {/* The filters: one row, every section follows. */}
      <Card style={{ gap: 12 }}>
        <Row style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <T size={14} weight="semibold">
            Hari
          </T>
          {presets.map(([value, label]) => (
            <Chip key={value} label={label} selected={preset === value} onPress={() => setPreset(value)} />
          ))}
        </Row>
        {preset === "custom" && (
          <Row style={{ gap: 12, flexWrap: "wrap" }}>
            {(
              [
                ["Dari tanggal", "Dari awal", from, setFrom],
                ["Sampai tanggal", "Sampai akhir", to, setTo],
              ] as const
            ).map(([label, placeholder, value, set]) => (
              // Only days with check-ins can be picked.
              <Dropdown key={label} label={label} value={value} options={[{ value: "", label: placeholder }, ...days_.map((day) => ({ value: day, label: dayLabel(day) }))]} onChange={set} />
            ))}
          </Row>
        )}
        <Row style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <T size={13} color={c.muted}>
            {num(rows.length)} dari {num(all.length)} peserta{trials ? `; ${num(trials)} baris uji coba tidak dihitung` : ""}.
          </T>
          {divisionLabel && (
            <Row style={{ gap: 6, alignItems: "center", backgroundColor: c.accentSoft, borderRadius: 999, paddingLeft: 12, paddingRight: 4, paddingVertical: 2 }} testID="division-chip">
              <T size={13} weight="semibold">
                Divisi: {divisionLabel}
              </T>
              <Button small variant="ghost" icon={X} label="Hapus filter" onPress={() => setDivision(undefined)} />
            </Row>
          )}
        </Row>
      </Card>

      {/* The conclusion in words, the first thing read: a headline, then one fact per topic. */}
      <View testID="narrative" style={{ backgroundColor: c.background, borderRadius: 20, padding: wide ? 28 : 20, gap: 22, overflow: "hidden" }}>
        <Row style={{ gap: 14, alignItems: "stretch" }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: c.gold }} />
          <View style={{ flex: 1, gap: 6 }}>
            <T size={12} weight="bold" color={c.gold} style={{ letterSpacing: 0.4 }}>
              Kesimpulan
            </T>
            <Rich text={conclusion.headline} size={wide ? 24 : 20} color={c.onBackground} strong="#ffffff" lineHeight={wide ? 34 : 28} />
          </View>
        </Row>
        {conclusion.facts.length > 0 && (
          <Row style={{ gap: 12, flexWrap: "wrap" }}>
            {conclusion.facts.map((fact) => (
              <View key={fact.label} testID="fact" style={{ flex: 1, minWidth: 220, gap: 4, padding: 14, borderRadius: 14, backgroundColor: "rgba(255, 255, 255, 0.07)" }}>
                <T size={12} weight="semibold" color={c.gold}>
                  {fact.label}
                </T>
                <Rich text={fact.text} size={15} color={c.onBackgroundMuted} strong="#ffffff" lineHeight={22} />
              </View>
            ))}
          </Row>
        )}
      </View>

      <Row style={{ gap: 12, flexWrap: "wrap" }}>
        <Stat testID="stat-attendees" label="Peserta unik" value={num(total.attendees)} icon={Users} hint={total.firstDay ? `${dayLabel(total.firstDay)} – ${dayLabel(total.lastDay!)}` : "Belum ada check-in"} />
        <Stat testID="stat-visits" label="Total check-in" value={num(total.visits)} icon={CalendarCheck} hint={`Rata-rata ${num(total.perPerson)} per orang`} />
        <Stat testID="stat-days" label="Hari acara" value={num(total.days)} icon={CalendarCheck} hint="Hari dengan check-in" />
        <Stat testID="stat-checked-out" label="Sudah check-out" value={num(total.checkedOut)} icon={LogOut} hint={`Tanpa check-out: ${num(total.attendees - total.checkedOut)}`} />
        <Stat testID="stat-rooms" label="Luar kota" value={num(total.rooms)} icon={UserRound} hint="Mengisi nomor kamar hotel" />
        <Stat testID="stat-files" label="Unggahan berkas" value={num(total.files)} icon={Paperclip} hint="Foto atau PDF saat check-in" />
      </Row>

      <Row style={{ gap: 20, flexDirection: wide ? "row" : "column", alignItems: "stretch" }}>
        <Section fill title="Peserta baru per hari" description="Check-in pertama tiap orang.">
          <ColumnChart testID="day-col" points={days.map((d) => ({ label: shortDay(d.day), value: d.first, detail: `${num(d.first)} peserta baru, ${num(d.last)} check-in terakhir` }))} emptyText="Belum ada check-in." />
        </Section>
        <Section fill title="Jam kedatangan" description="Per jam, WIB.">
          <ColumnChart testID="hour-col" points={hours.map((h) => ({ label: hourLabel(h.hour), value: h.count, detail: `${num(h.count)} check-in pukul ${hourLabel(h.hour)}` }))} emptyText="Belum ada check-in." />
        </Section>
      </Row>

      <Section title="Kehadiran per sesi" description="Dari Google Sheet, tab Check-in: unduh sebagai CSV atau Excel, lalu tarik ke sini.">
        {sheet && (
          <View style={{ gap: 12 }}>
            <T accessibilityRole="status" weight="semibold">
              {num(sheet.visits)} check-in dalam {num(sheet.sessions.length)} sesi.
            </T>
            <ColumnChart testID="session-col" peakLabel="Paling ramai" points={sheet.sessions.map((s) => ({ label: shortSession(s.label), value: s.visits, detail: `${s.label}: ${num(s.visits)} check-in, ${num(s.people)} orang` }))} />
          </View>
        )}
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
          <FileInput label="Unggah ekspor tab Check-in" accept={SHEET_ACCEPT} buttonLabel={sheet ? "Ganti file" : "Pilih file"} icon={FileSpreadsheet} error={sheetError} onChange={(file) => void readSheet(file)} />
        </div>
      </Section>

      <Row style={{ gap: 20, flexDirection: wide ? "row" : "column", alignItems: "stretch" }}>
        <Section fill title="Peserta per Divisi" description={division ? "Klik lagi untuk melepas filter." : "Klik untuk memfilter."}>
          <TopBars testID="divisi-row" items={divisi} selected={division} onSelect={(key) => setDivision(key === division ? undefined : key)} />
        </Section>
        <Section fill title="Undian" description="Pemenang roda putar.">
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
        </Section>
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

      <Section
        title="E-Vote"
        description={`Voting dengan kurang dari ${REAL_VOTERS} suara dianggap uji coba.`}
        right={
          polls.length > real.length && real.length > 0 ? (
            <View {...printAs("hide")}>
              <Button small variant="secondary" label={showTrials ? "Sembunyikan uji coba" : `Tampilkan uji coba (${num(polls.length - real.length)})`} onPress={() => setShowTrials(!showTrials)} />
            </View>
          ) : undefined
        }
      >
        {!history.data ? (
          <T color={c.muted}>Memuat…</T>
        ) : !poll ? (
          <T color={c.muted}>Belum ada voting.</T>
        ) : (
          <View style={{ gap: 16 }}>
            {choices.length > 1 && (
              <Row style={{ gap: 8, flexWrap: "wrap" }} {...printAs("hide")}>
                {choices.map((p) => (
                  <Chip key={p.poll.id} testID="poll-chip" label={`${voteTitle(p.poll, "E-Vote")} (${num(p.voters)} suara)`} selected={p.poll.id === poll.poll.id} onPress={() => setPollId(p.poll.id)} />
                ))}
              </Row>
            )}
            <View testID="poll-card" style={{ gap: 12 }}>
              <SectionTitle
                title={voteTitle(poll.poll, "E-Vote")}
                description={`${formatWib(poll.poll.created_at)}, ${num(poll.voters)} orang memilih${poll.poll.max_picks > 1 ? `, maksimal ${poll.poll.max_picks} pilihan` : ""}`}
                right={<Badge tone={poll.poll.is_open ? "success" : "neutral"} label={poll.poll.is_open ? "Dibuka" : "Ditutup"} />}
              />
              {poll.poll.options.length <= 4 ? (
                <Donut testID="vote-slice" slices={poll.poll.options.map((option, i) => ({ label: option, value: poll.counts[i] ?? 0 }))} total={poll.voters} />
              ) : (
                <HBars
                  testID="vote-row"
                  items={poll.poll.options.map((option, i) => ({ key: option, label: option, value: poll.counts[i] ?? 0, note: `(${poll.voters ? Math.round(((poll.counts[i] ?? 0) * 100) / poll.voters) : 0}%)` }))}
                  max={Math.max(1, poll.voters)}
                />
              )}
            </View>
          </View>
        )}
      </Section>

      <Section
        title="Kesan & Pesan"
        description={`${num(quotes.length)} pesan dari halaman peserta dan formulir.`}
        right={
          <Row style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }} {...printAs("hide")}>
            <input type="search" aria-label="Cari pesan" placeholder="Cari pesan" value={search} onChange={(event) => setSearch(event.target.value)} style={{ ...inputStyle, width: 180, minHeight: 38, padding: "6px 12px" }} />
            <Button small variant="secondary" label={hideNames ? "Tampilkan nama" : "Sembunyikan nama"} onPress={() => setHideNames(!hideNames)} />
          </Row>
        }
      >
        {shownQuotes.length === 0 ? (
          <T color={c.muted}>{quotes.length ? "Tidak ada pesan yang cocok." : "Belum ada pesan."}</T>
        ) : (
          shownQuotes.map((quote, i) => (
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
      </Section>
    </View>
  );
}

// fill: one of several cards in a row, sharing its width.
// Text with **marked** parts set bold and brighter.
function Rich({ text, size, color, strong, lineHeight }: { text: string; size: number; color: string; strong: string; lineHeight: number }) {
  return (
    <T size={size} color={color} style={{ lineHeight }}>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith("**") ? (
          <T key={i} size={size} weight="extra" color={strong} style={{ lineHeight }}>
            {part.slice(2, -2)}
          </T>
        ) : (
          part
        ),
      )}
    </T>
  );
}

function Section({ title, description, right, fill, children }: { title: string; description?: string; right?: ReactNode; fill?: boolean; children: ReactNode }) {
  return (
    <Card style={{ gap: 12, ...(fill ? { flex: 1, minWidth: 0 } : {}) }}>
      <SectionTitle title={title} description={description} right={right} />
      {children}
    </Card>
  );
}

// A toggle in a row of choices (the days, the polls).
function Chip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  const c = useTheme();
  return (
    <button
      type="button"
      data-testid={testID}
      aria-pressed={selected}
      onClick={onPress}
      style={{
        minHeight: 38,
        padding: "0 14px",
        borderRadius: 999,
        border: `1px solid ${selected ? c.background : c.border}`,
        backgroundColor: selected ? c.background : c.surface,
        color: selected ? "#ffffff" : c.text,
        fontFamily: FONT_STACK,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// The most common values, the rest folded into one "Lainnya" line.
function TopBars({ items, testID, selected, onSelect }: { items: Tally; testID?: string; selected?: string; onSelect?: (key: string) => void }) {
  const c = useTheme();
  if (items.length === 0) return <T color={c.muted}>Tidak ada data.</T>;
  const shown = items.slice(0, TOP);
  const rest = items.slice(TOP);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const bars = shown.map((item) => ({ key: tallyKey(item.label), label: item.label, value: item.count, note: `(${Math.round((item.count * 100) / total)}%)` }));
  if (rest.length) bars.push({ key: "__rest", label: `Lainnya (${num(rest.length)} nilai)`, value: rest.reduce((sum, item) => sum + item.count, 0), note: "" });
  return <HBars testID={testID} items={bars} max={shown[0].count} selected={selected} onSelect={onSelect ? (key) => key !== "__rest" && onSelect(key) : undefined} />;
}
