import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ArrowDown, ArrowUp, ClipboardList, Lock, Plus, RotateCcw, Save, Trash } from "../../components/icons";
import { Badge, Button, Card, Divider, Field, IconHeading, Row, T } from "../../components/ui";
import {
  BUILTIN_FIELDS,
  DEFAULT_FORM_FIELDS,
  FIELD_TYPES,
  FIXED_LABELS,
  formFieldsFrom,
  formFieldsProblem,
  type FieldType,
  type FormField,
} from "../../domain/formFields";
import { useAdminApi } from "../../services/adminContext";
import { useSettings } from "../../services/settings";
import { FONT_STACK, useTheme } from "../../theme";

const move = <V,>(items: V[], from: number, to: number) => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};
const newId = () => `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function Formulir() {
  const c = useTheme();
  const { settings, ready, isError } = useSettings();
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 2 }}>
        <T size={28} weight="extra" accessibilityRole="header">
          Formulir
        </T>
        <T size={14} color={c.muted}>
          Pertanyaan di formulir check-in peserta.
        </T>
      </View>
      {isError ? (
        <Card>
          <T accessibilityRole="alert" color={c.danger}>
            Pengaturan gagal dimuat. Muat ulang halaman lalu coba lagi; formulir disembunyikan agar pertanyaan tersimpan tidak tertimpa.
          </T>
        </Card>
      ) : !ready ? (
        <Card>
          <T color={c.muted}>Memuat formulir…</T>
        </Card>
      ) : (
        <Editor initial={formFieldsFrom(settings.form_fields)} />
      )}
    </View>
  );
}

function Editor({ initial }: { initial: FormField[] }) {
  const c = useTheme();
  const api = useAdminApi();
  const client = useQueryClient();
  const [fields, setFields] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const change = (next: FormField[]) => {
    setSaved(false);
    setError("");
    setFields(next);
  };
  const setField = (index: number, patch: Partial<FormField>) => change(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));

  async function save() {
    // Options are edited one per line; blank lines and repeats are dropped here.
    const next = fields.map((field) => ({
      ...field,
      label: field.label.trim(),
      options: field.type === "select" ? [...new Set(field.options.map((option) => option.trim()).filter(Boolean))] : [],
    }));
    const problem = formFieldsProblem(next);
    if (problem) return setError(problem);
    setSaving(true);
    setError("");
    try {
      const settings = await api.saveFormFields(next);
      client.setQueryData(["settings"], settings);
      setFields(formFieldsFrom(settings.form_fields));
      setSaved(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const missing = (["divisi", "room_number"] as const).filter((builtin) => !fields.some((field) => field.builtin === builtin));
  return (
    <Card style={{ gap: 18, maxWidth: 760 }}>
      <IconHeading icon={Lock} tone="navy" title="Pertanyaan tetap" description="Selalu ditanyakan: dipakai untuk mencegah pendaftaran ganda, check-out, dan undian." />
      <Row style={{ gap: 8, flexWrap: "wrap" }}>
        {FIXED_LABELS.map((label) => (
          <Badge key={label} icon={Lock} label={label} />
        ))}
      </Row>
      <Divider />

      <IconHeading
        icon={ClipboardList}
        tone="red"
        title={`Pertanyaan tambahan (${fields.length})`}
        description="Tampil sesudah E-mail, sesuai urutan ini. Jawaban yang sudah masuk tetap tersimpan dan ikut diekspor walau pertanyaannya dihapus atau diganti judulnya."
      />
      {fields.map((field, i) => (
        <View
          key={field.id}
          style={{ gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, borderLeftWidth: 4, borderLeftColor: c.accent, backgroundColor: c.surface }}
        >
          <Row style={{ gap: 12, alignItems: "flex-start" }}>
            <View style={{ width: 28, height: 28, marginTop: 9, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
              <T size={13} weight="bold" color={c.onAccent}>
                {i + 1}
              </T>
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Field labelHidden label={`Judul pertanyaan ${i + 1}`} placeholder="Contoh: Ukuran kaos" value={field.label} onChangeText={(label) => setField(i, { label })} maxLength={120} />
              <Row style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {field.builtin ? (
                  <Badge tone="gold" label={`Bawaan · ${FIELD_TYPES.text}`} />
                ) : (
                  <TypePicker label={`Jenis jawaban pertanyaan ${i + 1}`} value={field.type} onChange={(type) => setField(i, { type, options: type === "select" && !field.options.length ? [""] : field.options })} />
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 4, fontFamily: FONT_STACK, fontSize: 14, color: c.text, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    aria-label={`Wajib diisi: pertanyaan ${i + 1}`}
                    checked={field.required}
                    onChange={(event) => setField(i, { required: event.target.checked })}
                    style={{ width: 18, height: 18, accentColor: c.accent }}
                  />
                  Wajib diisi
                </label>
              </Row>
              {field.type === "select" && (
                <View style={{ gap: 6 }}>
                  <T size={13} weight="semibold">
                    Pilihan jawaban, satu per baris
                  </T>
                  <Field
                    labelHidden
                    label={`Pilihan jawaban pertanyaan ${i + 1}`}
                    multiline
                    placeholder={"S\nM\nL"}
                    value={field.options.join("\n")}
                    onChangeText={(text) => setField(i, { options: text.split("\n") })}
                    style={{ minHeight: 96, textAlignVertical: "top" }}
                  />
                </View>
              )}
            </View>
          </Row>
          <Row style={{ gap: 4, alignItems: "center", flexWrap: "wrap", paddingTop: 10, borderTopWidth: 1, borderColor: c.border }}>
            <T size={12} color={c.muted} style={{ marginRight: 4 }}>
              Urutan
            </T>
            <Button small variant="ghost" icon={ArrowUp} label="Naik" accessibilityLabel={`Naikkan pertanyaan ${i + 1}`} disabled={saving || i === 0} onPress={() => change(move(fields, i, i - 1))} />
            <Button small variant="ghost" icon={ArrowDown} label="Turun" accessibilityLabel={`Turunkan pertanyaan ${i + 1}`} disabled={saving || i === fields.length - 1} onPress={() => change(move(fields, i, i + 1))} />
            <View style={{ flex: 1 }} />
            <Button small variant="danger" icon={Trash} label="Hapus pertanyaan" accessibilityLabel={`Hapus pertanyaan ${i + 1}`} disabled={saving} onPress={() => change(fields.filter((_, j) => j !== i))} />
          </Row>
        </View>
      ))}
      <Row style={{ gap: 10, flexWrap: "wrap", padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.accent, backgroundColor: c.accentSoft }}>
        <Button small variant="secondary" icon={Plus} label="Tambah pertanyaan" disabled={saving} onPress={() => change([...fields, { id: newId(), label: "", type: "text", required: false, options: [] }])} />
        {missing.map((builtin) => (
          <Button key={builtin} small variant="ghost" icon={Plus} label={`Kembalikan ${BUILTIN_FIELDS[builtin].label}`} disabled={saving} onPress={() => change([...fields, BUILTIN_FIELDS[builtin]])} />
        ))}
      </Row>
      <Divider />
      <Row style={{ gap: 10, flexWrap: "wrap" }}>
        <Button icon={Save} label="Simpan" loading={saving} loadingLabel="Menyimpan…" onPress={() => void save()} />
        <Button variant="secondary" icon={RotateCcw} label="Pakai formulir bawaan" disabled={saving} onPress={() => change(DEFAULT_FORM_FIELDS)} />
      </Row>
      {!!error && (
        <T accessibilityRole="alert" color={c.danger}>
          {error}
        </T>
      )}
      {saved && (
        <T accessibilityRole="status" color={c.success} weight="semibold">
          Formulir disimpan. Peserta melihatnya saat halaman dibuka lagi.
        </T>
      )}
    </Card>
  );
}

// Teks singkat, Teks panjang or Pilihan, as a row of radio buttons.
function TypePicker({ label, value, onChange }: { label: string; value: FieldType; onChange: (type: FieldType) => void }) {
  const c = useTheme();
  return (
    <View accessibilityRole="radiogroup" aria-label={label} style={{ flexDirection: "row", padding: 3, borderRadius: 999, backgroundColor: c.inputSurface }}>
      {(Object.keys(FIELD_TYPES) as FieldType[]).map((type) => {
        const active = type === value;
        return (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            aria-checked={active}
            onPress={() => onChange(type)}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: active ? c.background : "transparent" }}
          >
            <T size={13} weight="semibold" color={active ? c.onBackground : c.text}>
              {FIELD_TYPES[type]}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
