import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Practice from "./pages/Practice";
import SessionPage from "./pages/Session";
import Results from "./pages/Results";
import Review from "./pages/Review";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./components/Login";
import { getSettings } from "./lib/store";
import { applyTheme } from "./lib/hooks";
import { useAuth } from "./lib/auth";

export default function App() {
  const { enabled, user } = useAuth();

  useEffect(() => {
    getSettings().then((s) => applyTheme(s.theme));
  }, []);

  // The login screen renders immediately (it shows its own loading state for the
  // Google button) so users never sit on a blank gate while GIS loads.
  if (enabled && !user) {
    return <Login />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="practice" element={<Practice />} />
        <Route path="review" element={<Review />} />
        <Route path="settings" element={<Settings />} />
        <Route path="results/:id" element={<Results />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* Session runs full-screen without the persistent chrome distractions */}
      <Route path="session/:id" element={<SessionPage />} />
    </Routes>
  );
}
