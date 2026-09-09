import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, authStore } from "./api.js";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import LedgerPage from "./pages/LedgerPage.jsx";
import WorkersPage from "./pages/WorkersPage.jsx";
import WorkerDetailPage from "./pages/WorkerDetailPage.jsx";
import AttendancePage from "./pages/AttendancePage.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(authStore.get()));
  useEffect(() => {
    const unauthorized = () => { setUser(null); setLoading(false); };
    window.addEventListener("ledger:unauthorized", unauthorized);
    if (authStore.get()) api("/auth/me").then((result) => setUser(result.user)).catch(() => authStore.clear()).finally(() => setLoading(false));
    return () => window.removeEventListener("ledger:unauthorized", unauthorized);
  }, []);
  if (loading) return <div className="app-loader"><span></span><p>جارٍ تحميل النظام...</p></div>;
  if (!user) return <LoginPage onLogin={setUser} />;
  const logout = () => { authStore.clear(); setUser(null); };
  return <ToastProvider><Routes><Route element={<Layout user={user} onLogout={logout} />}><Route path="/" element={<LedgerPage />} /><Route path="/workers" element={<WorkersPage />} /><Route path="/workers/:workerId" element={<WorkerDetailPage />} /><Route path="/attendance" element={<AttendancePage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></ToastProvider>;
}
