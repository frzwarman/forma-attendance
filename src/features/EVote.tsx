import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { CircleCheck, Lock } from "../components/icons";
import { Button, Card, T } from "../components/ui";
import { pickInstruction, togglePick, type Poll } from "../domain/evote";
import { castBallot, rememberBallot, storedBallot, useCurrentPoll } from "../services/evote";
import { FONT_STACK, useTheme } from "../theme";

// The public E-Vote: the vote under way, once per phone; afterwards (or while there is none to vote
// in) the attendee goes on to Registrasi.
export function EVote() {
  const c = useTheme();
  const poll = useCurrentPoll();
  // Picks sent from this page; earlier ones come from the phone's storage.
  const [sent, setSent] = useState<{ pollId: string; picks: number[] }>();
  const [notice, setNotice] = useState("");
  if (poll.isPending)
    return (
      <Card elevated>
        <T color={c.muted}>Memuat…</T>
      </Card>
    );
  if (poll.isError && poll.data === undefined)
    return (
      <Card elevated style={{ gap: 14 }}>
        <T accessibilityRole="alert" color={c.danger}>
          E-Vote gagal dimuat. Periksa koneksi internet lalu coba lagi.
        </T>
        <Button variant="secondary" label="Coba lagi" onPress={() => void poll.refetch()} />
      </Card>
    );
  const current = poll.data;
  const mine = current ? (sent?.pollId === current.id ? sent.picks : storedBallot(current.id)) : undefined;
  if (current?.is_open && !mine)
    return (
      <Ballot
        key={current.id}
        poll={current}
        notice={notice}
        onVoted={(picks) => setSent({ pollId: current.id, picks })}
        onChanged={() => setNotice("Voting dimulai ulang. Silakan pilih lagi.")}
      />
    );
  return (
    <View style={{ gap: 16 }}>
      <Card elevated style={{ alignItems: "center", gap: 10 }}>
        {current && mine ? (
          <>
            <CircleCheck size={48} color={c.success} />
            <T size={24} weight="extra" accessibilityRole="header">
              Terima kasih!
            </T>
            <T color={c.muted}>Suara Anda sudah tercatat:</T>
            <T testID="my-picks" size={17} weight="bold" style={{ textAlign: "center" }}>
              {mine.map((i) => current.options[i]).filter(Boolean).join(", ")}
            </T>
          </>
        ) : (
          <>
            <Lock size={40} color={c.muted} />
            <T size={22} weight="extra" accessibilityRole="header">
              {current ? "Voting sudah ditutup" : "Voting belum dibuka"}
            </T>
            <T color={c.muted} style={{ textAlign: "center" }}>
              {current ? "Terima kasih atas partisipasinya." : "Halaman ini menampilkan pilihannya begitu panitia membuka voting."}
            </T>
          </>
        )}
      </Card>
      <Button large href="/registrasi" label="Lanjut ke Registrasi" />
    </View>
  );
}

function Ballot({ poll, notice, onVoted, onChanged }: { poll: Poll; notice: string; onVoted: (picks: number[]) => void; onChanged: () => void }) {
  const c = useTheme();
  const client = useQueryClient();
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const single = poll.max_picks === 1;
  const full = !single && picked.length >= poll.max_picks;
  const instruction = pickInstruction(poll.max_picks);

  async function send() {
    if (busy || !picked.length) return;
    setBusy(true);
    setError("");
    try {
      const result = await castBallot(poll.id, picked);
      if (result.status === "recorded" || result.status === "already") {
        rememberBallot(poll.id, result.picks);
        return onVoted(result.picks);
      }
      // Closed meanwhile: show it now; changed: load the new vote.
      if (result.status === "closed") client.setQueryData<Poll>(["poll"], { ...poll, is_open: false });
      else onChanged();
      await client.invalidateQueries({ queryKey: ["poll"] });
    } catch (cause) {
      setError(`Suara gagal dikirim: ${(cause as Error).message}. Coba lagi.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card elevated style={{ gap: 16 }}>
      {!!notice && (
        <T accessibilityRole="alert" color={c.danger} weight="semibold">
          {notice}
        </T>
      )}
      <T size={20} weight="extra" accessibilityRole="header">
        {instruction}
      </T>
      {/* Native radio buttons and checkboxes: keyboard and screen readers work as everywhere else. */}
      <div role={single ? "radiogroup" : "group"} aria-label={instruction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {poll.options.map((option, i) => {
          const checked = picked.includes(i);
          const disabled = busy || (full && !checked);
          return (
            <label
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                minHeight: 56,
                padding: "12px 16px",
                boxSizing: "border-box",
                borderRadius: 12,
                border: `2px solid ${checked ? c.accent : c.border}`,
                backgroundColor: checked ? c.accentSoft : c.surface,
                color: c.text,
                fontFamily: FONT_STACK,
                fontSize: 16,
                fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: full && !checked ? 0.5 : 1,
              }}
            >
              <input
                type={single ? "radio" : "checkbox"}
                name={single ? `poll-${poll.id}` : undefined}
                checked={checked}
                disabled={disabled}
                onChange={() => setPicked(togglePick(picked, i, poll.max_picks))}
                style={{ width: 22, height: 22, margin: 0, flexShrink: 0, accentColor: c.accent }}
              />
              {option}
            </label>
          );
        })}
      </div>
      {!single && (
        <T size={13} color={c.muted}>
          {picked.length} dari {poll.max_picks} dipilih
        </T>
      )}
      {!!error && (
        <T accessibilityRole="alert" color={c.danger}>
          {error}
        </T>
      )}
      <Button large label="Kirim suara" loading={busy} loadingLabel="Mengirim…" disabled={!picked.length} onPress={() => void send()} />
    </Card>
  );
}
