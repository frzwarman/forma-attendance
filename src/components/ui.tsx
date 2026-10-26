import { ChevronRight, type LucideIcon } from "lucide-react-native";
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
export function Row({
  children,
  style,
  ...props
}: React.ComponentProps<typeof View>) {
  return (
    <View
      {...props}
      style={[{ flexDirection: "row", alignItems: "center", gap: 10 }, style]}
    >
      {children}
    </View>
  );
}
export function Card({
  children,
  style,
  ...props
}: React.ComponentProps<typeof View>) {
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
  loadingLabel = "Please wait…",
  style,
  small = false,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "white";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const c = useTheme();
  const background =
    variant === "primary"
      ? c.buttonSurface
      : variant === "secondary"
        ? c.lavender
        : variant === "white"
          ? c.primary
          : variant === "danger"
            ? c.redBg
            : "transparent";
  const color =
    variant === "primary"
      ? c.primaryText
      : variant === "white"
        ? c.onPrimary
        : variant === "danger"
          ? c.red
          : c.primaryText;
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
            variant === "danger"
              ? c.red
              : variant === "primary" || variant === "white"
                ? c.primary
                : c.border,
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
      {loading ? (
        <ActivityIndicator color={color} />
      ) : Icon ? (
        <Icon size={18} color={color} />
      ) : null}
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
  badge,
  disabled = false,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  badge?: boolean;
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
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? c.subtle : "transparent",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Icon size={21} color={c.muted} strokeWidth={1.8} />
      {badge && (
        <View
          style={{
            position: "absolute",
            right: 10,
            top: 9,
            width: 6,
            height: 6,
            backgroundColor: c.primary,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: c.surface,
          }}
        />
      )}
    </Pressable>
  );
}
export function Badge({
  label,
  tone = "primary",
  dot = false,
}: {
  label: string;
  tone?: "primary" | "green" | "amber" | "red" | "blue" | "neutral";
  dot?: boolean;
}) {
  const c = useTheme();
  const color =
    tone === "primary" ? c.primaryText : tone === "neutral" ? c.muted : c[tone];
  const bg =
    tone === "primary"
      ? c.lavender
      : tone === "neutral"
        ? c.subtle
        : c[`${tone}Bg`];
  return (
    <Row
      style={{
        alignSelf: "flex-start",
        gap: 5,
        backgroundColor: bg,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      {dot && (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      )}
      <T size={10} weight="semibold" color={color}>
        {label}
      </T>
    </Row>
  );
}
export function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const c = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", marginBottom: 19 }}>
      <T size={16} weight="bold" style={{ flexShrink: 1 }}>
        {title}
      </T>
      {!!action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: 36, justifyContent: "center" }}
        >
          <Row style={{ gap: 4 }}>
            <T color={c.primaryText} size={12} weight="semibold">
              {action}
            </T>
            <ChevronRight size={14} color={c.primaryText} />
          </Row>
        </Pressable>
      )}
    </Row>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <T size={15} weight="regular">
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
            borderColor: error ? c.red : c.primary,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: c.white,
            backgroundColor: c.inputSurface,
            fontFamily: fonts.regular,
            fontSize: 15,
          },
          props.style,
        ]}
      />
      {!!error && (
        <T size={11} color={c.red}>
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
