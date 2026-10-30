import { Card, Row, T } from "../components/ui";
import { formatWib } from "../domain/time";
import type { StoredCheckIn } from "../services/checkout";
import { useTheme } from "../theme";

// Shown instead of the form on a phone that already checked someone in, so they know it went
// through. Nobody checks out any more.
export function CheckedIn({ entries }: { entries: StoredCheckIn[] }) {
  const c = useTheme();
  return (
    <Card elevated style={{ gap: 14 }}>
      <T size={22} weight="extra" accessibilityRole="header">
        Anda sudah check-in
      </T>
      {entries.map((entry) => (
        <Row key={entry.token} style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6, padding: 14, borderRadius: 12, backgroundColor: c.ground }}>
          <T weight="bold">{entry.name}</T>
          <T size={13} color={c.muted}>
            Check-in {formatWib(entry.at)}
          </T>
        </Row>
      ))}
    </Card>
  );
}
