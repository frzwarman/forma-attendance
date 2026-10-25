import { Image } from "expo-image";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export const nusantaraAssets = {
  logo: require("../../assets/brand/nusantara-logo.png"),
  background: require("../../assets/brand/nusantara-background.jpg"),
};

export function NusantaraLogo({ width = 120 }: { width?: number }) {
  return (
    <Image
      accessibilityLabel="Nusantara"
      source={nusantaraAssets.logo}
      contentFit="contain"
      style={{ width, height: (width * 1035) / 1694 }}
    />
  );
}

export function NusantaraBackdrop({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flex: 1, backgroundColor: "#DBAF6D" }, style]}>
      <Image
        pointerEvents="none"
        source={nusantaraAssets.background}
        contentFit="cover"
        contentPosition="top center"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
      {children}
    </View>
  );
}
