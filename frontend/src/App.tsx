import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import DashboardPage from "./pages/DashboardPage";
import OpenCodePage from "./pages/OpenCodePage";
import DeepSeekPage from "./pages/DeepSeekPage";
import ServerPage from "./pages/ServerPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/opencode" element={<OpenCodePage />} />
          <Route path="/deepseek" element={<DeepSeekPage />} />
          <Route path="/server" element={<ServerPage />} />
          <Route path="/server/:id" element={<ServerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
