import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Pencil, Plus, RotateCcw, Trash2, UserRoundPlus, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { number } from "../utils.js";

const emptyForm = { employeeCode: "", name: "" };

export default function AttendanceEmployeesPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError("");
    try { const result = await api("/attendance/employees?includeInactive=true"); setEmployees(result.data); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const activeCount = employees.filter((employee) => employee.isActive).length;
  const visibleEmployees = useMemo(() => showArchived ? employees : employees.filter((employee) => employee.isActive), [employees, showArchived]);

  const openCreate = () => { setForm(emptyForm); setModal({ mode: "create" }); };
  const openEdit = (employee) => { setForm({ employeeCode: employee.employeeCode, name: employee.name }); setModal({ mode: "edit", employee }); };
  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const creating = modal.mode === "create";
      const result = await api(creating ? "/attendance/employees" : `/attendance/employees/${modal.employee.employeeCode}`, {
        method: creating ? "POST" : "PATCH",
        body: creating ? form : { name: form.name }
      });
      toast(result.message); setModal(null); await load();
    } catch (requestError) { toast(requestError.message, "error"); }
    finally { setSaving(false); }
  };
  const archive = async () => {
    setSaving(true);
    try { await api(`/attendance/employees/${archiveTarget.employeeCode}`, { method: "DELETE" }); toast("تمت أرشفة الموظف مع حفظ حضوره السابق."); setArchiveTarget(null); await load(); }
    catch (requestError) { toast(requestError.message, "error"); }
    finally { setSaving(false); }
  };
  const restore = async (employee) => {
    try { const result = await api(`/attendance/employees/${employee.employeeCode}/restore`, { method: "PATCH" }); toast(result.message); await load(); }
    catch (requestError) { toast(requestError.message, "error"); }
  };

  return <div className="screen-only attendance-employees-page">
    <div className="detail-tools"><Link to="/attendance"><ArrowRight size={18}/>العودة إلى كشف الحضور</Link></div>
    <section className="page-heading"><div><span>إعدادات الحضور</span><h1>موظفو الحضور</h1><p>أضف الموظفين وعدّل أسماءهم دون التأثير على سجلات الإنتاج.</p></div><button className="button primary" onClick={openCreate}><Plus size={18}/>إضافة موظف</button></section>

    <section className="worker-summary attendance-employee-summary"><span><UsersRound size={26}/></span><div><small>الموظفون النشطون</small><strong>{number(activeCount)} موظف</strong></div><p>أرشفة الموظف تخفيه من الأيام الجديدة وتحافظ على حضوره السابق.</p><label className="archived-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)}/><span>عرض المؤرشفين</span></label></section>
    {error && <div className="alert error">{error}<button onClick={load}>إعادة المحاولة</button></div>}

    <section className="card"><header className="section-heading"><div><h2>قائمة موظفي الحضور</h2><p>رمز الموظف ثابت لحماية ارتباط السجلات السابقة.</p></div></header><div className="table-scroll"><table className="attendance-employees-table"><thead><tr><th>#</th><th>رمز الموظف</th><th>اسم الموظف</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>
      {visibleEmployees.map((employee, index) => <tr key={employee.employeeCode}><td>{number(index + 1)}</td><td><bdi className="employee-code">{employee.employeeCode}</bdi></td><td><strong>{employee.name}</strong></td><td><span className={`status ${employee.isActive ? "active" : "archived"}`}>{employee.isActive ? "نشط" : "مؤرشف"}</span></td><td><div className="row-actions">{employee.isActive ? <><button title="تعديل الاسم" onClick={() => openEdit(employee)}><Pencil size={17}/></button><button className="delete" title="أرشفة" onClick={() => setArchiveTarget(employee)}><Trash2 size={17}/></button></> : <button className="restore-button" title="استعادة" onClick={() => restore(employee)}><RotateCcw size={17}/></button>}</div></td></tr>)}
    </tbody></table>{loading && <div className="table-loading">جارٍ تحميل الموظفين...</div>}{!loading && !visibleEmployees.length && <div className="empty-table"><UserRoundPlus size={34}/><h3>لا يوجد موظفون</h3><p>أضف أول موظف إلى كشف الحضور.</p></div>}</div></section>

    <Modal open={Boolean(modal)} title={modal?.mode === "create" ? "إضافة موظف حضور" : "تعديل اسم الموظف"} description={modal?.mode === "create" ? "سيظهر الموظف في جميع كشوف الحضور الجديدة." : "سيظهر الاسم الجديد في السجلات السابقة والقادمة."} onClose={() => setModal(null)}><form onSubmit={save}>
      <label className="modal-field"><span>رمز الموظف</span><input dir="ltr" inputMode="numeric" pattern="[0-9]+" required maxLength="12" disabled={modal?.mode === "edit"} value={form.employeeCode} onChange={(event) => setForm({ ...form, employeeCode: event.target.value.replace(/\D/g, "") })} placeholder="مثال: 7201"/></label>
      <label className="modal-field attendance-name-field"><span>اسم الموظف</span><input autoFocus required minLength="2" maxLength="160" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="الاسم الكامل"/></label>
      <div className="modal-actions"><button className="button primary" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ الموظف"}</button><button type="button" className="button secondary" onClick={() => setModal(null)}>إلغاء</button></div>
    </form></Modal>
    <ConfirmModal open={Boolean(archiveTarget)} busy={saving} title="أرشفة موظف الحضور؟" message={`سيختفي ${archiveTarget?.name || "الموظف"} من الأيام الجديدة، وستبقى جميع سجلات حضوره السابقة محفوظة.`} onClose={() => setArchiveTarget(null)} onConfirm={archive}/>
  </div>;
}
