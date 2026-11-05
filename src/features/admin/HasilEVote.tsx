import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useBrandBackground } from "../../components/Brand";
import { Maximize } from "../../components/icons";
import { Button, Card, Row, T } from "../../components/ui";
import { shares, voteSubtitle, voteTitle } from "../../domain/evote";
import { usePollResults } from "../../services/adminContext";
import { FONT_STACK, useTheme } from "../../theme";

// The count for the big monitor: no settings here. Layar penuh fills the screen with the stage alone
// (Esc to go back). Sizes are in container units (cqw), so it reads the same on the page and on the monitor.
export function HasilEVote() {
  const c = useTheme();
  const results = usePollResults(2_000);
  const background = useBrandBackground();
  const stage = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const changed = () => setFull(!!stage.current && document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  async function fill() {
    setError("");
    try {
      await stage.current?.requestFullscreen();
    } catch (cause) {
      setError(`Layar penuh tidak bisa dibuka: ${(cause as Error).message}`);
    }
  }

  const data = results.data;
  const poll = data?.poll ?? null;
  const percent = data ? shares(data.counts, data.voters) : [];
  // Every option fits the stage whatever their number: two columns past 10 options, and each row's text and bar
  // sized from its share (in cqh) of the room under the header, capped at the sizes a short list has.
  const n = poll?.options.length ?? 0;
  const cols = n > 10 ? 2 : 1;
  const budget = 66 / Math.max(1, Math.ceil(n / cols));
  return (
    <View style={{ gap: 20 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <T size={28} weight="extra" accessibilityRole="header">
            Hasil E-Vote
          </T>
          <T size={14} color={c.muted}>
            Diperbarui otomatis setiap 2 detik. Layar penuh menampilkan hasilnya saja di monitor; tekan Esc untuk kembali.
          </T>
        </View>
        {document.fullscreenEnabled && <Button icon={Maximize} label="Layar penuh" onPress={() => void fill()} />}
      </Row>
      {!!error && (
        <T accessibilityRole="alert" color={c.danger}>
          {error}
        </T>
      )}
      {results.isError && !data ? (
        <Card>
          <T accessibilityRole="alert" color={c.danger}>
            {(results.error as Error).message}
          </T>
        </Card>
      ) : (
        <div
          ref={stage}
          data-testid="evote-stage"
          style={{
            // "size": the rows are measured in cqh too.
            containerType: "size",
            aspectRatio: "16 / 9",
            overflow: "auto",
            borderRadius: full ? 0 : 20,
            color: c.onBackground,
            backgroundColor: c.background,
            backgroundImage: `url(${background})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            fontFamily: FONT_STACK,
          }}
        >
          <div style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "min(2.4cqw, 3.5cqh)", padding: "3.5cqh 6cqw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "2cqw" }}>
              <div>
                <div style={{ fontSize: "max(22px, 4.2cqw)", fontWeight: 800, lineHeight: 1.1 }}>{poll ? voteTitle(poll, "Hasil E-Vote") : "Hasil E-Vote"}</div>
                {poll && <div style={{ marginTop: "0.8cqw", fontSize: "max(13px, 1.7cqw)", color: c.onBackgroundMuted }}>{voteSubtitle(poll)}</div>}
              </div>
              {poll && (
                <div
                  style={{
                    padding: "0.6cqw 1.6cqw",
                    borderRadius: 999,
                    fontSize: "max(12px, 1.5cqw)",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    color: poll.is_open ? "#0b3d1a" : "#ffffff",
                    backgroundColor: poll.is_open ? "#8ce99a" : "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {poll.is_open ? "Voting dibuka" : "Voting ditutup"}
                </div>
              )}
            </div>
            {!data ? (
              <div style={{ fontSize: "max(14px, 2cqw)", color: c.onBackgroundMuted }}>Memuat hasil…</div>
            ) : !poll ? (
              <div style={{ fontSize: "max(14px, 2cqw)", color: c.onBackgroundMuted }}>Belum ada voting. Buat pilihannya di halaman E-Vote.</div>
            ) : (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${Math.ceil(n / cols)}, auto)`,
                  gridAutoFlow: "column",
                  alignContent: "start",
                  columnGap: "4cqw",
                  rowGap: `min(2.4cqw, ${budget * 0.15}cqh)`,
                }}
              >
                {poll.options.map((option, i) => (
                  <div key={i} data-testid="result-row" style={{ display: "flex", flexDirection: "column", gap: `min(0.8cqw, ${budget * 0.08}cqh)`, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "2cqw",
                        fontSize: `max(12px, min(2.6cqw, ${budget * 0.4}cqh))`,
                        lineHeight: 1.15,
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{option}</span>
                      <span style={{ color: c.gold, whiteSpace: "nowrap" }}>
                        {(data.counts[i] ?? 0).toLocaleString("id-ID")} · {percent[i] ?? 0}%
                      </span>
                    </div>
                    <div style={{ height: `max(6px, min(2.4cqw, ${budget * 0.28}cqh))`, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.14)", overflow: "hidden" }}>
                      <div style={{ width: `${percent[i] ?? 0}%`, height: "100%", borderRadius: 999, backgroundColor: c.accent, transition: "width 500ms ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {poll && data && (
              <div style={{ marginTop: "auto", fontSize: "max(13px, 1.7cqw)", fontWeight: 600, color: results.isError ? "#ffc078" : "#8ce99a" }}>
                ● {data.voters.toLocaleString("id-ID")} orang sudah memilih · {results.isError ? "koneksi terputus, mencoba lagi…" : "diperbarui langsung"}
              </div>
            )}
          </div>
        </div>
      )}
    </View>
  );
}
