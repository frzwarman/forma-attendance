import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { TextInput, View, useWindowDimensions } from "react-native";
import { DateInput, FileInput } from "../components/NativeInput";
import { Button, Card, Divider, Field, Row, SectionTitle, T } from "../components/ui";
import { checkInSchema, type CheckInInput } from "../domain/checkin";
import { whatsappLink } from "../domain/phone";
import { formatDateRange, formatWib } from "../domain/time";
import { submitCheckIn } from "../services/checkins";
import { useSettings } from "../services/settings";
import { ALLOWED_TYPES, UNSUPPORTED_FILE, uploadCheckInFile } from "../services/uploads";
import { FONT_STACK, useTheme } from "../theme";
import { MapPicker, type Pin } from "./checkin/MapPicker";

const empty: CheckInInput = {
  name: "",
  phone: "",
  email: "",
  jabatan: "",
  address: "",
  check_in_date: "",
  check_out_date: "",
};

export function CheckIn() {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const { settings } = useSettings();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CheckInInput>({ resolver: zodResolver(checkInSchema), defaultValues: empty });
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [duplicateAt, setDuplicateAt] = useState("");
  const [created, setCreated] = useState<CheckInInput>();
  const [pin, setPin] = useState<Pin | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);

  const submit = handleSubmit(async (input) => {
    if (fileError) return;
    setError("");
    setDuplicateAt("");
    try {
      let file_path: string | null = null;
      if (file) {
        setUploading(true);
        try {
          file_path = await uploadCheckInFile(file);
        } finally {
          setUploading(false);
        }
      }
      const result = await submitCheckIn(input, {
        file_path,
        honeypot,
        latitude: pin?.latitude ?? null,
        longitude: pin?.longitude ?? null,
      });
      if (result.status === "duplicate") setDuplicateAt(result.created_at);
      else setCreated(input);
    } catch (cause) {
      const message = (cause as Error).message;
      setError(message === "spam" ? "Pengiriman ditolak. Coba lagi." : message);
    }
  });

  if (created) {
    const rows: [string, string][] = [
      ["Nama", created.name],
      ["Nomor Telepon", created.phone],
      ["E-mail", created.email],
      ["Jabatan", created.jabatan],
      ["Alamat", created.address],
      ["Kunjungan", formatDateRange(created.check_in_date, created.check_out_date)],
    ];
    return (
      <Card elevated style={{ gap: 20 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: c.accentSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </View>
        <View style={{ gap: 6 }}>
          <T size={28} weight="extra" accessibilityRole="header">
            Terima kasih, {created.name}!
          </T>
          <T color={c.muted}>Check-in Anda sudah tercatat. Sampai jumpa di lokasi acara.</T>
        </View>
        <View style={{ backgroundColor: c.ground, borderRadius: 12, padding: 16, gap: 10 }}>
          {rows.map(([label, value]) => (
            <Row key={label} style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <T size={13} color={c.muted} style={{ width: 110 }}>
                {label}
              </T>
              <T size={14} weight="semibold" style={{ flex: 1, textAlign: "right" }}>
                {value}
              </T>
            </Row>
          ))}
        </View>
        {!!settings.whatsapp_number && (
          <a
            href={whatsappLink(settings.whatsapp_number)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              padding: "15px 20px",
              borderRadius: 999,
              backgroundColor: c.accent,
              color: c.onAccent,
              fontFamily: FONT_STACK,
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            Hubungi Panitia via WhatsApp
          </a>
        )}
        <Button
          variant="ghost"
          label="Isi check-in lain"
          onPress={() => {
            reset(empty);
            setPin(null);
            setFile(null);
            setFileError("");
            setCreated(undefined);
          }}
        />
      </Card>
    );
  }

  const text = (
    name: "name" | "phone" | "email" | "jabatan" | "address",
    label: string,
    props: Partial<React.ComponentProps<typeof Field>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field
          label={label}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors[name]?.message}
          editable={!isSubmitting}
          {...props}
        />
      )}
    />
  );
  const date = (name: "check_in_date" | "check_out_date", label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <DateInput label={label} value={field.value} onChange={field.onChange} error={errors[name]?.message} />
      )}
    />
  );

  return (
    <Card elevated style={{ gap: 22, padding: width < 400 ? 20 : 28 }}>
      <View style={{ gap: 4 }}>
        <T size={22} weight="extra" accessibilityRole="header">
          Formulir Check-in
        </T>
        <T size={14} color={c.muted}>
          Isi data berikut; proses hanya butuh satu menit.
        </T>
      </View>
      <SectionTitle title="Data diri" />
      {text("name", "Nama", { autoComplete: "name", placeholder: "Nama lengkap" })}
      {text("phone", "Nomor Telepon", { keyboardType: "phone-pad", inputMode: "tel", autoComplete: "tel", placeholder: "0812 3456 7890" })}
      {text("email", "E-mail", { keyboardType: "email-address", autoCapitalize: "none", autoComplete: "email", placeholder: "nama@instansi.go.id" })}
      {text("jabatan", "Jabatan", { placeholder: "Jabatan atau peran" })}
      <Divider />
      <SectionTitle title="Lokasi" description="Alamat asal, ditambah titik di peta jika berkenan." />
      {text("address", "Alamat", { multiline: true, placeholder: "Jalan, kota, provinsi", style: { minHeight: 88, textAlignVertical: "top" } })}
      <MapPicker value={pin} onChange={setPin} />
      <Divider />
      <SectionTitle title="Berkas pendukung" description="Opsional, misalnya surat tugas atau kartu identitas." />
      <FileInput
        label="Unggah Berkas (opsional)"
        accept="image/*,application/pdf"
        hint="Gambar atau PDF, maksimal 5 MB"
        error={fileError}
        onChange={(chosen) => {
          if (chosen && !ALLOWED_TYPES.includes(chosen.type)) {
            setFileError(UNSUPPORTED_FILE);
            setFile(null);
          } else {
            setFileError("");
            setFile(chosen);
          }
        }}
      />
      <Divider />
      <SectionTitle title="Tanggal kunjungan" />
      <Row style={{ gap: 12, alignItems: "flex-start", flexWrap: width < 380 ? "wrap" : "nowrap" }}>
        <View style={{ flex: 1, minWidth: 150 }}>{date("check_in_date", "Tanggal Check In")}</View>
        <View style={{ flex: 1, minWidth: 150 }}>{date("check_out_date", "Tanggal Check Out")}</View>
      </Row>
      <TextInput
        accessibilityLabel="Kosongkan kolom ini"
        aria-hidden
        tabIndex={-1}
        value={honeypot}
        onChangeText={setHoneypot}
        autoComplete="off"
        style={{ position: "absolute", left: -10000, width: 1, height: 1, opacity: 0 }}
      />
      {!!duplicateAt && (
        <T accessibilityRole="alert" color={c.danger}>
          Nomor telepon atau e-mail ini sudah terdaftar pada {formatWib(duplicateAt)}. Periksa kembali data Anda.
        </T>
      )}
      {!!error && (
        <T accessibilityRole="alert" color={c.danger}>
          {error}
        </T>
      )}
      <View style={{ marginTop: 4 }}>
        <Button
          large
          label="Kirim"
          loading={isSubmitting}
          loadingLabel={uploading ? "Mengunggah berkas…" : "Mengirim…"}
          onPress={submit}
        />
      </View>
    </Card>
  );
}
