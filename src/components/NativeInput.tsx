import { useState, type CSSProperties } from "react";
import { View } from "react-native";
import { FONT_STACK, useTheme } from "../theme";
import type { IconComponent } from "./icons";
import { Row, T } from "./ui";

// Web-only native inputs (date, file, colour) styled like Field.
export function useInputStyle(error?: string): CSSProperties {
  const c = useTheme();
  return {
    minHeight: 46,
    borderRadius: 10,
    border: `1px solid ${error ? c.danger : c.border}`,
    padding: "11px 14px",
    color: c.text,
    backgroundColor: c.inputSurface,
    fontFamily: FONT_STACK,
    fontSize: 16,
    width: "100%",
    boxSizing: "border-box",
  };
}

export function FileInput({
  label,
  accept,
  onChange,
  error,
  hint,
  icon: Icon,
  buttonLabel = "Pilih berkas",
  compact = false,
}: {
  label: string;
  accept: string;
  onChange: (file: File | null) => void;
  error?: string;
  hint?: string;
  icon?: IconComponent;
  // The text on the button, e.g. "Unggah CV"; the input's accessible name stays label.
  buttonLabel?: string;
  // Just the button: the label stays for screen readers, and no "Belum ada berkas" line.
  compact?: boolean;
}) {
  const c = useTheme();
  const [name, setName] = useState("");
  return (
    <View style={{ gap: 8 }}>
      {!compact && (
        <T size={14} weight="semibold">
          {label}
        </T>
      )}
      <Row style={{ gap: 12 }}>
        <label
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 999,
            border: `1px solid ${c.border}`,
            backgroundColor: c.surface,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: FONT_STACK,
            fontSize: 14,
            color: c.text,
            whiteSpace: "nowrap",
          }}
        >
          {Icon && <Icon size={17} color={c.text} strokeWidth={2.2} />}
          {buttonLabel}
          <input
            type="file"
            accept={accept}
            aria-label={label}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setName(file?.name ?? "");
              onChange(file);
            }}
            style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: 0, overflow: "hidden" }}
          />
        </label>
        {!compact && (
          <T size={13} color={c.muted} style={{ flex: 1 }}>
            {name || "Belum ada berkas"}
          </T>
        )}
      </Row>
      {!!hint && (
        <T size={12} color={c.muted}>
          {hint}
        </T>
      )}
      {!!error && (
        <T size={12} color={c.danger} accessibilityRole="alert">
          {error}
        </T>
      )}
    </View>
  );
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T size={14} weight="semibold">
        {label}
      </T>
      <Row style={{ gap: 12 }}>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ width: 56, height: 46, padding: 3, border: `1px solid ${c.border}`, borderRadius: 10, background: "transparent" }}
        />
        <T size={13} color={c.muted}>
          {value}
        </T>
      </Row>
    </View>
  );
}

// A dropdown for a question with fixed answers; "" is "nothing chosen yet".
export function SelectInput({
  label,
  value,
  options,
  onChange,
  error,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const c = useTheme();
  const style = useInputStyle(error);
  return (
    <View style={{ gap: 7 }}>
      <T size={14} weight="semibold">
        {label}
      </T>
      <select aria-label={label} aria-invalid={!!error} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} style={{ ...style, color: value ? c.text : c.muted }}>
        <option value="">Pilih…</option>
        {options.map((option) => (
          <option key={option} value={option} style={{ color: c.text }}>
            {option}
          </option>
        ))}
      </select>
      {!!hint && !error && (
        <T size={12} color={c.muted}>
          {hint}
        </T>
      )}
      {!!error && (
        <T size={12} color={c.danger} accessibilityRole="alert">
          {error}
        </T>
      )}
    </View>
  );
}
