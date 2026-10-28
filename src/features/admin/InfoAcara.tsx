import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { FileText, Plus, RotateCcw, Save } from "../../components/icons";
import { FileInput } from "../../components/NativeInput";
import { Button, Card, Divider, Field, Row, SectionTitle, T } from "../../components/ui";
import { formatFileSize } from "../../domain/files";
import { isMentimeterUrl } from "../../domain/mentimeter";
import { SAMPLE_EVENT_INFO, saveEventInfo, useEventInfo, type EventInfo, type Material, type Room } from "../../services/eventInfo";
import { useTheme } from "../../theme";

// Mock mode keeps PDFs inline in localStorage, which holds only a few megabytes in all.
const MAX_MOCK_PDF = 1024 * 1024;

type Draft = Omit<EventInfo, "mentimeter_url"> & { mentimeter_url: string };
const toDraft = (info: EventInfo): Draft => ({ ...info, mentimeter_url: info.mentimeter_url ?? "" });

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function InfoAcara() {
  const c = useTheme();
  const client = useQueryClient();
  const info = useEventInfo();
  const [draft, setDraft] = useState(() => toDraft(info));
  const [linkError, setLinkError] = useState("");
  const [fileError, setFileError] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const update = (patch: Partial<Draft>) => {
    setSaved(false);
    setError("");
    setDraft((current) => ({ ...current, ...patch }));
  };
  const setRoom = (index: number, patch: Partial<Room>) =>
    update({ rooms: draft.rooms.map((room, i) => (i === index ? { ...room, ...patch } : room)) });
  const setMaterial = (index: number, patch: Partial<Material>) =>
    update({ materials: draft.materials.map((material, i) => (i === index ? { ...material, ...patch } : material)) });

  async function addMaterial(file: File | null) {
    setFileError("");
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setFileError("Pilih berkas PDF.");
      return;
    }
    if (file.size > MAX_MOCK_PDF) {
      setFileError("Mode contoh hanya menyimpan PDF hingga 1 MB.");
      return;
    }
    try {
      const url = await readDataUrl(file);
      const material = { title: file.name.replace(/\.pdf$/i, ""), file_name: file.name, url, size: file.size };
      setSaved(false);
      setDraft((current) => ({ ...current, materials: [...current.materials, material] }));
    } catch {
      setFileError("Berkas gagal dibaca. Coba lagi.");
    }
  }

  function save() {
    const link = draft.mentimeter_url.trim();
    if (link && !isMentimeterUrl(link)) {
      setLinkError("Tautan harus diawali https://www.menti.com/ atau https://www.mentimeter.com/.");
      return;
    }
    const rooms = draft.rooms
      .map((room) => ({ number: room.number.trim(), name: room.name.trim() }))
      .filter((room) => room.number || room.name);
    if (rooms.some((room) => !room.number)) {
      setError("Isi nomor ruang untuk setiap ruangan.");
      return;
    }
    const next: EventInfo = {
      mentimeter_url: link || null,
      rooms,
      materials: draft.materials.map((material) => ({ ...material, title: material.title.trim() || material.file_name })),
    };
    try {
      saveEventInfo(next);
    } catch {
      setError("Penyimpanan browser penuh. Hapus materi lain atau pakai PDF yang lebih kecil.");
      return;
    }
    client.setQueryData(["event-info"], next);
    setDraft(toDraft(next));
    setSaved(true);
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 2 }}>
        <T size={28} weight="extra" accessibilityRole="header">
          Info acara
        </T>
        <T size={14} color={c.muted}>
          Tautan Mentimeter, ruangan, dan materi yang tampil di halaman peserta setelah check-in.
        </T>
      </View>
      <Card style={{ gap: 18, maxWidth: 760 }}>
        <View style={{ padding: 14, borderRadius: 12, backgroundColor: c.goldSoft }}>
          <T size={13} color="#7a5a1f">
            Mode contoh: perubahan tersimpan di browser ini saja. HP peserta tetap menampilkan data contoh sampai fitur ini tersambung ke server.
          </T>
        </View>
        <SectionTitle title="Mentimeter" description="Salin tautan partisipasi di Mentimeter: Share, tab Participants, lalu Copy." />
        <Field
          label="Tautan Mentimeter"
          value={draft.mentimeter_url}
          onChangeText={(mentimeter_url) => {
            setLinkError("");
            update({ mentimeter_url });
          }}
          placeholder="https://www.menti.com/..."
          autoCapitalize="none"
          inputMode="url"
          hint="Kosongkan jika tidak memakai Mentimeter."
          error={linkError}
        />
        <Divider />
        <SectionTitle title="Ruangan" description="Nomor ruang dan kegiatan di dalamnya." />
        {draft.rooms.length > 0 && (
          <Row style={{ gap: 10 }}>
            <T size={13} weight="semibold" color={c.muted} style={{ width: 96 }}>
              Nomor ruang
            </T>
            <T size={13} weight="semibold" color={c.muted} style={{ flex: 1 }}>
              Kegiatan
            </T>
          </Row>
        )}
        {draft.rooms.map((room, i) => (
          <Row key={i} style={{ gap: 10 }}>
            <View style={{ width: 96 }}>
              <Field labelHidden label={`Nomor ruang ${i + 1}`} value={room.number} onChangeText={(number) => setRoom(i, { number })} placeholder="201" />
            </View>
            <View style={{ flex: 1 }}>
              <Field labelHidden label={`Kegiatan ruang ${i + 1}`} value={room.name} onChangeText={(name) => setRoom(i, { name })} placeholder="Pleno" />
            </View>
            <Button
              small
              variant="ghost"
              label="Hapus"
              accessibilityLabel={`Hapus ruang ${room.number || i + 1}`}
              onPress={() => update({ rooms: draft.rooms.filter((_, j) => j !== i) })}
            />
          </Row>
        ))}
        <View style={{ alignItems: "flex-start" }}>
          <Button small variant="secondary" icon={Plus} label="Tambah ruangan" onPress={() => update({ rooms: [...draft.rooms, { number: "", name: "" }] })} />
        </View>
        <Divider />
        <SectionTitle title="Materi" description="PDF yang bisa diunduh peserta. Mode contoh menyimpan berkas hingga 1 MB." />
        {draft.materials.map((material, i) => (
          <Row key={i} style={{ gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.inputSurface, alignItems: "center", justifyContent: "center" }}>
              <FileText size={20} color={c.muted} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Field labelHidden label={`Judul materi ${i + 1}`} value={material.title} onChangeText={(title) => setMaterial(i, { title })} />
              <T size={12} color={c.muted}>
                {material.file_name}, {formatFileSize(material.size)}
              </T>
            </View>
            <Button
              small
              variant="ghost"
              label="Hapus"
              accessibilityLabel={`Hapus materi ${material.title || i + 1}`}
              onPress={() => update({ materials: draft.materials.filter((_, j) => j !== i) })}
            />
          </Row>
        ))}
        <FileInput
          key={draft.materials.length}
          label="Tambah materi (PDF)"
          accept="application/pdf"
          error={fileError}
          onChange={(file) => void addMaterial(file)}
        />
        <Divider />
        <Row style={{ gap: 10, flexWrap: "wrap" }}>
          <Button icon={Save} label="Simpan" onPress={save} />
          <Button
            variant="secondary"
            icon={RotateCcw}
            label="Pakai data contoh"
            onPress={() => {
              setLinkError("");
              setFileError("");
              update(toDraft(SAMPLE_EVENT_INFO));
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
            Info acara disimpan di browser ini.
          </T>
        )}
      </Card>
    </View>
  );
}
