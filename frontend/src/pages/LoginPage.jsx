import { useState } from "react";
import { Building2, LockKeyhole, Mail } from "lucide-react";
import { api, authStore } from "../api.js";

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await api("/auth/login", { method: "POST", body: form }); authStore.set(result.token); onLogin(result.user); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  return <main className="login-page"><section className="login-panel">
    <div className="login-brand"><span><Building2 size={28} /></span><div><h1>سجل الإنتاج</h1><p>نظام إدارة المشغلين والعمال</p></div></div>
    <div className="login-copy"><span>تسجيل الدخول</span><h2>مرحباً بعودتك</h2><p>أدخل بيانات حساب الشركة للوصول إلى السجلات.</p></div>
    <form onSubmit={submit}>
      <label><span>البريد الإلكتروني</span><div className="input-with-icon"><Mail size={18} /><input type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@company.com" /></div></label>
      <label><span>كلمة المرور</span><div className="input-with-icon"><LockKeyhole size={18} /><input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••••" /></div></label>
      {error && <p className="form-error">{error}</p>}
      <button className="button primary wide" disabled={busy}>{busy ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}</button>
    </form>
  </section><aside><div><span>إدارة دقيقة وواضحة</span><h2>كل سجل، وكل متر، وكل مستحق في مكان واحد.</h2><p>تقارير شهرية موثوقة، صلاحيات آمنة، وسجل تدقيق يحفظ تاريخ كل تعديل.</p></div></aside></main>;
}
