import { Link } from "react-router-dom";
import { Empty } from "../components/ui";

export default function NotFound() {
  return (
    <Empty icon="🧭" title="Page not found">
      <Link to="/">Return to the dashboard</Link>
    </Empty>
  );
}
