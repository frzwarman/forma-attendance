import React from "react";
import type { IconComponent } from "./icons";
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
  size = 15,
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
          lineHeight: Math.round(size * (size >= 28 ? 1.15 : 1.5)),
          letterSpacing: size >= 28 ? -0.6 : 0,
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

// One radius scale: inputs 10, cards 16, pills 999.
export function Card({
  children,
  style,
  elevated = false,
  ...props
}: React.ComponentProps<typeof View> & { elevated?: boolean }) {
  const c = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: c.border,
          boxShadow: elevated ? c.shadow : undefined,
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
  large = false,
  accessibilityLabel,
}: {
  label: string;
  // When several buttons share a visible label, e.g. "Hapus" on every row.
  accessibilityLabel?: string;
  onPress: () => void;
  icon?: IconComponent;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "inverse";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  large?: boolean;
}) {
  const c = useTheme();
  const palette = {
    primary: { background: c.accent, color: c.onAccent, border: c.accent, hover: c.accent },
    secondary: { background: c.surface, color: c.text, border: c.border, hover: c.inputSurface },
    ghost: { background: "transparent", color: c.text, border: "transparent", hover: c.inputSurface },
    danger: { background: "transparent", color: c.danger, border: c.border, hover: c.inputSurface },
    inverse: { background: "rgba(255, 255, 255, 0.12)", color: "#ffffff", border: "transparent", hover: "rgba(255, 255, 255, 0.2)" },
  }[variant];
  const color = palette.color;
  const height = small ? 38 : large ? 54 : 46;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      aria-busy={loading}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          minHeight: height,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: palette.border,
          paddingHorizontal: small ? 14 : large ? 26 : 20,
          backgroundColor: hovered && !pressed ? palette.hover : palette.background,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 9,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          transitionProperty: "background-color, transform, opacity",
          transitionDuration: "150ms",
          boxShadow: variant === "primary" && !disabled ? `0 8px 18px ${c.accentSoft}` : undefined,
        } as ViewStyle,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : Icon ? <Icon size={18} color={color} strokeWidth={2.2} /> : null}
      <T weight="semibold" color={color} size={small ? 13 : large ? 16 : 15}>
        {loading ? loadingLabel : label}
      </T>
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
  const colors = {
    neutral: { text: c.muted, background: c.inputSurface },
    success: { text: c.success, background: "rgba(46, 125, 50, 0.12)" },
    danger: { text: c.danger, background: "rgba(198, 40, 40, 0.1)" },
    gold: { text: "#7a5a1f", background: c.goldSoft },
  }[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        backgroundColor: colors.background,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <T size={12} weight="semibold" color={colors.text}>
        {label}
      </T>
    </View>
  );
}

export function SectionTitle({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  const c = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={17} weight="bold" accessibilityRole="header">
          {title}
        </T>
        {!!description && (
          <T size={13} color={c.muted}>
            {description}
          </T>
        )}
      </View>
      {right}
    </Row>
  );
}

// A thin rule that separates groups of fields; it encodes structure, not decoration.
export function Divider() {
  const c = useTheme();
  return <View style={{ height: 1, backgroundColor: c.border }} />;
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: IconComponent;
  tone?: "neutral" | "gold";
}) {
  const c = useTheme();
  const iconColor = tone === "gold" ? "#7a5a1f" : c.background;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 150,
        backgroundColor: c.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        padding: 18,
        gap: 12,
      }}
    >
      <Row style={{ justifyContent: "space-between" }}>
        <T size={13} weight="medium" color={c.muted}>
          {label}
        </T>
        {Icon && (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tone === "gold" ? c.goldSoft : c.inputSurface,
            }}
          >
            <Icon size={18} color={iconColor} strokeWidth={2} />
          </View>
        )}
      </Row>
      <T size={30} weight="extra" style={{ letterSpacing: -0.8, lineHeight: 34 }}>
        {value}
      </T>
      {!!hint && (
        <T size={12} color={c.muted}>
          {hint}
        </T>
      )}
    </View>
  );
}

export function Field({
  label,
  error,
  hint,
  labelHidden = false,
  leading,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string; labelHidden?: boolean; leading?: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: 7 }}>
      {!labelHidden && (
        <T size={14} weight="semibold">
          {label}
        </T>
      )}
      <View style={{ justifyContent: "center" }}>
        {leading && <View style={{ position: "absolute", left: 14, zIndex: 1 }}>{leading}</View>}
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          style={[
            {
              minHeight: 46,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: error ? c.danger : c.border,
              paddingHorizontal: leading ? 42 : 14,
              paddingVertical: 11,
              color: c.text,
              backgroundColor: c.inputSurface,
              fontFamily: fonts.regular,
              fontSize: 16,
            },
            props.style,
          ]}
        />
      </View>
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

export function Empty({ title, message }: { title: string; message: string }) {
  const c = useTheme();
  return (
    <View style={{ paddingVertical: 36, paddingHorizontal: 16, gap: 6, alignItems: "center" }}>
      <T weight="bold">{title}</T>
      <T color={c.muted} size={14} style={{ textAlign: "center", maxWidth: 360 }}>
        {message}
      </T>
    </View>
  );
}
