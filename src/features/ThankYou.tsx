import { View } from "react-native";
import { CircleCheck } from "../components/icons";
import { Modal } from "../components/Modal";
import { Button, Row, T } from "../components/ui";
import type { CheckInInput } from "../domain/checkin";
import { formatWib } from "../domain/time";
import { useTheme } from "../theme";

export type CheckInDetails = CheckInInput & { at: string; token?: string };

// Popup right after a successful check-in; closing it reveals the event information page.
export function ThankYou({ details, onClose }: { details: CheckInDetails; onClose: () => void }) {
  const c = useTheme();
  const rows: [string, string][] = [
    ["Nama", details.name],
    ["Nomor Telepon", details.phone],
    ["E-mail", details.email],
    ["Divisi", details.divisi],
    ...(details.room_number ? [["Kamar hotel", details.room_number] as [string, string]] : []),
    ["Waktu check-in", formatWib(details.at)],
  ];
  return (
    <Modal label="Check-in berhasil" maxWidth={440} onClose={onClose}>
      <View style={{ padding: 24, paddingTop: 28, gap: 18 }}>
        <CircleCheck size={48} color={c.success} strokeWidth={2} />
        <View style={{ gap: 6 }}>
          <T size={26} weight="extra" accessibilityRole="header">
            Terima kasih, {details.name}!
          </T>
          <T color={c.muted}>Check-in Anda sudah tercatat. Sampai jumpa di lokasi acara.</T>
        </View>
        <View style={{ backgroundColor: c.ground, borderRadius: 12, padding: 16, gap: 10 }}>
          {rows.map(([label, value]) => (
            <Row key={label} style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <T size={13} color={c.muted} style={{ width: 110 }}>
                {label}
              </T>
              <T size={14} weight="semibold" style={{ flex: 1, textAlign: "right" }}>
                {value}
              </T>
            </Row>
          ))}
        </View>
        {!!details.token && (
          <T size={14} color={c.muted}>
            Saat pulang, buka tautan ini lagi di HP ini lalu tekan Check out sekarang.
          </T>
        )}
        <Button large label="Lihat informasi acara" onPress={onClose} />
      </View>
    </Modal>
  );
}
