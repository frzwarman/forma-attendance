import { useState, type CSSProperties } from "react";
import { View } from "react-native";
import { useTheme } from "../theme";
import { Row, T } from "./ui";

// Web-only native inputs (date, file, colour) styled like Field.
export function useInputStyle(error?: string): CSSProperties {
  const c = useTheme();
  return {
    minHeight: 44,
    borderRadius: 6,
    border: `1px solid ${error ? c.danger : c.border}`,
    padding: "10px 14px",
    color: c.text,
    backgroundColor: c.inputSurface,
    fontFamily: "Arial",
    fontSize: 15,
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
  return (
    <View style={{ gap: 8 }}>
      <T size={14} weight="medium">
        {label}
      </T>
      <input type="date" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} style={style} />
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
      <T size={14} weight="medium">
        {label}
      </T>
      <Row style={{ gap: 12 }}>
        <label
          style={{
            position: "relative",
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 100,
            border: `1px solid ${c.border}`,
            cursor: "pointer",
            fontFamily: "Arial",
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
      <T size={14} weight="medium">
        {label}
      </T>
      <Row style={{ gap: 12 }}>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ width: 56, height: 44, padding: 2, border: `1px solid ${c.border}`, borderRadius: 6, background: "transparent" }}
        />
        <T size={13} color={c.muted}>
          {value}
        </T>
      </Row>
    </View>
  );
}
