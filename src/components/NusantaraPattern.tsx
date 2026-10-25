import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../theme";

// Interwoven gold ribbons echo the supplied Nusantara landscape motif.
// Vector paths stay crisp on web and native, with no image downloads or touches.
const ribbons = [
  "M20 210H155C205 210 205 142 258 142H342C390 142 391 74 444 74H520C563 74 564 22 615 22H700",
  "M62 180H151C202 180 202 240 255 240H350C402 240 402 142 455 142H526C578 142 578 52 631 52H700",
  "M110 150H179C231 150 231 180 284 180H369C420 180 420 106 473 106H549C599 106 599 174 650 174H700",
  "M350 210H393C446 210 446 180 499 180H553C606 180 606 112 659 112H700",
];

export function NusantaraPattern({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          position: "absolute",
          right: -145,
          top: -10,
          width: 390,
          height: 234,
          opacity: 0.16,
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 700 420">
        <G fill="none" stroke={c.primary} strokeWidth={1.8} strokeLinecap="round">
          {ribbons.map((d, i) => (
            <Path key={`top-${i}`} d={d} />
          ))}
          <G transform="translate(0 420) scale(1 -1)">
            {ribbons.map((d, i) => (
              <Path key={`bottom-${i}`} d={d} />
            ))}
          </G>
          <Circle cx={333} cy={210} r={17} />
        </G>
      </Svg>
    </View>
  );
}
