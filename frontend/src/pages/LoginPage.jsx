import { useEffect, useState } from "react";
import { Building2, KeyRound, LockKeyhole, Mail, UserRound } from "lucide-react";
import { api, authStore } from "../api.js";

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("checking");
  const [form, setForm] = useState({ name: "", email: "", password: "", setupToken: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/auth/status")
      .then(({ setupRequired }) => setMode(setupRequired ? "setup" : "login"))
      .catch((requestError) => { setError(requestError.message); setMode("login"); });
  }, []);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "setup") {
        const result = await api("/auth/setup", { method: "POST", body: form });
        setNotice(result.message); setForm((current) => ({ ...current, name: "", setupToken: "" })); setMode("login"); return;
      }
      const result = await api("/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
      authStore.set(result.token); onLogin(result.user);
    }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  if (mode === "checking") return <div className="app-loader"><span></span><p>جارٍ تجهيز النظام...</p></div>;
  const isSetup = mode === "setup";
  return <main className="login-page"><section className="login-panel">
    <div className="login-brand"><span><Building2 size={28} /></span><div><h1>سجل الإنتاج</h1><p>نظام إدارة المشغلين والعمال</p></div></div>
    <div className="login-copy"><span>{isSetup ? "الإعداد لأول مرة" : "تسجيل الدخول"}</span><h2>{isSetup ? "أنشئ حساب المدير" : "مرحباً بعودتك"}</h2><p>{isSetup ? "أدخل رمز الإعداد وبيانات مدير الشركة. هذه الخطوة تظهر مرة واحدة فقط." : "أدخل بيانات حساب الشركة للوصول إلى السجلات."}</p></div>
    <form onSubmit={submit}>
      {isSetup && <label><span>اسم المدير</span><div className="input-with-icon"><UserRound size={18} /><input required minLength="2" value={form.name} onChange={update("name")} placeholder="الاسم الكامل" /></div></label>}
      <label><span>البريد الإلكتروني</span><div className="input-with-icon"><Mail size={18} /><input type="email" autoComplete="username" required value={form.email} onChange={update("email")} placeholder="admin@company.com" /></div></label>
      <label><span>كلمة المرور</span><div className="input-with-icon"><LockKeyhole size={18} /><input type="password" autoComplete={isSetup ? "new-password" : "current-password"} required minLength={isSetup ? 10 : 1} value={form.password} onChange={update("password")} placeholder="••••••••••" /></div></label>
      {isSetup && <label><span>رمز إعداد النظام</span><div className="input-with-icon"><KeyRound size={18} /><input type="password" autoComplete="off" required minLength="20" value={form.setupToken} onChange={update("setupToken")} placeholder="الرمز المحفوظ في Cloudflare" /></div></label>}
      {notice && <p className="form-notice">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
      <button className="button primary wide" disabled={busy}>{busy ? "جارٍ الحفظ..." : isSetup ? "إنشاء حساب المدير" : "تسجيل الدخول"}</button>
    </form>
  </section><aside><div><span>إدارة دقيقة وواضحة</span><h2>كل سجل، وكل متر، وكل مستحق في مكان واحد.</h2><p>تقارير شهرية موثوقة، صلاحيات آمنة، وسجل تدقيق يحفظ تاريخ كل تعديل.</p></div></aside></main>;
}
