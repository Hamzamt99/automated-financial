import { NavLink, Outlet } from "react-router-dom";
import { ClipboardCheck, FileSpreadsheet, LogOut, Users } from "lucide-react";

export default function Layout({ user, onLogout }) {
  return <>
    <header className="topbar no-print"><div className="container topbar-inner">
      <div className="brand"><span>ن</span><div><strong>سجل الإنتاج</strong><small>إدارة أعمال المشغلين</small></div></div>
      <nav><NavLink to="/" end><FileSpreadsheet size={18} />سجل الأعمال</NavLink><NavLink to="/workers"><Users size={18} />العمال</NavLink><NavLink to="/attendance"><ClipboardCheck size={18} />الحضور</NavLink></nav>
      <div className="account"><div><strong>{user.name}</strong><small>{user.role === "admin" ? "مدير النظام" : "المحاسبة"}</small></div><button onClick={onLogout} title="تسجيل الخروج"><LogOut size={18} /></button></div>
    </div></header>
    <main className="container app-shell"><Outlet /></main>
  </>;
}
