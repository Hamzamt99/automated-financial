import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Pencil, Printer, RotateCcw, Save } from "lucide-react";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import { dayName, displayDate, number, today } from "../utils.js";

const shiftDate = (value, amount) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function AttendanceValue({ value, kind }) {
  if (!value) return <span className="attendance-empty">—</span>;
  const special = value === "سروة" || value === "سهرة";
  return <span className={special ? `attendance-special ${kind}` : "attendance-time"}>{value}</span>;
}

export default function AttendancePage() {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, recorded: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const load = async (selectedDate = date) => {
    setLoading(true); setError("");
    try {
      const result = await api(`/attendance?date=${selectedDate}`);
      const isNewDay = result.summary.recorded === 0;
      setRows(isNewDay ? result.rows.map((row) => ({ ...row, checkIn: "07:00", checkOut: "16:00" })) : result.rows);
      setSummary(result.summary); setEditing(isNewDay); setDirty(false);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(date); }, [date]);

  const selectDate = (nextDate) => {
    if (!nextDate || nextDate === date) return;
    if (dirty && !window.confirm("لديك تعديلات غير محفوظة. هل تريد الانتقال إلى يوم آخر دون حفظها؟")) return;
    setDate(nextDate);
  };
  const changeTime = (employeeCode, field, value) => {
    setRows((current) => current.map((row) => row.employeeCode === employeeCode ? { ...row, [field]: value || null } : row));
    setDirty(true);
  };
  const save = async () => {
    setSaving(true); setError("");
    try {
      const result = await api(`/attendance?date=${date}`, {
        method: "PUT",
        body: { entries: rows.map(({ employeeCode, checkIn, checkOut }) => ({ employeeCode, checkIn, checkOut })) }
      });
      setRows(result.rows); setSummary(result.summary); setEditing(false); setDirty(false); toast(result.message);
    } catch (requestError) { setError(requestError.message); toast(requestError.message, "error"); }
    finally { setSaving(false); }
  };

  return <div className="attendance-page">
    <section className="page-heading no-print"><div><span>سجل مستقل</span><h1>الحضور والانصراف</h1><p>جدول يومي مستقل عن سجلات الإنتاج ومستحقات المشغلين والعمال.</p></div><button className="button secondary" onClick={() => window.print()}><Printer size={18}/>طباعة اليوم</button></section>

    <section className="attendance-toolbar no-print">
      <div className="attendance-date-nav">
        <button className="icon-button" onClick={() => selectDate(shiftDate(date, -1))} title="اليوم السابق"><ChevronRight size={20}/></button>
        <label><CalendarDays size={19}/><span>تاريخ السجل</span><input type="date" value={date} onChange={(event) => selectDate(event.target.value)}/></label>
        <button className="icon-button" onClick={() => selectDate(shiftDate(date, 1))} title="اليوم التالي"><ChevronLeft size={20}/></button>
        {date !== today() && <button className="text-button" onClick={() => selectDate(today())}>اليوم</button>}
      </div>
      <div className="attendance-rules"><Clock3 size={18}/><span>الدوام الرسمي <bdi>07:00 – 17:00</bdi></span><i></i><span>قبل <bdi>06:00</bdi> = <strong>سروة</strong></span><i></i><span>بعد <bdi>18:00</bdi> = <strong>سهرة</strong></span></div>
    </section>

    {error && <div className="alert error no-print">{error}<button onClick={() => load(date)}>إعادة المحاولة</button></div>}

    <section className="card attendance-card">
      <header className="attendance-sheet-header">
        <div><small>كشف الحضور اليومي</small><h2>{dayName(date)}، {displayDate(date)}</h2></div>
        <div className="attendance-progress no-print"><span>{number(summary.recorded)} من {number(summary.total)} مسجل</span><div><i style={{ width: `${summary.total ? summary.recorded / summary.total * 100 : 0}%` }}></i></div></div>
        <div className="attendance-sheet-actions no-print">{editing ? <><button className="button primary" onClick={save} disabled={saving}><Save size={17}/>{saving ? "جارٍ الحفظ..." : "حفظ اليوم"}</button><button className="button secondary" onClick={() => load(date)} disabled={saving}><RotateCcw size={16}/>إلغاء</button></> : <button className="button secondary" onClick={() => setEditing(true)}><Pencil size={17}/>تعديل الأوقات</button>}</div>
      </header>
      <div className="print-only attendance-print-meta"><strong>كادر المضخات</strong><span>يوم الأسبوع: {dayName(date)}</span><span>التاريخ: {displayDate(date)}</span></div>
      <div className="table-scroll"><table className="attendance-table"><thead><tr><th>رمز</th><th>اسم الموظف</th><th>يوم الأسبوع</th><th>التاريخ</th><th>وقت الدخول</th><th>وقت الخروج</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.employeeCode} className={row.checkIn || row.checkOut ? "recorded" : ""}>
          <td><bdi className="employee-code">{row.employeeCode}</bdi></td>
          <td><strong>{row.name}</strong></td>
          <td>{dayName(date)}</td>
          <td><bdi className="attendance-row-date">{displayDate(date)}</bdi></td>
          <td>{editing ? <input className="attendance-time-input" type="time" step="60" value={row.checkIn || ""} onChange={(event) => changeTime(row.employeeCode, "checkIn", event.target.value)} aria-label={`وقت دخول ${row.name}`}/> : <AttendanceValue value={row.checkInDisplay} kind="early"/>}</td>
          <td>{editing ? <input className="attendance-time-input" type="time" step="60" value={row.checkOut || ""} onChange={(event) => changeTime(row.employeeCode, "checkOut", event.target.value)} aria-label={`وقت خروج ${row.name}`}/> : <AttendanceValue value={row.checkOutDisplay} kind="late"/>}</td>
        </tr>)}
      </tbody></table>{loading && <div className="table-loading">جارٍ تحميل سجل اليوم...</div>}</div>
      <footer className="attendance-footer"><span>عدد الموظفين: <strong>{number(summary.total)}</strong></span><span>المسجلون: <strong>{number(summary.recorded)}</strong></span><span>غير المسجلين: <strong>{number(summary.total - summary.recorded)}</strong></span></footer>
    </section>
  </div>;
}
