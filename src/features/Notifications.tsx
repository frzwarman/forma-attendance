import { CheckCheck,Clock3,PartyPopper } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Badge,Button,Card,Empty,IconBox,Row,T } from "../components/ui";
import { useData } from "../services/data";
import { repository } from "../services/repository";
import { useTheme } from "../theme";
import { PageHeading } from "./Home";
export default function Notifications() {
  const c = useTheme();
  const { db, employee, refresh } = useData();
  const [filter, setFilter] = useState("All");
  const notes = db.notifications.filter(
    (n) =>
      n.employeeId === employee.id &&
      (filter === "All" ||
        (filter === "Unread" && !n.read) ||
        filter.toLowerCase() === n.category),
  );
  return (
    <View style={{ gap: 22 }}>
      <View style={{ marginBottom: -22 }}>
        <PageHeading
          title="You’re in the loop"
          subtitle="The moments and updates that matter to your workday."
          right={
            <Button
              small
              label="Mark all as read"
              icon={CheckCheck}
              variant="secondary"
              onPress={async () => {
                await repository.markNotifications(employee.id);
                await refresh();
              }}
            />
          }
        />
      </View>
      <Row style={{ flexWrap: "wrap" }}>
        {["All", "Unread", "Attendance", "Request", "Company"].map((item) => (
          <Button
            small
            key={item}
            label={item}
            onPress={() => setFilter(item)}
            variant={filter === item ? "primary" : "secondary"}
          />
        ))}
      </Row>
      <Card>
        {notes.length ? (
          notes.map((n, i) => (
            <View
              key={n.id}
              style={{
                paddingVertical: 20,
                borderTopWidth: i ? 1 : 0,
                borderColor: c.border,
              }}
            >
              <Row style={{ alignItems: "flex-start", gap: 14 }}>
                <IconBox
                  icon={
                    n.category === "attendance"
                      ? Clock3
                      : n.category === "request"
                        ? CheckCheck
                        : PartyPopper
                  }
                  bg={n.read ? c.subtle : c.lavender}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <Row
                    style={{
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                    }}
                  >
                    <T size={13} weight={n.read ? "medium" : "bold"}>
                      {n.title}
                    </T>
                    {!n.read && <Badge label="New" />}
                  </Row>
                  <T color={c.muted} size={12}>
                    {n.message}
                  </T>
                  <T color={c.muted} size={9}>
                    {new Date(n.timestamp).toLocaleString("en-GB", {
                      timeZone: "Asia/Jakarta",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    WIB
                  </T>
                </View>
              </Row>
            </View>
          ))
        ) : (
          <Empty
            title="All caught up"
            message="Your next update will appear here."
          />
        )}
      </Card>
    </View>
  );
}
