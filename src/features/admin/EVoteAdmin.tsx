import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { Lock, Plus, Save, Trash, Vote } from "../../components/icons";
import { Modal } from "../../components/Modal";
import { Badge, Button, Card, Divider, Field, IconHeading, Row, T } from "../../components/ui";
import { normalizeOptions, OPTION_LENGTH_MAX, OPTIONS_MAX, OPTIONS_MIN, pollProblem, sameVote, type Poll } from "../../domain/evote";
import { useAdminApi, usePollResults } from "../../services/adminContext";
import { useTheme } from "../../theme";

// The E-Vote settings: the options, how many each person may pick, open and close. The count is on
// Hasil E-Vote, a page of its own for the monitor.
export function EVoteAdmin() {
  const c = useTheme();
  const results = usePollResults(5_000);
  // Kept here: a new vote remounts the editor below.
  const [notice, setNotice] = useState("");
  const data = results.data;
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 2 }}>
        <T size={28} weight="extra" accessibilityRole="header">
          E-Vote
        </T>
        <T size={14} color={c.muted}>
          Pilihan yang tampil di halaman E-Vote peserta. Hasilnya tampil di Hasil E-Vote.
        </T>
      </View>
      {results.isError && !data ? (
        <Card>
          <T accessibilityRole="alert" color={c.danger}>
            {(results.error as Error).message}
          </T>
        </Card>
      ) : !data ? (
        <Card>
          <T color={c.muted}>Memuat…</T>
        </Card>
      ) : (
        <Editor key={data.poll?.id ?? "none"} poll={data.poll} voters={data.voters} notice={notice} onNotice={setNotice} />
      )}
    </View>
  );
}

function Editor({ poll, voters, notice, onNotice }: { poll: Poll | null; voters: number; notice: string; onNotice: (text: string) => void }) {
  const c = useTheme();
  const api = useAdminApi();
  const client = useQueryClient();
  const [options, setOptions] = useState<string[]>(poll?.options ?? ["", ""]);
  const [maxPicks, setMaxPicks] = useState(poll?.max_picks ?? 1);
  const [busy, setBusy] = useState<"" | "save" | "close">("");
  const [error, setError] = useState("");
  // The options waiting for Ya, mulai voting baru.
  const [confirming, setConfirming] = useState<string[]>();

  function edit(next: string[]) {
    setError("");
    onNotice("");
    setOptions(next);
    setMaxPicks((max) => Math.min(max, next.length));
  }

  function ask() {
    const next = normalizeOptions(options);
    const problem = pollProblem(next, maxPicks);
    if (problem) return setError(problem);
    // Votes already in would no longer count: ask first.
    if (poll && voters > 0 && !sameVote(poll, next, maxPicks)) return setConfirming(next);
    void save(next);
  }

  async function save(next: string[]) {
    setBusy("save");
    setError("");
    onNotice("");
    try {
      const saved = await api.savePoll(next, maxPicks);
      setConfirming(undefined);
      setOptions(saved.options);
      onNotice(saved.id === poll?.id ? "Voting dibuka lagi." : "Voting baru dibuka.");
      await client.invalidateQueries({ queryKey: ["poll-results"] });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function close() {
    setBusy("close");
    setError("");
    onNotice("");
    try {
      await api.closePoll();
      onNotice("Voting ditutup. Peserta tidak bisa memilih lagi.");
      await client.invalidateQueries({ queryKey: ["poll-results"] });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  const status = !poll
    ? ({ label: "Belum ada voting", tone: "neutral" } as const)
    : poll.is_open
      ? ({ label: "Voting dibuka", tone: "success" } as const)
      : ({ label: "Voting ditutup", tone: "danger" } as const);
  return (
    <Card style={{ gap: 18, maxWidth: 640 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <IconHeading icon={Vote} tone="red" title="Pilihan" description="Peserta memilih dari daftar ini. Mengubah pilihan memulai voting baru yang dihitung dari nol." />
        </View>
        <Badge tone={status.tone} label={status.label} />
      </Row>
      {options.map((option, i) => (
        <Row key={i} style={{ gap: 8, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Field
              labelHidden
              label={`Pilihan ${i + 1}`}
              placeholder={`Pilihan ${i + 1}`}
              value={option}
              maxLength={OPTION_LENGTH_MAX}
              editable={!busy}
              onChangeText={(text) => edit(options.map((value, j) => (j === i ? text : value)))}
            />
          </View>
          <Button
            small
            variant="danger"
            icon={Trash}
            label="Hapus"
            accessibilityLabel={`Hapus pilihan ${i + 1}`}
            disabled={!!busy || options.length <= OPTIONS_MIN}
            onPress={() => edit(options.filter((_, j) => j !== i))}
          />
        </Row>
      ))}
      <Row>
        <Button small variant="secondary" icon={Plus} label="Tambah pilihan" disabled={!!busy || options.length >= OPTIONS_MAX} onPress={() => edit([...options, ""])} />
      </Row>
      <Divider />
      <Row style={{ gap: 10, flexWrap: "wrap" }}>
        <T weight="semibold">Boleh pilih</T>
        <Button small variant="secondary" label="−" accessibilityLabel="Kurangi jumlah pilihan" disabled={!!busy || maxPicks <= 1} onPress={() => setMaxPicks(maxPicks - 1)} />
        <T testID="max-picks" size={18} weight="bold" style={{ minWidth: 24, textAlign: "center" }}>
          {maxPicks}
        </T>
        <Button
          small
          variant="secondary"
          label="+"
          accessibilityLabel="Tambah jumlah pilihan"
          disabled={!!busy || maxPicks >= options.length}
          onPress={() => setMaxPicks(maxPicks + 1)}
        />
        <T>pilihan per orang</T>
      </Row>
      <Divider />
      <Row style={{ gap: 10, flexWrap: "wrap" }}>
        <Button icon={Save} label="Simpan & buka voting" loading={busy === "save"} loadingLabel="Menyimpan…" disabled={busy === "close"} onPress={ask} />
        <Button
          variant="secondary"
          icon={Lock}
          label="Tutup voting"
          loading={busy === "close"}
          loadingLabel="Menutup…"
          disabled={busy === "save" || !poll?.is_open}
          onPress={() => void close()}
        />
      </Row>
      {!!error && !confirming && (
        <T accessibilityRole="alert" color={c.danger}>
          {error}
        </T>
      )}
      {!!notice && (
        <T accessibilityRole="status" color={c.success} weight="semibold">
          {notice}
        </T>
      )}
      {confirming && (
        <Modal label="Mulai voting baru" maxWidth={460} onClose={() => !busy && setConfirming(undefined)}>
          <View style={{ padding: 24, paddingTop: 28, gap: 16 }}>
            <T size={22} weight="extra" accessibilityRole="header" style={{ paddingRight: 48 }}>
              Mulai voting baru?
            </T>
            <T color={c.muted}>
              Pilihannya berubah, jadi hitungan mulai dari nol dan setiap HP bisa memilih lagi. Hasil voting sekarang ({voters.toLocaleString("id-ID")} orang) tidak
              ditampilkan lagi.
            </T>
            {!!error && (
              <T accessibilityRole="alert" color={c.danger}>
                {error}
              </T>
            )}
            <Row style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button variant="ghost" label="Batal" disabled={!!busy} onPress={() => setConfirming(undefined)} />
              <Button label="Ya, mulai voting baru" loading={busy === "save"} loadingLabel="Menyimpan…" onPress={() => void save(confirming)} />
            </Row>
          </View>
        </Modal>
      )}
    </Card>
  );
}
