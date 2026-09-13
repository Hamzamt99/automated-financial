import { Router } from "express";
import { z } from "zod";
import { all, batch, database } from "../db.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { auditStatement } from "../lib/audit.js";
import { requireWriteAccess, validate } from "../middleware/validate.js";

export const attendanceRouter = Router();
const dateSchema = z.object({ date: z.iso.date() });
const timeValue = z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.null()]).optional().transform((value) => value || null);
const attendanceEntry = z.object({
  employeeCode: z.string().regex(/^\d{1,12}$/),
  checkIn: timeValue,
  checkOut: timeValue
}).superRefine((entry, context) => {
  if (entry.checkIn && entry.checkOut && entry.checkOut <= entry.checkIn) {
    context.addIssue({ code: "custom", path: ["checkOut"], message: "وقت الخروج يجب أن يكون بعد وقت الدخول." });
  }
});
const saveSchema = z.object({
  entries: z.array(attendanceEntry).max(200).refine((entries) => new Set(entries.map((entry) => entry.employeeCode)).size === entries.length, "لا يمكن تكرار الموظف.")
});

const displayCheckIn = (value) => value && value < "06:00" ? "سروة" : value;
const displayCheckOut = (value) => value && value > "21:00" ? "سهرة" : value;

async function loadDay(date) {
  const rows = await all(`
    SELECT ae.employee_code AS employeeCode, ae.name,
      ar.check_in AS checkIn, ar.check_out AS checkOut, ar.updated_at AS updatedAt
    FROM attendance_employees ae
    LEFT JOIN attendance_records ar
      ON ar.employee_code = ae.employee_code AND ar.attendance_date = ?
    WHERE ae.is_active = 1
    ORDER BY ae.sort_order, CAST(ae.employee_code AS INTEGER)
  `, date);
  return rows.map((row) => ({
    ...row,
    checkInDisplay: displayCheckIn(row.checkIn),
    checkOutDisplay: displayCheckOut(row.checkOut),
    hasRecord: Boolean(row.checkIn || row.checkOut)
  }));
}

attendanceRouter.get("/", validate(dateSchema, "query"), asyncHandler(async (request, response) => {
  const rows = await loadDay(request.query.date);
  response.json({
    date: request.query.date,
    officialHours: { start: "07:00", end: "17:00", earlyBefore: "06:00", lateAfter: "21:00" },
    rows,
    summary: { total: rows.length, recorded: rows.filter((row) => row.hasRecord).length }
  });
}));

attendanceRouter.put("/", requireWriteAccess, validate(dateSchema, "query"), validate(saveSchema), asyncHandler(async (request, response) => {
  const codes = request.body.entries.map((entry) => entry.employeeCode);
  if (codes.length) {
    const placeholders = codes.map(() => "?").join(", ");
    const employees = await all(`SELECT employee_code FROM attendance_employees WHERE is_active = 1 AND employee_code IN (${placeholders})`, ...codes);
    if (employees.length !== codes.length) throw new AppError(400, "تتضمن القائمة موظفاً غير متاح.", "INVALID_ATTENDANCE_EMPLOYEE");
  }

  const db = database();
  const statements = request.body.entries.map((entry) => {
    if (!entry.checkIn && !entry.checkOut) {
      return db.prepare("DELETE FROM attendance_records WHERE employee_code = ? AND attendance_date = ?").bind(entry.employeeCode, request.query.date);
    }
    return db.prepare(`
      INSERT INTO attendance_records (employee_code, attendance_date, check_in, check_out, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_code, attendance_date) DO UPDATE SET
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(entry.employeeCode, request.query.date, entry.checkIn, entry.checkOut, request.user.sub, request.user.sub);
  });
  statements.push(auditStatement(db, request, "update", "attendance_day", request.query.date, null, request.body.entries));
  await batch(statements);
  const rows = await loadDay(request.query.date);
  response.json({
    date: request.query.date,
    officialHours: { start: "07:00", end: "17:00", earlyBefore: "06:00", lateAfter: "21:00" },
    rows,
    summary: { total: rows.length, recorded: rows.filter((row) => row.hasRecord).length },
    message: "تم حفظ سجل الحضور لهذا اليوم."
  });
}));
