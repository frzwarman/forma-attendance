import Home from "../features/Home";
import { useSectionReady } from "../components/Loading";

export default function Index() {
  useSectionReady("/");
  return <Home />;
}
