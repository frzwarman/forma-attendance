import { useQueryClient } from "@tanstack/react-query";
import { Asset } from "expo-asset";
import { RotateCcw, Save } from "../../components/icons";
import { useEffect, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Sphere } from "../../components/Brand";
import { ColorInput, FileInput } from "../../components/NativeInput";
import { Button, Card, Divider, Field, Row, SectionTitle, T } from "../../components/ui";
import { BAWASLU, isHexColor, type ThemeColors } from "../../domain/theme";
import { useAdminApi } from "../../services/adminContext";
import { brandImageUrl, settingsColors, useSettings } from "../../services/settings";
import { FONT_STACK, ThemeProvider, useTheme } from "../../theme";
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
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
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

  const form = (
    <Card style={{ gap: 18, flex: wide ? 1.15 : undefined }}>
      <SectionTitle title="Acara" description="Nama dan teks sambutan di halaman check-in." />
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
        placeholder="0812-3456-7890"
        hint="Kosongkan jika tidak ingin menampilkan tombol WhatsApp."
        editable={!busy}
      />
      <Divider />
      <SectionTitle title="Gambar" description="Logo tampil di atas kapsul putih; latar diperkecil otomatis ke 1920 px." />
      <FileInput label="Logo" accept="image/png,image/jpeg,image/webp" hint="PNG transparan dianjurkan" onChange={(file) => { setSaved(false); setLogoFile(file); }} />
      <FileInput label="Gambar latar" accept="image/png,image/jpeg,image/webp" hint="Foto atau key visual acara" onChange={(file) => { setSaved(false); setBackgroundFile(file); }} />
      <Divider />
      <SectionTitle title="Warna" description="Empat warna dasar; warna lainnya diturunkan otomatis." />
      <Row style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <ColorInput label="Warna aksen" value={draft.accent} onChange={(accent) => update({ accent })} />
        <ColorInput label="Warna latar" value={draft.background} onChange={(background) => update({ background })} />
        <ColorInput label="Warna permukaan" value={draft.surface} onChange={(surface) => update({ surface })} />
        <ColorInput label="Warna teks" value={draft.text} onChange={(text) => update({ text })} />
      </Row>
      <Row style={{ gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <Button icon={Save} label="Simpan" loading={busy} loadingLabel="Menyimpan…" onPress={() => void save()} />
        <Button
          variant="secondary"
          icon={RotateCcw}
          label="Gunakan preset Bawaslu"
          disabled={busy}
          onPress={() => {
            setLogoFile(null);
            setBackgroundFile(null);
            update({ ...BAWASLU, logo_path: null, background_path: null });
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
          Tampilan disimpan.
        </T>
      )}
    </Card>
  );

  const preview = (
    <View style={{ flex: wide ? 0.85 : undefined, gap: 12, alignItems: wide ? "center" : "flex-start" }}>
      <T size={13} weight="semibold" color={c.muted}>
        Pratinjau halaman check-in
      </T>
      <ThemeProvider colors={colors}>
        <div
          style={{
            width: 320,
            maxWidth: "100%",
            borderRadius: 40,
            padding: 10,
            backgroundColor: "#0b1220",
            boxShadow: c.shadow,
          }}
        >
          <div
            style={{
              borderRadius: 31,
              overflow: "hidden",
              minHeight: 560,
              backgroundColor: draft.background,
              backgroundImage: `url(${backgroundSrc})`,
              backgroundSize: "cover",
              backgroundPosition: "left top",
              padding: "28px 18px",
              fontFamily: FONT_STACK,
            }}
          >
            <Preview draft={draft} logoSrc={logoSrc} />
          </div>
        </div>
      </ThemeProvider>
    </View>
  );

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 2 }}>
        <T size={28} weight="extra" accessibilityRole="header">
          Tampilan
        </T>
        <T size={14} color={c.muted}>
          Perubahan terlihat di pratinjau sebelum disimpan.
        </T>
      </View>
      <Row style={{ gap: 24, alignItems: "flex-start", flexDirection: wide ? "row" : "column" }}>
        {form}
        {preview}
      </Row>
    </View>
  );
}

function Preview({ draft, logoSrc }: { draft: Draft; logoSrc: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 14, alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignSelf: "stretch", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "inline-flex", padding: "7px 12px", borderRadius: 999, backgroundColor: "#ffffff" }}>
          <img alt="" src={logoSrc} style={{ width: 110, height: "auto", display: "block" }} />
        </div>
        <Sphere width={96} />
      </div>
      <T size={22} weight="extra" color={c.onBackground}>
        {draft.event_name || "Buku Tamu"}
      </T>
      <T size={13} color={c.onBackgroundMuted}>
        {draft.welcome_text}
      </T>
      <Card style={{ gap: 12, padding: 16, alignSelf: "stretch" }}>
        <T weight="bold">Formulir Check-in</T>
        <View style={{ height: 38, borderRadius: 10, backgroundColor: c.inputSurface, borderWidth: 1, borderColor: c.border }} />
        <View style={{ height: 38, borderRadius: 10, backgroundColor: c.inputSurface, borderWidth: 1, borderColor: c.border }} />
        <Button label="Kirim" onPress={() => {}} />
      </Card>
    </View>
  );
}
