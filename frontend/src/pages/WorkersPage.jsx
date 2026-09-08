import { useEffect, useState } from "react";
import { ChevronLeft, Pencil, Plus, Trash2, UserRoundPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { initials, number } from "../utils.js";

export default function WorkersPage() {
  const toast = useToast();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteWorker, setDeleteWorker] = useState(null);

  const load = async () => {
    setLoading(true); setError("");
    try { const result = await api("/workers"); setWorkers(result.data); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const openModal = (worker = null) => { setModal(worker || "create"); setName(worker?.name || ""); };
  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try { const result = await api(modal === "create" ? "/workers" : `/workers/${modal.id}`, { method: modal === "create" ? "POST" : "PATCH", body: { name } }); toast(result.message); setModal(null); await load(); }
    catch (requestError) { toast(requestError.message, "error"); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    try { await api(`/workers/${deleteWorker.id}`, { method: "DELETE" }); toast("تمت أرشفة العامل مع حفظ سجلاته السابقة."); setDeleteWorker(null); await load(); }
    catch (requestError) { toast(requestError.message, "error"); }
  };

  return <div className="screen-only">
    <section className="page-heading"><div><span>دليل الفريق</span><h1>العمال</h1><p>قائمة موحدة متاحة لجميع المشغلين دون ربط مسبق.</p></div><button className="button primary" onClick={()=>openModal()}><Plus size={18}/>إضافة عامل</button></section>
    <section className="worker-summary"><span><Users size={26}/></span><div><small>إجمالي العمال النشطين</small><strong>{number(workers.length)} عمال</strong></div><p>اضغط على اسم العامل لعرض أعماله مع جميع المشغلين خلال فترة الاستحقاق.</p></section>
    {error && <div className="alert error">{error}<button onClick={load}>إعادة المحاولة</button></div>}
    <section className="card"><header className="section-heading"><div><h2>قائمة العمال</h2><p>إدارة العامل تتم من مكان واحد وتنعكس على جميع الكشوف.</p></div></header><div className="table-scroll"><table className="workers-table"><thead><tr><th>#</th><th>اسم العامل</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{workers.map((worker,index)=><tr key={worker.id}><td>{number(index+1)}</td><td><Link className="worker-link" to={`/workers/${worker.id}`}><span className="avatar">{initials(worker.name)}</span><span><strong>{worker.name}</strong><small>عرض الكشف الشهري</small></span><ChevronLeft size={20}/></Link></td><td><span className="status active">نشط</span></td><td><div className="row-actions"><button title="تعديل" onClick={()=>openModal(worker)}><Pencil size={17}/></button><button className="delete" title="أرشفة" onClick={()=>setDeleteWorker(worker)}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table>{!loading&&!workers.length&&<div className="empty-table"><UserRoundPlus size={34}/><h3>لا يوجد عمال بعد</h3><p>أضف أول عامل ليصبح متاحاً لكل المشغلين.</p></div>}{loading&&<div className="table-loading">جارٍ تحميل العمال...</div>}</div></section>
    <Modal open={Boolean(modal)} title={modal === "create" ? "إضافة عامل" : "تعديل العامل"} description="سيظهر العامل في قوائم جميع المشغلين." onClose={()=>setModal(null)}><form onSubmit={save}><label className="modal-field"><span>اسم العامل</span><input autoFocus required minLength="2" maxLength="120" value={name} onChange={(event)=>setName(event.target.value)} placeholder="مثال: خالد سمير"/></label><div className="modal-actions"><button className="button primary" disabled={saving}>{saving?"جارٍ الحفظ...":"حفظ العامل"}</button><button type="button" className="button secondary" onClick={()=>setModal(null)}>إلغاء</button></div></form></Modal>
    <ConfirmModal open={Boolean(deleteWorker)} title="أرشفة العامل؟" message={`سيختفي ${deleteWorker?.name || "العامل"} من قوائم الاختيار، وتبقى جميع سجلاته السابقة محفوظة.`} onClose={()=>setDeleteWorker(null)} onConfirm={remove}/>
  </div>;
}
