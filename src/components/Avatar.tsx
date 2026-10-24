import { Image } from "expo-image";
import { View } from "react-native";
import { useTheme } from "../theme";
import type { Employee } from "../types";
import { T } from "./ui";
const portraits = [
  require("../../assets/portraits/01.jpg"),
  require("../../assets/portraits/02.jpg"),
  require("../../assets/portraits/03.jpg"),
  require("../../assets/portraits/04.jpg"),
  require("../../assets/portraits/05.jpg"),
  require("../../assets/portraits/06.jpg"),
];
export function Avatar({
  employee,
  size = 36,
  radius = Math.round(size * 0.32),
}: {
  employee: Pick<Employee, "id" | "name">;
  size?: number;
  radius?: number;
}) {
  const c = useTheme();
  const index =
    Math.max(0, Number(employee.id.replace("emp-", "")) - 1) % portraits.length;
  return (
    <View
      style={{
        height: size,
        width: size,
        borderRadius: radius,
        backgroundColor: c.lavender,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <T size={size * 0.3} weight="bold" color={c.primaryText}>
        {employee.name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")}
      </T>
      <Image
        accessibilityLabel={`${employee.name} profile photo`}
        source={portraits[index]}
        style={{ position: "absolute", inset: 0, width: size, height: size }}
        contentFit="cover"
      />
    </View>
  );
}
