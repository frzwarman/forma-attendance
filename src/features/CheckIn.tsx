import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { TextInput, View, useWindowDimensions } from "react-native";
import { Button, Card, Divider, Field, SectionTitle, T } from "../components/ui";
import { checkInSchema, type CheckInInput } from "../domain/checkin";
import { formatWib } from "../domain/time";
import { submitCheckIn } from "../services/checkins";
import { uploadCheckInFile } from "../services/uploads";
import { useTheme } from "../theme";
import type { CheckInDetails } from "./ThankYou";
import { Attachment } from "./checkin/Attachment";

const empty: CheckInInput = {
  name: "",
  phone: "",
  email: "",
  room_number: "",
};

// The check-in form; the page shows the thank-you popup once onCheckedIn fires.
export function CheckIn({ onCheckedIn }: { onCheckedIn: (details: CheckInDetails) => void }) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckInInput>({ resolver: zodResolver(checkInSchema), defaultValues: empty });
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [duplicateAt, setDuplicateAt] = useState("");
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
      const result = await submitCheckIn(input, { file_path, honeypot });
      if (result.status === "duplicate") setDuplicateAt(result.created_at);
      else onCheckedIn({ ...input, name: input.name.trim(), at: result.created_at, token: result.checkout_token });
    } catch (cause) {
      const message = (cause as Error).message;
      setError(message === "spam" ? "Pengiriman ditolak. Coba lagi." : message);
    }
  });

  const text = (
    name: "name" | "phone" | "email" | "room_number",
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
      {text("room_number", "Nomor Kamar Hotel", {
        placeholder: "Contoh: 1205",
        hint: "Opsional. Kosongkan jika tidak menginap di hotel acara.",
        maxLength: 20,
        autoComplete: "off",
        autoCapitalize: "characters",
      })}
      <Divider />
      <SectionTitle title="Berkas pendukung" description="Opsional: foto surat tugas atau kartu identitas, atau berkas PDF." />
      <Attachment
        file={file}
        error={fileError}
        onChange={(chosen) => {
          setFileError("");
          setFile(chosen);
        }}
        onError={(message) => {
          setFile(null);
          setFileError(message);
        }}
      />
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
          Nomor telepon atau e-mail ini sudah terdaftar pada {formatWib(duplicateAt)}. Periksa kembali data Anda. Untuk check-out, buka tautan ini di HP yang dipakai saat check-in, atau hubungi panitia.
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
