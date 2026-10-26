import { Card, T } from "../../components/ui";

export default function AdminIndex() {
  return (
    <Card style={{ gap: 16 }}>
      <T size={22} weight="bold" accessibilityRole="header">
        Daftar Check-in
      </T>
    </Card>
  );
}
