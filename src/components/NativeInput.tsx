import type { CSSProperties } from "react";
import { View } from "react-native";
import { useTheme } from "../theme";
import { T } from "./ui";

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
