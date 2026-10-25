import { useLocalSearchParams } from "expo-router";
import { Empty } from "../components/ui";
import Admin from "../features/Admin";
import History from "../features/History";
import Login from "../features/Login";
import Notifications from "../features/Notifications";
import Profile from "../features/Profile";
import Requests from "../features/Requests";
import Schedule from "../features/Schedule";
import { usePreferences } from "../stores/preferences";
import { useSectionReady } from "../components/Loading";
export default function Page() {
  const { page } = useLocalSearchParams<{ page: string }>();
  useSectionReady(`/${page}`);
  const role = usePreferences((s) => s.role);
  if (
    ["admin", "employees", "monitoring", "approvals", "locations"].includes(
      page,
    )
  )
    return role === "admin" ? (
      <Admin page={page} />
    ) : (
      <Empty
        title="HR workspace"
        message="Use the demo role switcher to explore the administrator experience."
      />
    );
  switch (page) {
    case "history":
      return <History />;
    case "schedule":
      return <Schedule />;
    case "requests":
      return <Requests />;
    case "profile":
      return <Profile />;
    case "notifications":
      return <Notifications />;
    case "login":
      return <Login />;
    default:
      return (
        <Empty
          title="Page not found"
          message="Use the navigation to return to your workspace."
        />
      );
  }
}
