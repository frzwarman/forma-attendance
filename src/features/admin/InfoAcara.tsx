import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CircleCheck,
  FilePlus,
  FileText,
  ImagePlus,
  Link,
  Presentation,
  RotateCcw,
  Save,
  Trash,
  Upload,
  UserPlus,
  UserRound,
  Users,
  X,
} from "../../components/icons";
import { FileInput } from "../../components/NativeInput";
import { Badge, Button, Card, Divider, Field, IconHeading, Row, T } from "../../components/ui";
import type { EventContent, StoredImage } from "../../domain/eventContent";
import { formatFileSize } from "../../domain/files";
import { isMentimeterUrl } from "../../domain/mentimeter";
import { useAdminApi } from "../../services/adminContext";
import { BUILT_IN_CONTENT, eventObjectUrl, storedEventContent } from "../../services/eventInfo";
import { useSettings } from "../../services/settings";
import { useTheme } from "../../theme";

const move = <V,>(items: V[], from: number, to: number) => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};
const fileUrl = (path: string) => (path.startsWith("/") ? path : eventObjectUrl(path));
const withoutPdf = (name: string) => name.replace(/\.pdf$/i, "");

export function InfoAcara() {
  const c = useTheme();
  const { settings, ready, isError } = useSettings();
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 2 }}>
        <T size={28} weight="extra" accessibilityRole="header">
          Info acara
        </T>
        <T size={14} color={c.muted}>
          Rundown, narasumber, materi, dan tautan Mentimeter yang tampil di HP peserta.
        </T>
      </View>
      {isError ? (
        <Card>
          <T accessibilityRole="alert" color={c.danger}>
            Pengaturan gagal dimuat. Muat ulang halaman lalu coba lagi; formulir disembunyikan agar info acara tersimpan tidak tertimpa.
          </T>
        </Card>
      ) : !ready ? (
        <Card>
          <T color={c.muted}>Memuat info acara…</T>
        </Card>
      ) : (
        <Editor initial={storedEventContent(settings.event_content)} />
      )}
    </View>
  );
}

function Thumb({ image, size = 56 }: { image?: StoredImage; size?: number }) {
  const c = useTheme();
  if (!image) return null;
  return (
    <img
      src={fileUrl(image.path)}
      width={image.width}
      height={image.height}
      alt=""
      style={{
        display: "block",
        width: size,
        height: Math.round(size * 1.3),
        // The whole picture: profile pictures are often wide, CV pages tall.
        objectFit: "contain",
        borderRadius: 8,
        border: `1px solid ${c.border}`,
        backgroundColor: c.inputSurface,
        flexShrink: 0,
      }}
    />
  );
}

function Editor({ initial }: { initial: EventContent }) {
  const c = useTheme();
  const api = useAdminApi();
  const client = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const [link, setLink] = useState(initial.mentimeter_url ?? "");
  const [linkError, setLinkError] = useState("");
  // The progress of a PDF being converted or a file being uploaded; edits wait until it is done.
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Resets the file pickers after each upload, so the same file can be picked again.
  const [picks, setPicks] = useState(0);

  const change = (next: (current: EventContent) => EventContent) => {
    setSaved(false);
    setError("");
    setDraft(next);
  };
  const setSpeaker = (index: number, patch: Partial<EventContent["speakers"][number]>) =>
    change((d) => ({ ...d, speakers: d.speakers.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));

  async function upload(file: File | null, run: (file: File) => Promise<void>) {
    if (!file || busy) return;
    setError("");
    setSaved(false);
    setBusy("Mengunggah…");
    try {
      await run(file);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
      setPicks((n) => n + 1);
    }
  }

  async function save() {
    const url = link.trim();
    if (url && !isMentimeterUrl(url)) {
      setLinkError("Tautan harus diawali https://www.menti.com/ atau https://www.mentimeter.com/.");
      return;
    }
    const next: EventContent = {
      ...draft,
      mentimeter_url: url || null,
      speakers: draft.speakers.map((s) => ({ ...s, name: s.name.trim() || "Narasumber" })),
      materials: draft.materials.map((m) => ({ ...m, title: m.title.trim() || m.file_name })),
    };
    setSaving(true);
    setError("");
    try {
      const settings = await api.saveEventContent(next);
      client.setQueryData(["settings"], settings);
      const stored = storedEventContent(settings.event_content);
      setDraft(stored);
      setLink(stored.mentimeter_url ?? "");
      setSaved(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const locked = !!busy || saving;
  // A dashed box for "add another" uploads.
  const addBox = { padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", gap: 4 } as const;
  return (
    <Card style={{ gap: 18, maxWidth: 760 }}>
      <IconHeading icon={Presentation} tone="navy" title="Mentimeter" description="Salin tautan partisipasi di Mentimeter: Share, tab Participants, lalu Copy." />
      <Field
        label="Tautan Mentimeter"
        labelHidden
        leading={<Link size={16} color={c.muted} strokeWidth={2} />}
        value={link}
        onChangeText={(value) => {
          setLinkError("");
          setSaved(false);
          setLink(value);
        }}
        placeholder="https://www.menti.com/..."
        autoCapitalize="none"
        inputMode="url"
        hint="Kosongkan jika tidak memakai Mentimeter."
        error={linkError}
      />
      <Divider />

      <IconHeading icon={CalendarDays} tone="gold" title="Rundown acara" description="Unggah PDF rundown; peserta melihat setiap halaman sebagai gambar yang bisa digeser." />
      <Row style={{ gap: 14, padding: 12, borderRadius: 12, backgroundColor: c.ground, flexWrap: "wrap" }}>
        {draft.rundown.length ? (
          <>
            <Thumb image={draft.rundown[0]} />
            <View style={{ flex: 1, gap: 8, minWidth: 180 }}>
              <Badge tone="gold" icon={FileText} label={`${draft.rundown.length} halaman`} />
              <Row style={{ gap: 8, flexWrap: "wrap" }}>
                <FileInput
                  key={`rundown-${picks}`}
                  compact
                  label="Ganti rundown (PDF)"
                  buttonLabel="Ganti rundown"
                  icon={Upload}
                  accept="application/pdf"
                  onChange={(file) =>
                    void upload(file, async (pdf) => {
                      const pages = await api.uploadPdfPages(pdf, setBusy);
                      change((d) => ({ ...d, rundown: pages }));
                    })
                  }
                />
                <Button small variant="danger" icon={Trash} label="Hapus rundown" disabled={locked} onPress={() => change((d) => ({ ...d, rundown: [] }))} />
              </Row>
            </View>
          </>
        ) : (
          <View style={{ flex: 1, gap: 10 }}>
            <T size={14} color={c.muted}>
              Belum ada rundown; bagian ini tidak tampil di halaman peserta.
            </T>
            <FileInput
              key={`rundown-${picks}`}
              compact
              label="Unggah rundown (PDF)"
              buttonLabel="Unggah rundown"
              icon={Upload}
              accept="application/pdf"
              onChange={(file) =>
                void upload(file, async (pdf) => {
                  const pages = await api.uploadPdfPages(pdf, setBusy);
                  change((d) => ({ ...d, rundown: pages }));
                })
              }
            />
          </View>
        )}
      </Row>
      <Divider />

      <IconHeading
        icon={Users}
        tone="red"
        title={`Narasumber (${draft.speakers.length})`}
        description="Unggah CV dalam PDF. Foto profil (opsional) tampil di popup pembuka; tanpa foto, popup memakai halaman pertama CV."
      />
      {draft.speakers.map((speaker, i) => (
        <View
          key={i}
          style={{ gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, borderLeftWidth: 4, borderLeftColor: c.accent, backgroundColor: c.surface }}
        >
          <Row style={{ gap: 12, alignItems: "flex-start" }}>
            <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
              <T size={13} weight="bold" color={c.onAccent}>
                {i + 1}
              </T>
            </View>
            <Thumb image={speaker.profile ?? speaker.pages[0]} size={64} />
            <View style={{ flex: 1, gap: 8 }}>
              <Field
                labelHidden
                label={`Nama narasumber ${i + 1}`}
                leading={<UserRound size={16} color={c.muted} strokeWidth={2} />}
                value={speaker.name}
                onChangeText={(name) => setSpeaker(i, { name })}
              />
              <Row style={{ gap: 6, flexWrap: "wrap" }}>
                <Badge icon={FileText} label={`CV ${speaker.pages.length} halaman`} />
                {speaker.profile ? (
                  <Badge tone="success" icon={CircleCheck} label="Foto profil diunggah" />
                ) : (
                  <Badge tone="gold" icon={ImagePlus} label="Tanpa foto profil" />
                )}
              </Row>
            </View>
          </Row>
          <Row style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <FileInput
              key={`cv-${i}-${picks}`}
              compact
              label={`Ganti CV narasumber ${i + 1} (PDF)`}
              buttonLabel="Ganti CV"
              icon={FileText}
              accept="application/pdf"
              onChange={(file) =>
                void upload(file, async (pdf) => {
                  const pages = await api.uploadPdfPages(pdf, setBusy);
                  setSpeaker(i, { pages });
                })
              }
            />
            <FileInput
              key={`profile-${i}-${picks}`}
              compact
              label={`Foto profil narasumber ${i + 1}`}
              buttonLabel={speaker.profile ? "Ganti foto profil" : "Unggah foto profil"}
              icon={ImagePlus}
              accept="image/jpeg,image/png,image/webp"
              onChange={(file) =>
                void upload(file, async (picture) => {
                  const profile = await api.uploadProfileImage(picture);
                  setSpeaker(i, { profile });
                })
              }
            />
            {!!speaker.profile && (
              <Button small variant="ghost" icon={X} label="Hapus foto" accessibilityLabel={`Hapus foto profil narasumber ${i + 1}`} disabled={locked} onPress={() => setSpeaker(i, { profile: null })} />
            )}
          </Row>
          <Row style={{ gap: 4, alignItems: "center", flexWrap: "wrap", paddingTop: 10, borderTopWidth: 1, borderColor: c.border }}>
            <T size={12} color={c.muted} style={{ marginRight: 4 }}>
              Urutan
            </T>
            <Button small variant="ghost" icon={ArrowUp} label="Naik" accessibilityLabel={`Naikkan narasumber ${i + 1}`} disabled={locked || i === 0} onPress={() => change((d) => ({ ...d, speakers: move(d.speakers, i, i - 1) }))} />
            <Button
              small
              variant="ghost"
              icon={ArrowDown}
              label="Turun"
              accessibilityLabel={`Turunkan narasumber ${i + 1}`}
              disabled={locked || i === draft.speakers.length - 1}
              onPress={() => change((d) => ({ ...d, speakers: move(d.speakers, i, i + 1) }))}
            />
            <View style={{ flex: 1 }} />
            <Button
              small
              variant="danger"
              icon={Trash}
              label="Hapus narasumber"
              accessibilityLabel={`Hapus narasumber ${i + 1}`}
              disabled={locked}
              onPress={() => change((d) => ({ ...d, speakers: d.speakers.filter((_, j) => j !== i) }))}
            />
          </Row>
        </View>
      ))}
      <View style={{ ...addBox, borderColor: c.accent, backgroundColor: c.accentSoft }}>
        <FileInput
          key={`speaker-${picks}`}
          label="Tambah narasumber (CV PDF)"
          buttonLabel="Pilih CV"
          icon={UserPlus}
          accept="application/pdf"
          hint="Nama diambil dari nama berkas; ubah sesudahnya."
          onChange={(file) =>
            void upload(file, async (pdf) => {
              const pages = await api.uploadPdfPages(pdf, setBusy);
              change((d) => ({ ...d, speakers: [...d.speakers, { name: withoutPdf(pdf.name), pages, profile: null }] }));
            })
          }
        />
      </View>
      <Divider />

      <IconHeading icon={FileText} tone="navy" title="Materi" description="PDF yang bisa diunduh peserta, hingga 20 MB per berkas." />
      {draft.materials.map((material, i) => (
        <Row key={i} style={{ gap: 10, flexWrap: "wrap", padding: 10, borderRadius: 12, backgroundColor: c.ground }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
            <FileText size={20} color={c.background} />
          </View>
          <View style={{ flex: 1, gap: 4, minWidth: 200 }}>
            <Field
              labelHidden
              label={`Judul materi ${i + 1}`}
              value={material.title}
              onChangeText={(title) => change((d) => ({ ...d, materials: d.materials.map((m, j) => (j === i ? { ...m, title } : m)) }))}
            />
            <T size={12} color={c.muted}>
              {material.file_name}, {formatFileSize(material.size)}
            </T>
          </View>
          <Button small variant="ghost" icon={ArrowUp} label="Naik" accessibilityLabel={`Naikkan materi ${i + 1}`} disabled={locked || i === 0} onPress={() => change((d) => ({ ...d, materials: move(d.materials, i, i - 1) }))} />
          <Button
            small
            variant="ghost"
            icon={ArrowDown}
            label="Turun"
            accessibilityLabel={`Turunkan materi ${i + 1}`}
            disabled={locked || i === draft.materials.length - 1}
            onPress={() => change((d) => ({ ...d, materials: move(d.materials, i, i + 1) }))}
          />
          <Button
            small
            variant="danger"
            icon={Trash}
            label="Hapus"
            accessibilityLabel={`Hapus materi ${material.title || i + 1}`}
            disabled={locked}
            onPress={() => change((d) => ({ ...d, materials: d.materials.filter((_, j) => j !== i) }))}
          />
        </Row>
      ))}
      <View style={{ ...addBox, borderColor: c.border }}>
        <FileInput
          key={`material-${picks}`}
          label="Tambah materi (PDF)"
          buttonLabel="Pilih PDF"
          icon={FilePlus}
          accept="application/pdf"
          onChange={(file) =>
            void upload(file, async (pdf) => {
              const material = await api.uploadMaterial(pdf);
              change((d) => ({ ...d, materials: [...d.materials, material] }));
            })
          }
        />
      </View>
      <Divider />

      {!!busy && (
        <Row style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: c.goldSoft }}>
          <Upload size={18} color="#7a5a1f" strokeWidth={2.2} />
          <T accessibilityRole="status" size={14} weight="semibold" color="#7a5a1f">
            {busy}
          </T>
        </Row>
      )}
      <Row style={{ gap: 10, flexWrap: "wrap" }}>
        <Button icon={Save} label="Simpan" loading={saving} loadingLabel="Menyimpan…" disabled={!!busy} onPress={() => void save()} />
        <Button
          variant="secondary"
          icon={RotateCcw}
          label="Pakai data contoh"
          disabled={locked}
          onPress={() => {
            setLinkError("");
            setLink(BUILT_IN_CONTENT.mentimeter_url ?? "");
            change(() => BUILT_IN_CONTENT);
          }}
        />
      </Row>
      {!!error && (
        <T accessibilityRole="alert" color={c.danger}>
          {error}
        </T>
      )}
      {saved && (
        <T accessibilityRole="status" color={c.success} weight="semibold">
          Info acara disimpan. HP peserta menampilkannya saat halaman dibuka lagi.
        </T>
      )}
    </Card>
  );
}
