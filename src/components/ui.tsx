import { type LucideIcon } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { fonts, fontWeights, useTheme } from "../theme";

export function T({
  children,
  size = 14,
  color,
  weight = "regular",
  style,
  ...props
}: React.ComponentProps<typeof Text> & {
  size?: number;
  color?: string;
  weight?: keyof typeof fonts;
}) {
  const c = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: fonts[weight],
          fontWeight: fontWeights[weight],
          fontSize: size,
          lineHeight: size * 1.5,
          color: color || c.text,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Row({ children, style, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View {...props} style={[{ flexDirection: "row", alignItems: "center", gap: 10 }, style]}>
      {children}
    </View>
  );
}

export function Card({ children, style, ...props }: React.ComponentProps<typeof View>) {
  const c = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: 6,
          padding: 24,
          borderWidth: 1,
          borderColor: c.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon: Icon,
  variant = "primary",
  disabled = false,
  loading = false,
  loadingLabel = "Mohon tunggu…",
  style,
  small = false,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const c = useTheme();
  const background =
    variant === "primary" ? c.accent : variant === "danger" ? c.danger : "transparent";
  const color = variant === "primary" ? c.onAccent : variant === "danger" ? "#ffffff" : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      aria-busy={loading}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 40 : 49,
          borderRadius: 100,
          borderWidth: variant === "ghost" ? 0 : 1,
          borderColor:
            variant === "primary" ? c.accent : variant === "danger" ? c.danger : c.border,
          paddingHorizontal: small ? 14 : 20,
          backgroundColor: background,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 9,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : Icon ? <Icon size={18} color={color} /> : null}
      <T weight="semibold" color={color} size={small ? 12 : 14}>
        {loading ? loadingLabel : label}
      </T>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  label,
  disabled = false,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 44,
        width: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? c.inputSurface : "transparent",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Icon size={21} color={c.muted} strokeWidth={1.8} />
    </Pressable>
  );
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "danger" | "gold";
}) {
  const c = useTheme();
  const color =
    tone === "success" ? c.success : tone === "danger" ? c.danger : tone === "gold" ? c.gold : c.muted;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 100,
        borderWidth: 1,
        borderColor: color,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <T size={11} weight="semibold" color={color}>
        {label}
      </T>
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: "space-between", marginBottom: 14 }}>
      <T size={16} weight="bold" accessibilityRole="header">
        {title}
      </T>
      {right}
    </Row>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T size={14} weight="medium">
        {label}
      </T>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        style={[
          {
            minHeight: 44,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: error ? c.danger : c.border,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: c.text,
            backgroundColor: c.inputSurface,
            fontFamily: fonts.regular,
            fontSize: 15,
          },
          props.style,
        ]}
      />
      {!!error && (
        <T size={12} color={c.danger} accessibilityRole="alert">
          {error}
        </T>
      )}
    </View>
  );
}

export function Empty({ title, message }: { title: string; message: string }) {
  const c = useTheme();
  return (
    <View style={{ padding: 36, gap: 8, alignItems: "center" }}>
      <T weight="bold">{title}</T>
      <T color={c.muted} style={{ textAlign: "center" }}>
        {message}
      </T>
    </View>
  );
}
