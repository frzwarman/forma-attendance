import { useState, type CSSProperties } from "react";
import { View } from "react-native";
import { FONT_STACK, useTheme } from "../theme";
import { Calendar } from "./icons";
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

export function DateInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const c = useTheme();
  const style = useInputStyle(error);
  const [focused, setFocused] = useState(false);
  // iOS shows an empty date field as a blank box, so a hint and an icon mark it until
  // a date is chosen; while focused the browser's own editor shows through.
  const hint = !value && !focused;
  return (
    <View style={{ gap: 8 }}>
      <T size={14} weight="semibold">
        {label}
      </T>
      <div style={{ position: "relative" }}>
        <input
          type="date"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...style, display: "block", paddingRight: 44, color: hint ? "transparent" : c.text }}
        />
        {hint && (
          <span
            aria-hidden
            style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: c.muted, fontFamily: FONT_STACK, fontSize: 16, pointerEvents: "none" }}
          >
            Pilih tanggal
          </span>
        )}
        <span aria-hidden style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
          <Calendar size={18} color={c.muted} />
        </span>
      </div>
      {!!error && (
        <T size={12} color={c.danger} accessibilityRole="alert">
          {error}
        </T>
      )}
    </View>
  );
}

export function FileInput({
  label,
  accept,
  onChange,
  error,
  hint,
}: {
  label: string;
  accept: string;
  onChange: (file: File | null) => void;
  error?: string;
  hint?: string;
}) {
  const c = useTheme();
  const [name, setName] = useState("");
  return (
    <View style={{ gap: 8 }}>
      <T size={14} weight="semibold">
        {label}
      </T>
      <Row style={{ gap: 12 }}>
        <label
          style={{
            position: "relative",
            display: "inline-block",
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
          Pilih berkas
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
        <T size={13} color={c.muted} style={{ flex: 1 }}>
          {name || "Belum ada berkas"}
        </T>
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
