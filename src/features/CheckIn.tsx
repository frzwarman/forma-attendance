import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { TextInput, View, useWindowDimensions } from "react-native";
import { Wand } from "../components/icons";
import { SelectInput } from "../components/NativeInput";
import { Button, Card, Divider, Field, SectionTitle, T } from "../components/ui";
import { checkInSchemaFor, sampleCheckIn, type CheckInInput } from "../domain/checkin";
import { maxLength, type Builtin, type FormField } from "../domain/formFields";
import { submitCheckIn } from "../services/checkins";
import { uploadCheckInFile } from "../services/uploads";
import { useTheme } from "../theme";
import type { CheckInDetails } from "./ThankYou";
import { Attachment } from "./checkin/Attachment";

// Hints for the two built-in questions, whatever the admin calls them.
const BUILTIN_PROPS: Record<Builtin, Partial<React.ComponentProps<typeof Field>>> = {
  divisi: { autoComplete: "organization-title", placeholder: "Contoh: Divisi Hukum" },
  room_number: { placeholder: "Contoh: 1205", hint: "Opsional. Kosongkan jika tidak menginap di hotel acara.", autoComplete: "off", autoCapitalize: "characters" },
};

// The check-in form: Nama, Nomor Telepon and E-mail, then the questions the admin set up.
// The page shows the thank-you popup once onCheckedIn fires.
export function CheckIn({ fields, onCheckedIn }: { fields: FormField[]; onCheckedIn: (details: CheckInDetails) => void }) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CheckInInput>({
    resolver: zodResolver(checkInSchemaFor(fields)),
    defaultValues: { name: "", phone: "", email: "", answers: Object.fromEntries(fields.map((field) => [field.id, ""])) },
  });
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);

  const submit = handleSubmit(async (input) => {
    if (fileError) return;
    setError("");
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
      const result = await submitCheckIn(input, fields, { file_path, honeypot });
      // Someone checking in again (every session) is welcomed like the first time.
      onCheckedIn({
        name: input.name.trim(),
        phone: input.phone,
        email: input.email,
        answers: fields.flatMap((field) => (input.answers[field.id] ? [[field.label, input.answers[field.id]] as [string, string]] : [])),
        at: result.status === "created" ? result.created_at : result.last_checked_in_at ?? new Date().toISOString(),
        token: result.checkout_token,
      });
    } catch (cause) {
      const message = (cause as Error).message;
      setError(message === "spam" ? "Pengiriman ditolak. Coba lagi." : message);
    }
  });

  const text = (
    name: "name" | "phone" | "email",
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
      {fields.map((question) => (
        <Controller
          key={question.id}
          control={control}
          name={`answers.${question.id}`}
          render={({ field }) => {
            const error = errors.answers?.[question.id]?.message;
            const hint = question.required ? undefined : "Opsional.";
            return question.type === "select" ? (
              <SelectInput label={question.label} value={field.value} options={question.options} onChange={field.onChange} error={error} hint={hint} disabled={isSubmitting} />
            ) : (
              <Field
                label={question.label}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={error}
                hint={hint}
                editable={!isSubmitting}
                maxLength={maxLength(question)}
                {...(question.type === "textarea" ? { multiline: true, style: { minHeight: 88, textAlignVertical: "top" as const } } : {})}
                {...(question.builtin ? BUILTIN_PROPS[question.builtin] : {})}
              />
            );
          }}
        />
      ))}
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
      {!!error && (
        <T accessibilityRole="alert" color={c.danger}>
          {error}
        </T>
      )}
      {/* Only when the page is opened on localhost: fills the form to save time while trying it out. */}
      {typeof location !== "undefined" && location.hostname === "localhost" && (
        <Button variant="secondary" small icon={Wand} label="Isi otomatis (localhost)" disabled={isSubmitting} onPress={() => reset(sampleCheckIn(fields))} />
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
