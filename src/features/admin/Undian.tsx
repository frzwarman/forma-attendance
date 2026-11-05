import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import * as XLSX from "xlsx";
import { useBrandBackground } from "../../components/Brand";
import { Maximize, Trash, Upload } from "../../components/icons";
import { Modal } from "../../components/Modal";
import { FileInput } from "../../components/NativeInput";
import { Badge, Button, Card, Field, IconHeading, Row, T } from "../../components/ui";
import { formatWib } from "../../domain/time";
import { parseWheelFile, SPIN_MS, spinTo, WHEEL_COLORS, type WheelRow } from "../../domain/wheel";
import { useAdminApi, useWheel } from "../../services/adminContext";
import { FONT_STACK, useTheme } from "../../theme";
import type { WheelEntry } from "../../types/guestbook";
import { Wheel } from "./Wheel";

type Parsed = { entries: WheelRow[]; withNotes: boolean };
const ACCEPT = ".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const count = (n: number) => n.toLocaleString("id-ID");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The spin wheel over the list an admin uploads. The database picks the winner (guestbook_wheel_spin);
// the wheel then turns to that name. Layar penuh fills the screen with the stage alone, as Hasil E-Vote does.
export function Undian() {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const client = useQueryClient();
  const api = useAdminApi();
  const wheel = useWheel();
  const background = useBrandBackground();
  const stage = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [prize, setPrize] = useState("Hadiah 1");
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  // The drawn entry and the wheel as it was at that moment: the refetch during the turn must not move the segments.
  const [winner, setWinner] = useState<WheelEntry>();
  const [frozen, setFrozen] = useState<WheelEntry[]>();
  // A file waiting for Ya, ganti.
  const [pending, setPending] = useState<Parsed>();
  const [importing, setImporting] = useState(false);
  const [uploaded, setUploaded] = useState("");
  const [fileError, setFileError] = useState("");
  const [error, setError] = useState("");
  // A file held over the uploader.
  const [dragging, setDragging] = useState(false);
  // The participant waiting for Ya, hapus.
  const [removing, setRemoving] = useState<WheelEntry>();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const changed = () => setFull(!!stage.current && document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  // transitionend may never come in a hidden tab: the turn ends by the clock then.
  useEffect(() => {
    if (!spinning) return;
    const timer = setTimeout(() => setSpinning(false), SPIN_MS + 500);
    return () => clearTimeout(timer);
  }, [spinning]);

  const entries = wheel.data ?? [];
  const onWheel = entries.filter((entry) => !entry.won_at);
  const winners = entries.filter((entry) => entry.won_at).sort((a, b) => (b.won_at ?? "").localeCompare(a.won_at ?? ""));
  const shown = frozen ?? onWheel;

  async function fill() {
    setError("");
    try {
      await stage.current?.requestFullscreen();
    } catch (cause) {
      setError(`Layar penuh tidak bisa dibuka: ${(cause as Error).message}`);
    }
  }

  async function read(file: File | null) {
    if (!file) return;
    setFileError("");
    setError("");
    setUploaded("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = parseWheelFile(sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) : []);
      // The winners go with the list: ask first.
      if (winners.length) setPending(parsed);
      else await send(parsed);
    } catch (cause) {
      setFileError((cause as Error).message);
    }
  }

  async function send(parsed: Parsed) {
    setImporting(true);
    try {
      const n = await api.importWheel(parsed.entries);
      setUploaded(`${count(n)} peserta diunggah${parsed.withNotes ? ", dengan Kesan & Pesan" : ""}.`);
      await client.invalidateQueries({ queryKey: ["wheel"] });
    } catch (cause) {
      setFileError((cause as Error).message);
    } finally {
      setPending(undefined);
      setImporting(false);
    }
  }

  async function spin() {
    setBusy(true);
    setError("");
    try {
      const result = await api.spinWheel(prize.trim());
      if (result.status === "empty") {
        setError("Semua peserta sudah mendapat hadiah.");
        await client.invalidateQueries({ queryKey: ["wheel"] });
        return;
      }
      const snapshot = onWheel;
      const index = snapshot.findIndex((entry) => entry.id === result.entry.id);
      setFrozen(snapshot);
      setWinner(result.entry);
      if (index >= 0) setRotation((current) => spinTo(current, index, snapshot.length));
      // The list changed under us (no segment to stop on), or motion is reduced: the panel at once.
      if (index >= 0 && !reducedMotion()) setSpinning(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function closePanel() {
    if (!winner) return;
    // The winner leaves the wheel at once; the refetch confirms.
    client.setQueryData<WheelEntry[]>(["wheel"], (old) => old?.map((entry) => (entry.id === winner.id ? winner : entry)));
    setWinner(undefined);
    setFrozen(undefined);
    void client.invalidateQueries({ queryKey: ["wheel"] });
  }

  async function putBack(id: string) {
    setError("");
    try {
      await api.returnToWheel(id);
      await client.invalidateQueries({ queryKey: ["wheel"] });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function remove(entry: WheelEntry) {
    setDeleting(true);
    setError("");
    try {
      await api.removeFromWheel(entry.id);
      await client.invalidateQueries({ queryKey: ["wheel"] });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setRemoving(undefined);
      setDeleting(false);
    }
  }

  const status = !wheel.data
    ? "Memuat peserta…"
    : entries.length === 0
      ? "Belum ada daftar peserta."
      : onWheel.length === 0
        ? "Semua peserta sudah mendapat hadiah."
        : `Sisa ${count(onWheel.length)} peserta`;
  const shownPrize = prize.trim();
  return (
    <View style={{ gap: 20 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <T size={28} weight="extra" accessibilityRole="header">
            Undian
          </T>
          <T size={14} color={c.muted}>
            Unggah daftar peserta, lalu putar roda. Pemenang keluar dari roda, jadi tidak terpilih dua kali.
          </T>
        </View>
        {document.fullscreenEnabled && <Button icon={Maximize} label="Layar penuh" onPress={() => void fill()} />}
      </Row>
      <Row style={{ gap: 20, alignItems: wide ? "flex-start" : "stretch", flexDirection: wide ? "row" : "column" }}>
        <Card style={{ gap: 16, width: wide ? 340 : undefined }}>
          <IconHeading
            icon={Upload}
            tone="gold"
            title="Daftar peserta"
            description="File CSV atau Excel. Baris pertama judul kolom: Nama wajib, Kesan & Pesan boleh ditambah."
          />
          {/* The file can be dropped anywhere on this box. dragover must be cancelled for drop to fire. */}
          <div
            data-testid="dropzone"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void read(event.dataTransfer.files[0] ?? null);
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              border: `2px dashed ${dragging ? c.accent : c.border}`,
              backgroundColor: dragging ? c.accentSoft : "transparent",
              transition: "border-color 150ms, background-color 150ms",
            }}
          >
            <FileInput
              label="Unggah daftar peserta"
              accept={ACCEPT}
              buttonLabel="Pilih file"
              icon={Upload}
              hint="Atau tarik file ke kotak ini. Maksimal 2 kolom: Nama dan Kesan & Pesan."
              error={fileError}
              onChange={(file) => void read(file)}
            />
          </div>
          {!!uploaded && (
            <T accessibilityRole="status" color={c.success} weight="semibold">
              {uploaded}
            </T>
          )}
          <Field label="Nama hadiah" value={prize} onChangeText={setPrize} editable={!busy && !spinning} placeholder="Hadiah 1" />
          <T size={13} color={c.muted}>
            Sisa peserta di roda: {count(onWheel.length)}
          </T>
          {!!error && (
            <T accessibilityRole="alert" color={c.danger}>
              {error}
            </T>
          )}
        </Card>
        {wheel.isError && !wheel.data ? (
          <Card style={{ flex: wide ? 1 : undefined }}>
            <T accessibilityRole="alert" color={c.danger}>
              {(wheel.error as Error).message}
            </T>
          </Card>
        ) : (
          <div
            ref={stage}
            data-testid="wheel-stage"
            style={{
              ...(wide ? { flex: 1, minWidth: 0 } : {}),
              containerType: "size",
              aspectRatio: "16 / 9",
              position: "relative",
              overflow: "hidden",
              borderRadius: full ? 0 : 20,
              color: c.onBackground,
              backgroundColor: c.background,
              backgroundImage: `url(${background})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              fontFamily: FONT_STACK,
            }}
          >
            {!!shownPrize && (
              <div data-testid="stage-prize" style={{ position: "absolute", top: "2.4cqw", left: "3cqw", fontSize: "max(14px, 2cqw)", fontWeight: 600 }}>
                {shownPrize}
              </div>
            )}
            <div
              data-testid="wheel-status"
              style={{
                position: "absolute",
                top: "2.4cqw",
                right: "3cqw",
                padding: "0.6cqw 1.6cqw",
                borderRadius: 999,
                fontSize: "max(12px, 1.5cqw)",
                fontWeight: 700,
                whiteSpace: "nowrap",
                color: "#ffffff",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
              }}
            >
              {status}
            </div>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wheel
                names={shown.map((entry) => entry.name)}
                rotation={rotation}
                spinning={spinning}
                onSpun={() => setSpinning(false)}
                label={busy ? "Mengundi…" : "Putar"}
                disabled={busy || spinning || !!winner || !wheel.data || onWheel.length === 0}
                onPress={() => void spin()}
              />
            </div>
            {winner && !spinning && <WinnerPanel entry={winner} onClose={closePanel} />}
          </div>
        )}
      </Row>
      <Card style={{ gap: 12 }}>
        <T size={17} weight="bold" accessibilityRole="header">
          Peserta di roda ({count(onWheel.length)})
        </T>
        {onWheel.length === 0 ? (
          <T color={c.muted}>Belum ada peserta di roda.</T>
        ) : (
          // The list can be long: it scrolls on its own, the page stays put.
          <div style={{ maxHeight: 440, overflowY: "auto" }}>
            {onWheel.map((entry) => (
              <Row
                key={entry.id}
                testID="participant-row"
                style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10, borderTopWidth: 1, borderColor: c.border, paddingVertical: 10 }}
              >
                <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                  <T weight="bold">{entry.name}</T>
                  {!!entry.note && (
                    <T size={13} color={c.muted}>
                      {entry.note}
                    </T>
                  )}
                </View>
                <Button
                  small
                  variant="danger"
                  icon={Trash}
                  label="Hapus"
                  accessibilityLabel={`Hapus ${entry.name}`}
                  disabled={spinning || !!winner}
                  onPress={() => setRemoving(entry)}
                />
              </Row>
            ))}
          </div>
        )}
      </Card>
      <Card style={{ gap: 12 }}>
        <T size={17} weight="bold" accessibilityRole="header">
          Pemenang
        </T>
        {winners.length === 0 ? (
          <T color={c.muted}>Belum ada pemenang.</T>
        ) : (
          winners.map((entry) => (
            <Row
              key={entry.id}
              testID="winner-row"
              style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10, borderTopWidth: 1, borderColor: c.border, paddingVertical: 12 }}
            >
              <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
                <T weight="bold">{entry.name}</T>
                <Row style={{ gap: 8, flexWrap: "wrap" }}>
                  <Badge tone="gold" label={entry.prize || "Undian"} />
                  <T size={12} color={c.muted}>
                    {formatWib(entry.won_at ?? "")}
                  </T>
                </Row>
                {!!entry.note && (
                  <T size={13} color={c.muted}>
                    {entry.note}
                  </T>
                )}
              </View>
              <Button
                small
                variant="danger"
                label="Kembalikan ke roda"
                accessibilityLabel={`Kembalikan ${entry.name} ke roda`}
                onPress={() => void putBack(entry.id)}
              />
            </Row>
          ))
        )}
      </Card>
      {removing && (
        <Modal label="Hapus peserta" maxWidth={460} onClose={() => !deleting && setRemoving(undefined)}>
          <View style={{ padding: 24, paddingTop: 28, gap: 16 }}>
            <T size={22} weight="extra" accessibilityRole="header" style={{ paddingRight: 48 }}>
              Hapus {removing.name} dari roda?
            </T>
            <T color={c.muted}>Nama ini tidak ikut undian lagi. Unggah file lagi untuk mengembalikannya.</T>
            <Row style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button variant="ghost" label="Batal" disabled={deleting} onPress={() => setRemoving(undefined)} />
              <Button variant="danger" icon={Trash} label="Ya, hapus" loading={deleting} loadingLabel="Menghapus…" onPress={() => void remove(removing)} />
            </Row>
          </View>
        </Modal>
      )}
      {pending && (
        <Modal label="Ganti daftar peserta" maxWidth={460} onClose={() => !importing && setPending(undefined)}>
          <View style={{ padding: 24, paddingTop: 28, gap: 16 }}>
            <T size={22} weight="extra" accessibilityRole="header" style={{ paddingRight: 48 }}>
              Ganti daftar peserta?
            </T>
            <T color={c.muted}>
              Daftar sekarang ({count(entries.length)} peserta, {count(winners.length)} pemenang) diganti dengan isi file ({count(pending.entries.length)}{" "}
              peserta). Daftar pemenang ikut terhapus.
            </T>
            <Row style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button variant="ghost" label="Batal" disabled={importing} onPress={() => setPending(undefined)} />
              <Button label="Ya, ganti" loading={importing} loadingLabel="Mengunggah…" onPress={() => void send(pending)} />
            </Row>
          </View>
        </Modal>
      )}
    </View>
  );
}

// Eighty paper bits falling over the panel once (the "confetti" keyframes in global.css), in the wheel's colours.
function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 80 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.5}s`,
      duration: `${2.5 + Math.random() * 2}s`,
      size: `${0.8 + Math.random() * 0.8}cqw`,
      tilt: `${Math.random() * 360}deg`,
      color: WHEEL_COLORS[i % WHEEL_COLORS.length],
    })),
  );
  return (
    <div data-testid="confetti" aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {pieces.map((piece, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: piece.left,
            width: piece.size,
            height: `calc(${piece.size} * 0.5)`,
            backgroundColor: piece.color,
            rotate: piece.tilt,
            animation: `confetti ${piece.duration} ${piece.delay} ease-in forwards`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

// Inside the stage, not the portal Modal, so it shows in fullscreen too.
function WinnerPanel({ entry, onClose }: { entry: WheelEntry; onClose: () => void }) {
  const c = useTheme();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      role="dialog"
      aria-label="Pemenang"
      data-testid="winner-panel"
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2cqw",
        padding: "4cqw",
        textAlign: "center",
        // 85% of the brand colour: the name and message read clearly, the wheel still shows where it stopped.
        backgroundColor: `${c.background}d9`,
      }}
    >
      {!reducedMotion() && <Confetti />}
      <div style={{ fontSize: "max(14px, 2.2cqw)", fontWeight: 600, color: c.gold }}>{entry.prize || "Pemenang"}</div>
      <div
        data-testid="winner-name"
        style={{ fontSize: "max(32px, 6.5cqw)", fontWeight: 800, lineHeight: 1.1, color: "#ffffff", animation: "reveal 420ms ease-out" }}
      >
        {entry.name}
      </div>
      {!!entry.note && (
        <div
          data-testid="winner-note"
          style={{
            fontSize: "max(15px, 2.2cqw)",
            fontStyle: "italic",
            lineHeight: 1.4,
            maxWidth: "70cqw",
            maxHeight: "11.2em",
            overflow: "hidden",
            color: "rgba(255, 255, 255, 0.85)",
          }}
        >
          “{entry.note}”
        </div>
      )}
      <div style={{ fontSize: "max(13px, 1.6cqw)", maxWidth: "60cqw", color: "rgba(255, 255, 255, 0.32)" }}>
        Nama ini keluar dari roda, tidak ikut putaran berikutnya.
      </div>
      <button
        ref={button}
        type="button"
        onClick={onClose}
        style={{
          marginTop: "1cqw",
          padding: "0.8cqw 2.6cqw",
          borderRadius: 999,
          border: "none",
          backgroundColor: "#ffffff",
          color: c.background,
          fontFamily: FONT_STACK,
          fontSize: "max(14px, 1.8cqw)",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Lanjut
      </button>
    </div>
  );
}
