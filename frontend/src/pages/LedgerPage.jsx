import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Edit3, FilePlus2, Pencil, Plus, Printer, Ruler, Trash2, UserRound, Users, WalletCards } from "lucide-react";
import { api } from "../api.js";
import AdditionsCell from "../components/AdditionsCell.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Modal from "../components/Modal.jsx";
import Person from "../components/Person.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { clampDate, currentMonth, dayName, displayDate, initials, money, monthName, number, today } from "../utils.js";

const blankForm = { date: "", worker1Id: "", worker2Id: "", operatorMeters: "", additionCodes: [] };

function AdditionsPicker({ additions, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (event) => !ref.current?.contains(event.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const total = additions.filter((item) => value.includes(item.code)).reduce((sum, item) => sum + Number(item.price), 0);
  const toggle = (code) => onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
  return <div className="multi-picker" ref={ref}>
    <button type="button" className={value.length ? "selected" : ""} onClick={() => setOpen(!open)}><span>{value.length ? `${number(value.length)} إضافات · ${money(total)}` : "بدون إضافات"}</span><ChevronDown size={17} /></button>
    {open && <div className="picker-menu">{additions.map((addition) => <label key={addition.code}><input type="checkbox" checked={value.includes(addition.code)} onChange={() => toggle(addition.code)} /><span>{addition.name}</span><strong>{money(addition.price)}</strong></label>)}<small>تُجمع الإضافات في عمود مستقل ولا تدخل في مستحقات الأمتار.</small></div>}
  </div>;
}

function PrintLedger({ report, month }) {
  if (!report) return null;
  const rows = [...report.records, ...Array.from({ length: Math.max(0, 14 - report.records.length) }, () => null)];
  const operatorDue = report.payouts.find((person) => person.role === "operator")?.amount || 0;
  const workersDue = report.payouts.filter((person) => person.role === "worker").reduce((sum, person) => sum + person.amount, 0);
  return <section className="print-ledger print-only">
    <header><div><strong>سجل الإنتاج</strong><small>كشف أعمال المشغل والعمال</small></div><h1>كشف الأعمال الشهري</h1><span>نسخة المحاسبة</span></header>
    <div className="print-meta"><span>اسم المشغل: <strong>{report.operator.name}</strong></span><span>الشهر: <strong>{monthName(month)} · <bdi dir="ltr">{displayDate(report.period.start)} — {displayDate(report.period.end)}</bdi></strong></span><span>رقم الكشف: <strong>{`WR-${month.replace("-", "")}-${report.operator.id.slice(0, 5)}`}</strong></span></div>
    <table><thead><tr><th>الرقم</th><th>اليوم</th><th>التاريخ</th><th>اسم المشغل</th><th>العامل الأول</th><th>العامل الثاني</th><th>الإضافات</th><th>كمية المشغل<br/><small>متر</small></th><th>كمية كل عامل<br/><small>متر</small></th><th>مستحق أمتار المشغل</th><th>مستحق أمتار العمال</th></tr></thead>
      <tbody>{rows.map((record, index) => record ? <tr key={record.id}><td>{number(index + 1)}</td><td>{dayName(record.date)}</td><td>{displayDate(record.date)}</td><td>{report.operator.name}</td><td>{record.workers[0]?.name || "—"}</td><td>{record.workers[1]?.name || "—"}</td><td><AdditionsCell additions={record.additions} /></td><td>{number(record.operatorMeters)}</td><td>{number(record.workers[0]?.meters || 0)}</td><td>{money(record.operatorMeters * report.settings.operatorRate)}</td><td>{money(record.workers.reduce((sum, worker) => sum + Math.round((worker.meters * report.settings.workerRate + Number.EPSILON) * 100) / 100, 0))}</td></tr> : <tr className="blank" key={`blank-${index}`}><td>{number(index + 1)}</td><td></td><td></td><td>{report.operator.name}</td>{Array.from({length:7},(_,cell)=><td key={cell}></td>)}</tr>)}</tbody>
      <tfoot><tr><td colSpan="6">الإجمالي</td><td>{money(report.totals.additions)}</td><td>{number(report.totals.meters)}</td><td>—</td><td>{money(operatorDue)}</td><td>{money(workersDue)}</td></tr></tfoot>
    </table>
    <p className="print-note">الإضافات مستقلة عن مستحقات الأمتار. تُقسم كمية المشغل بالتساوي عند وجود عاملين في السجل.</p>
    <div className="signatures"><div><b>إعداد الكشف</b><i></i><small>الاسم والتوقيع</small></div><div><b>مراجعة الإدارة</b><i></i><small>الاسم والتوقيع</small></div><div><b>اعتماد الصرف</b><i></i><small>الختم والتوقيع</small></div></div>
  </section>;
}

export default function LedgerPage() {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [operators, setOperators] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [bootstrap, setBootstrap] = useState(null);
  const [operatorId, setOperatorId] = useState(localStorage.getItem("ledger-operator") || "");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [operatorModal, setOperatorModal] = useState(null);
  const [operatorName, setOperatorName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadReferences = async () => {
    const [bootstrapResult, operatorResult, workerResult] = await Promise.all([api("/bootstrap"), api("/operators"), api("/workers")]);
    setBootstrap(bootstrapResult); setOperators(operatorResult.data); setWorkers(workerResult.data);
    const valid = operatorResult.data.some((item) => item.id === operatorId);
    if (!valid) setOperatorId(operatorResult.data[0]?.id || "");
  };
  useEffect(() => { loadReferences().catch((requestError) => setError(requestError.message)); }, []);

  const loadReport = async () => {
    if (!operatorId) { setReport(null); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const result = await api(`/reports/operators/${operatorId}?month=${month}`);
      setReport(result); localStorage.setItem("ledger-operator", operatorId);
      if (!editingId) setForm({ ...blankForm, date: clampDate(today(), result.period.start, result.period.end) });
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadReport(); }, [operatorId, month]);

  const availableWorker2 = useMemo(() => workers.filter((worker) => worker.id !== form.worker1Id), [workers, form.worker1Id]);
  const additionTotal = bootstrap?.additions.filter((item) => form.additionCodes.includes(item.code)).reduce((sum, item) => sum + Number(item.price), 0) || 0;
  const workerCount = Number(Boolean(form.worker1Id)) + Number(Boolean(form.worker2Id));
  const meters = Number(form.operatorMeters || 0);
  const workerMeters = workerCount ? meters / workerCount : 0;

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...blankForm, date: report ? clampDate(today(), report.period.start, report.period.end) : "" });
  };
  const submitRecord = async (event) => {
    event.preventDefault();
    if (!form.worker1Id) return toast("اختر العامل الأول.", "error");
    setSaving(true);
    try {
      const payload = { operatorId, date: form.date, operatorMeters: Number(form.operatorMeters), workerIds: [form.worker1Id, form.worker2Id].filter(Boolean), additionCodes: form.additionCodes };
      const result = await api(editingId ? `/records/${editingId}` : "/records", { method: editingId ? "PUT" : "POST", body: payload });
      toast(result.message); resetForm(); await loadReport();
    } catch (requestError) { toast(requestError.message, "error"); }
    finally { setSaving(false); }
  };
  const editRecord = (record) => {
    setEditingId(record.id);
    setForm({ date: record.date, operatorMeters: String(record.operatorMeters), worker1Id: record.workers[0]?.id || "", worker2Id: record.workers[1]?.id || "", additionCodes: record.additions.map((item) => item.code) });
    document.querySelector(".entry-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const confirmDelete = async () => {
    try {
      if (deleteTarget.type === "record") await api(`/records/${deleteTarget.id}`, { method: "DELETE" });
      else await api(`/operators/${deleteTarget.id}`, { method: "DELETE" });
      toast(deleteTarget.type === "record" ? "تم حذف سجل العمل." : "تمت أرشفة المشغل مع حفظ سجلاته السابقة.");
      setDeleteTarget(null);
      if (deleteTarget.type === "operator") await loadReferences(); else await loadReport();
    } catch (requestError) { toast(requestError.message, "error"); }
  };
  const saveOperator = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const result = await api(operatorModal === "edit" ? `/operators/${operatorId}` : "/operators", { method: operatorModal === "edit" ? "PATCH" : "POST", body: { name: operatorName } });
      toast(result.message); setOperatorModal(null); await loadReferences(); if (operatorModal === "create") setOperatorId(result.data.id);
    } catch (requestError) { toast(requestError.message, "error"); }
    finally { setSaving(false); }
  };

  const openOperator = (mode) => { setOperatorName(mode === "edit" ? report?.operator.name || "" : ""); setOperatorModal(mode); };
  if (!bootstrap && loading) return <div className="page-loading"><span></span><p>جارٍ تجهيز كشف الأعمال...</p></div>;

  return <>
    <div className="screen-only">
      <section className="page-heading"><div><span>الكشف الشهري</span><h1>سجل أعمال المشغل</h1><p>اختر المشغل وأضف أعماله اليومية مع العمال.</p></div><div className="page-actions"><label className="month-control"><CalendarDays size={19}/><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><button className="button secondary" onClick={() => window.print()}><Printer size={18}/>طباعة الكشف</button></div></section>

      <section className="operator-switcher"><div className="operator-select"><span><UserRound size={22}/></span><label><small>المشغل الحالي</small><select value={operatorId} onChange={(event) => { setOperatorId(event.target.value); resetForm(); }}>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}</select></label></div><div><button className="text-button" disabled={!operatorId} onClick={() => openOperator("edit")}><Edit3 size={17}/>تعديل المشغل</button><button className="button primary" onClick={() => openOperator("create")}><Plus size={18}/>مشغل جديد</button></div></section>

      {error && <div className="alert error">{error}<button onClick={loadReport}>إعادة المحاولة</button></div>}
      {!operators.length ? <section className="empty-page"><UserRound size={34}/><h2>ابدأ بإضافة أول مشغل</h2><p>بعد إضافته يمكنك تسجيل العمل واختيار أي عامل من القائمة العامة.</p><button className="button primary" onClick={() => openOperator("create")}><Plus size={18}/>إضافة مشغل</button></section> : report && <>
        <section className="ledger-hero"><div className="profile"><span>{initials(report.operator.name)}</span><div><small>كشف المشغل</small><h2>{report.operator.name}</h2><p><Users size={15}/>{number(workers.length)} عمال متاحين</p></div></div><div className="period"><small>فترة الاستحقاق</small><strong>{monthName(month)}</strong><bdi dir="ltr">{displayDate(report.period.start)} — {displayDate(report.period.end)}</bdi></div></section>
        <section className="stats"><article><span className="green"><Ruler/></span><div><small>إجمالي الإنتاج</small><strong>{number(report.totals.meters)} متر</strong></div></article><article><span className="blue"><CalendarDays/></span><div><small>أيام العمل</small><strong>{number(report.totals.days)} أيام</strong></div></article><article><span className="gold"><WalletCards/></span><div><small>مستحقات الأمتار</small><strong>{money(report.totals.meterEarnings)}</strong></div></article></section>

        <section className="card entry-card"><header className="section-heading"><div><h2>{editingId ? "تعديل سجل العمل" : "إضافة سجل عمل"}</h2><p>سجّل إنتاج يوم واحد؛ الحسابات تظهر قبل الحفظ.</p></div>{editingId && <button className="text-button danger-text" onClick={resetForm}>إلغاء التعديل</button>}</header>
          <form onSubmit={submitRecord}><div className="record-form">
            <label><span>التاريخ <b>*</b></span><input type="date" min={report.period.start} max={report.period.end} required value={form.date} onChange={(event) => setForm({...form,date:event.target.value})}/></label>
            <label><span>العامل الأول <b>*</b></span><select required value={form.worker1Id} onChange={(event) => setForm({...form,worker1Id:event.target.value,worker2Id:event.target.value===form.worker2Id?"":form.worker2Id})}><option value="">اختر العامل الأول</option>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
            <label><span>العامل الثاني <em>اختياري</em></span><select value={form.worker2Id} onChange={(event) => setForm({...form,worker2Id:event.target.value})}><option value="">لا يوجد عامل ثانٍ</option>{availableWorker2.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
            <label><span>عدد الأمتار <b>*</b></span><div className="suffix-input"><input type="number" min="0.01" step="0.01" required value={form.operatorMeters} onChange={(event) => setForm({...form,operatorMeters:event.target.value})} placeholder="0"/><i>متر</i></div></label>
            <label><span>الإضافات <em>اختياري</em></span><AdditionsPicker additions={bootstrap.additions} value={form.additionCodes} onChange={(additionCodes) => setForm({...form,additionCodes})}/></label>
            <button className="button primary submit-button" disabled={saving}><FilePlus2 size={18}/>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة السجل"}</button>
          </div><div className="calculation"><span>حساب اليوم</span><p><b>المشغل: <strong>{money(meters * Number(report.settings.operatorRate))}</strong></b><i></i><b>{workerCount === 2 ? `العاملان (${number(workerMeters)} متر لكل عامل)` : `العامل (${number(workerMeters)} متر)`}: <strong>{money(meters * Number(report.settings.workerRate))}</strong></b><i></i><b>الإضافات: <strong>{money(additionTotal)}</strong></b></p></div></form>
        </section>

        <section className="card"><header className="section-heading"><div><h2>سجلات العمل</h2><p>{number(report.records.length)} سجلات ضمن الفترة المحددة</p></div><span className="rate-badge">المشغل {report.settings.operatorRate} / العامل {report.settings.workerRate} د.أ لكل متر</span></header><div className="table-scroll"><table className="records-table"><thead><tr><th>#</th><th>اليوم</th><th>التاريخ</th><th>العامل الأول</th><th>العامل الثاني</th><th>الإضافات</th><th>أمتار المشغل</th><th>أمتار كل عامل</th><th>الإجراءات</th></tr></thead><tbody>{report.records.map((record,index)=><tr key={record.id}><td>{number(index+1)}</td><td><strong>{dayName(record.date)}</strong></td><td><bdi>{displayDate(record.date)}</bdi></td><td><Person person={record.workers[0]} linked/></td><td><Person person={record.workers[1]} linked/></td><td><AdditionsCell additions={record.additions}/></td><td><strong>{number(record.operatorMeters)}</strong> متر</td><td><strong>{number(record.workers[0]?.meters)}</strong> متر</td><td><div className="row-actions"><button onClick={()=>editRecord(record)} title="تعديل"><Pencil size={17}/></button><button className="delete" onClick={()=>setDeleteTarget({type:"record",id:record.id})} title="حذف"><Trash2 size={17}/></button></div></td></tr>)}</tbody><tfoot><tr><td colSpan="5">إجمالي الفترة</td><td>{money(report.totals.additions)}</td><td>{number(report.totals.meters)} متر</td><td>—</td><td></td></tr></tfoot></table>{!report.records.length&&<div className="empty-table"><FilePlus2 size={30}/><h3>لا توجد سجلات في هذه الفترة</h3><p>استخدم النموذج أعلاه لإضافة أول يوم عمل.</p></div>}</div></section>

        <section className="card payout"><header className="section-heading"><div><h2>مستحقات الأمتار للمشغل وفريقه</h2><p>الإضافات مستقلة ولا تدخل في هذه المبالغ.</p></div><span className="auto-badge">محسوب تلقائياً</span></header><div className="table-scroll"><table><thead><tr><th>الاسم</th><th>الصفة</th><th>أيام العمل</th><th>إجمالي الأمتار</th><th>سعر المتر</th><th>مستحق الأمتار</th></tr></thead><tbody>{report.payouts.map((person)=><tr key={person.id}><td><Person person={person} role={person.role==="operator"?"مشغل":"عامل"}/></td><td><span className={`role ${person.role}`}>{person.role==="operator"?"مشغل":"عامل"}</span></td><td>{number(person.days)} أيام</td><td>{number(person.meters)} متر</td><td>{money(person.rate)}</td><td className="money">{money(person.amount)}</td></tr>)}</tbody><tfoot><tr><td colSpan="5">إجمالي مستحقات الأمتار</td><td>{money(report.totals.meterEarnings)}</td></tr></tfoot></table></div></section>
      </>}
    </div>
    <PrintLedger report={report} month={month}/>

    <Modal open={Boolean(operatorModal)} title={operatorModal === "edit" ? "تعديل المشغل" : "إضافة مشغل جديد"} description="أدخل اسم المشغل فقط؛ جميع العمال متاحون له تلقائياً." onClose={()=>setOperatorModal(null)}><form onSubmit={saveOperator}><label className="modal-field"><span>اسم المشغل</span><input autoFocus required minLength="2" maxLength="120" value={operatorName} onChange={(event)=>setOperatorName(event.target.value)} placeholder="مثال: أحمد محمود"/></label><div className="modal-actions"><button className="button primary" disabled={saving}>حفظ المشغل</button><button type="button" className="button secondary" onClick={()=>setOperatorModal(null)}>إلغاء</button>{operatorModal==="edit"&&<button type="button" className="text-button danger-text push-left" onClick={()=>{setOperatorModal(null);setDeleteTarget({type:"operator",id:operatorId})}}><Trash2 size={17}/>أرشفة المشغل</button>}</div></form></Modal>
    <ConfirmModal open={Boolean(deleteTarget)} title={deleteTarget?.type === "record" ? "حذف سجل العمل؟" : "أرشفة المشغل؟"} message={deleteTarget?.type === "record" ? "سيتم حذف السجل وتحديث كل الإجماليات. يحتفظ سجل التدقيق بنسخة العملية." : "سيختفي المشغل من القوائم، مع بقاء سجلاته السابقة محفوظة."} onClose={()=>setDeleteTarget(null)} onConfirm={confirmDelete}/>
  </>;
}
