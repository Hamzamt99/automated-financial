import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import AdditionsCell from "../components/AdditionsCell.jsx";
import Person from "../components/Person.jsx";
import { currentMonth, dayName, displayDate, initials, money, monthName, number } from "../utils.js";

export default function WorkerDetailPage() {
  const { workerId } = useParams();
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setReport(await api(`/reports/workers/${workerId}?month=${month}`)); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [workerId, month]);
  if (loading && !report) return <div className="page-loading"><span></span><p>جارٍ تحميل كشف العامل...</p></div>;
  return <div className="screen-only worker-detail">
    <section className="detail-tools"><Link to="/workers"><ArrowRight size={18}/>العودة إلى العمال</Link><label><span>شهر الاستحقاق</span><div className="month-control"><CalendarDays size={18}/><input type="month" value={month} onChange={(event)=>setMonth(event.target.value)}/></div></label></section>
    {error && <div className="alert error">{error}<button onClick={load}>إعادة المحاولة</button></div>}
    {report && <>
      <section className="ledger-hero"><div className="profile"><span>{initials(report.worker.name)}</span><div><small>كشف العامل الشهري</small><h2>{report.worker.name}</h2><p><Users size={15}/>عمل مع {number(report.totals.operators)} مشغلين في هذه الفترة</p></div></div><div className="period"><small>فترة الاستحقاق</small><strong>{monthName(month)}</strong><bdi dir="ltr">{displayDate(report.period.start)} — {displayDate(report.period.end)}</bdi></div></section>
      <section className="worker-stats"><article><small>أيام العمل</small><strong>{number(report.totals.days)} أيام</strong></article><article><small>عدد المشغلين</small><strong>{number(report.totals.operators)} مشغلين</strong></article><article><small>إجمالي أمتار العامل</small><strong>{number(report.totals.meters)} متر</strong></article><article className="highlight"><small>مستحق الأمتار</small><strong>{money(report.totals.meterEarnings)}</strong></article></section>
      <section className="card"><header className="section-heading"><div><h2>سجل أعمال العامل</h2><p>{number(report.records.length)} سجلات خلال فترة الاستحقاق</p></div><span className="rate-badge">سعر العامل {report.settings.workerRate} د.أ لكل متر</span></header><div className="table-scroll"><table className="worker-record-table"><thead><tr><th>#</th><th>اليوم</th><th>التاريخ</th><th>اسم المشغل</th><th>موقع العامل</th><th>الإضافات</th><th>أمتار المشغل</th><th>أمتار العامل</th><th>مستحق الأمتار</th></tr></thead><tbody>{report.records.map((record,index)=><tr key={record.id}><td>{number(index+1)}</td><td><strong>{dayName(record.date)}</strong></td><td>{displayDate(record.date)}</td><td><Person person={{id:record.operatorId,name:record.operatorName}} role="مشغل" operator/></td><td><span className="position">{record.position===1?"العامل الأول":"العامل الثاني"}</span></td><td><AdditionsCell additions={record.additions}/></td><td>{number(record.operatorMeters)} متر</td><td><strong>{number(record.workerMeters)} متر</strong></td><td className="money">{money(record.meterEarnings)}</td></tr>)}</tbody><tfoot><tr><td colSpan="5">إجمالي الفترة</td><td>{money(report.totals.additions)}</td><td>—</td><td>{number(report.totals.meters)} متر</td><td>{money(report.totals.meterEarnings)}</td></tr></tfoot></table>{!report.records.length&&<div className="empty-table"><CalendarDays size={32}/><h3>لا توجد أعمال في هذه الفترة</h3><p>اختر شهراً آخر أو أضف سجلاً للعامل من كشف المشغل.</p></div>}</div></section>
    </>}
  </div>;
}
