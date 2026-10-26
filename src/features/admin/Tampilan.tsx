import { useQueryClient } from "@tanstack/react-query";
import { Asset } from "expo-asset";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { ColorInput, FileInput } from "../../components/NativeInput";
import { Button, Card, Field, Row, T } from "../../components/ui";
import { BAWASLU, isHexColor, type ThemeColors } from "../../domain/theme";
import { brandImageUrl, settingsColors, useSettings } from "../../services/settings";
import { useAdminApi } from "../../services/adminContext";
import { ThemeProvider, useTheme } from "../../theme";
import type { Settings } from "../../types/guestbook";

type Draft = ThemeColors & {
  event_name: string;
  welcome_text: string;
  whatsapp_number: string;
  logo_path: string | null;
  background_path: string | null;
};
const fromSettings = (settings: Settings): Draft => ({
  ...settingsColors(settings),
  event_name: settings.event_name,
  welcome_text: settings.welcome_text,
  whatsapp_number: settings.whatsapp_number ?? "",
  logo_path: settings.logo_path,
  background_path: settings.background_path,
});
const bundledLogo = require("../../../assets/brand/bawaslu-logo.png");
const bundledBackground = require("../../../assets/brand/bawaslu-background.jpg");

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

export function Tampilan() {
  const c = useTheme();
  const { settings, ready, isError } = useSettings();
  if (isError)
    return (
      <Card>
        <T accessibilityRole="alert" color={c.danger}>
          Pengaturan gagal dimuat. Muat ulang halaman lalu coba lagi; formulir disembunyikan agar tampilan tersimpan tidak tertimpa.
        </T>
      </Card>
    );
  if (!ready)
    return (
      <Card>
        <T color={c.muted}>Memuat pengaturan…</T>
      </Card>
    );
  return <TampilanForm initial={settings} />;
}

function TampilanForm({ initial }: { initial: Settings }) {
  const c = useTheme();
  const client = useQueryClient();
  const api = useAdminApi();
  const [draft, setDraft] = useState<Draft>(() => fromSettings(initial));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const logoPreview = useObjectUrl(logoFile);
  const backgroundPreview = useObjectUrl(backgroundFile);

  const update = (patch: Partial<Draft>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };
  const colors: ThemeColors = { accent: draft.accent, background: draft.background, surface: draft.surface, text: draft.text };
  const logoSrc = logoPreview ?? brandImageUrl(draft.logo_path) ?? Asset.fromModule(bundledLogo).uri;
  const backgroundSrc = backgroundPreview ?? brandImageUrl(draft.background_path) ?? Asset.fromModule(bundledBackground).uri;

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      for (const value of [draft.accent, draft.background, draft.surface, draft.text])
        if (!isHexColor(value)) throw new Error("Warna harus berformat #rrggbb");
      const patch: Partial<Omit<Settings, "id" | "updated_at">> = {
        event_name: draft.event_name.trim() || "Buku Tamu",
        welcome_text: draft.welcome_text.trim(),
        whatsapp_number: draft.whatsapp_number.trim() || null,
        accent_color: draft.accent.toLowerCase(),
        background_color: draft.background.toLowerCase(),
        surface_color: draft.surface.toLowerCase(),
        text_color: draft.text.toLowerCase(),
        logo_path: logoFile ? await api.uploadBrandImage("logo", logoFile) : draft.logo_path,
        background_path: backgroundFile ? await api.uploadBrandImage("background", backgroundFile) : draft.background_path,
      };
      const next = await api.updateSettings(patch);
      client.setQueryData(["settings"], next);
      setDraft(fromSettings(next));
      setLogoFile(null);
      setBackgroundFile(null);
      setSaved(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 20 }}>
      <Card style={{ gap: 16 }}>
        <T size={22} weight="bold" accessibilityRole="header">
          Tampilan
        </T>
        <Field label="Nama acara" value={draft.event_name} onChangeText={(event_name) => update({ event_name })} editable={!busy} />
        <Field
          label="Teks sambutan"
          value={draft.welcome_text}
          onChangeText={(welcome_text) => update({ welcome_text })}
          multiline
          style={{ minHeight: 88, textAlignVertical: "top" }}
          editable={!busy}
        />
        <Field
          label="Nomor WhatsApp panitia"
          value={draft.whatsapp_number}
          onChangeText={(whatsapp_number) => update({ whatsapp_number })}
          keyboardType="phone-pad"
          placeholder="0812-3456-7890 (kosongkan jika tidak ada)"
          editable={!busy}
        />
        <FileInput label="Logo" accept="image/png,image/jpeg,image/webp" hint="PNG transparan dianjurkan" onChange={(file) => { setSaved(false); setLogoFile(file); }} />
        <FileInput label="Gambar latar" accept="image/png,image/jpeg,image/webp" hint="Diperkecil otomatis ke 1920 px" onChange={(file) => { setSaved(false); setBackgroundFile(file); }} />
        <Row style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <ColorInput label="Warna aksen" value={draft.accent} onChange={(accent) => update({ accent })} />
          <ColorInput label="Warna latar" value={draft.background} onChange={(background) => update({ background })} />
          <ColorInput label="Warna permukaan" value={draft.surface} onChange={(surface) => update({ surface })} />
          <ColorInput label="Warna teks" value={draft.text} onChange={(text) => update({ text })} />
        </Row>
        <Row style={{ gap: 10, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            label="Gunakan preset Bawaslu"
            disabled={busy}
            onPress={() => {
              setLogoFile(null);
              setBackgroundFile(null);
              update({ ...BAWASLU, logo_path: null, background_path: null });
            }}
          />
          <Button label="Simpan" loading={busy} loadingLabel="Menyimpan…" onPress={() => void save()} />
        </Row>
        {!!error && (
          <T accessibilityRole="alert" color={c.danger}>
            {error}
          </T>
        )}
        {saved && (
          <T accessibilityRole="status" color={c.success}>
            Tampilan disimpan.
          </T>
        )}
      </Card>
      <Card style={{ gap: 12 }}>
        <T size={16} weight="bold" accessibilityRole="header">
          Pratinjau halaman publik
        </T>
        <ThemeProvider colors={colors}>
          <div
            style={{
              backgroundColor: draft.background,
              backgroundImage: `url(${backgroundSrc})`,
              backgroundSize: "cover",
              backgroundPosition: "left top",
              borderRadius: 6,
              padding: 20,
            }}
          >
            <View style={{ gap: 12, maxWidth: 420 }}>
              <img alt="" src={logoSrc} style={{ width: 180, height: "auto", display: "block" }} />
              <Preview draft={draft} />
            </View>
          </div>
        </ThemeProvider>
      </Card>
    </View>
  );
}

function Preview({ draft }: { draft: Draft }) {
  const c = useTheme();
  return (
    <>
      <T size={22} weight="bold" color={c.onBackground}>
        {draft.event_name || "Buku Tamu"}
      </T>
      <T color={c.onBackground}>{draft.welcome_text}</T>
      <Card style={{ gap: 12 }}>
        <T weight="bold">Formulir Check-in</T>
        <Button label="Kirim" onPress={() => {}} />
      </Card>
    </>
  );
}
