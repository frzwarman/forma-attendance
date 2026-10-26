import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { TextInput, View } from "react-native";
import { DateInput, FileInput } from "../components/NativeInput";
import { Button, Card, Field, Row, T } from "../components/ui";
import { checkInSchema, type CheckInInput } from "../domain/checkin";
import { whatsappLink } from "../domain/phone";
import { formatWib } from "../domain/time";
import { submitCheckIn } from "../services/checkins";
import { ALLOWED_TYPES, UNSUPPORTED_FILE, uploadCheckInFile } from "../services/uploads";
import { MapPicker, type Pin } from "./checkin/MapPicker";
import { useSettings } from "../services/settings";
import { useTheme } from "../theme";

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
      ["Tanggal", `${created.check_in_date} – ${created.check_out_date}`],
    ];
    return (
      <Card style={{ gap: 14 }}>
        <T size={22} weight="bold" accessibilityRole="header">
          Terima kasih, {created.name}!
        </T>
        <T color={c.muted}>Check-in Anda sudah tercatat.</T>
        {rows.map(([label, value]) => (
          <Row key={label} style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <T color={c.muted}>{label}</T>
            <T weight="medium" style={{ flex: 1, textAlign: "right" }}>
              {value}
            </T>
          </Row>
        ))}
        {!!settings.whatsapp_number && (
          <a
            href={whatsappLink(settings.whatsapp_number)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              padding: "14px 20px",
              borderRadius: 100,
              backgroundColor: c.accent,
              color: c.onAccent,
              fontFamily: "Arial",
              fontWeight: 600,
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
    <Card style={{ gap: 18 }}>
      <T size={18} weight="bold" accessibilityRole="header">
        Formulir Check-in
      </T>
      {text("name", "Nama", { autoComplete: "name" })}
      {text("phone", "Nomor Telepon", { keyboardType: "phone-pad", inputMode: "tel", autoComplete: "tel" })}
      {text("email", "E-mail", { keyboardType: "email-address", autoCapitalize: "none", autoComplete: "email" })}
      {text("jabatan", "Jabatan")}
      {text("address", "Alamat", { multiline: true, style: { minHeight: 88, textAlignVertical: "top" } })}
      <MapPicker value={pin} onChange={setPin} />
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
      {date("check_in_date", "Tanggal Check In")}
      {date("check_out_date", "Tanggal Check Out")}
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
      <View style={{ marginTop: 6 }}>
        <Button
          label="Kirim"
          loading={isSubmitting}
          loadingLabel={uploading ? "Mengunggah berkas…" : "Mengirim…"}
          onPress={submit}
        />
      </View>
    </Card>
  );
}
