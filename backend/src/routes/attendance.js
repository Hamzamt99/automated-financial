import { Router } from "express";
import { z } from "zod";
import { all, batch, database, first } from "../db.js";
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
const employeeCodeSchema = z.object({ employeeCode: z.string().regex(/^\d{1,12}$/) });
const employeeSchema = z.object({
  employeeCode: z.string().regex(/^\d{1,12}$/),
  name: z.string().trim().min(2).max(160)
});
const employeeNameSchema = employeeSchema.pick({ name: true });
const normalizeEmployee = (row) => row ? { ...row, isActive: Boolean(row.isActive) } : row;

const displayCheckIn = (value) => value && value < "06:00" ? "سروة" : value;
const displayCheckOut = (value) => value && value > "21:00" ? "سهرة" : value;
const checkOutLabels = (value) => value && value > "21:00"
  ? ["سهرة", ...(value >= "22:00" ? ["عشاء"] : [])]
  : [];

async function loadDay(date) {
  const rows = await all(`
    SELECT ae.employee_code AS employeeCode, ae.name, ae.is_active AS isActive,
      ar.check_in AS checkIn, ar.check_out AS checkOut, ar.updated_at AS updatedAt
    FROM attendance_employees ae
    LEFT JOIN attendance_records ar
      ON ar.employee_code = ae.employee_code AND ar.attendance_date = ?
    WHERE ae.is_active = 1 OR ar.id IS NOT NULL
    ORDER BY ae.sort_order, CAST(ae.employee_code AS INTEGER)
  `, date);
  return rows.map((row) => ({
    ...row,
    isActive: Boolean(row.isActive),
    checkInDisplay: displayCheckIn(row.checkIn),
    checkOutDisplay: displayCheckOut(row.checkOut),
    checkOutLabels: checkOutLabels(row.checkOut),
    hasRecord: Boolean(row.checkIn || row.checkOut)
  }));
}

attendanceRouter.get("/employees", asyncHandler(async (request, response) => {
  const includeInactive = request.query.includeInactive === "true";
  const rows = await all(`
    SELECT employee_code AS employeeCode, name, is_active AS isActive, sort_order AS sortOrder, created_at AS createdAt
    FROM attendance_employees
    ${includeInactive ? "" : "WHERE is_active = 1"}
    ORDER BY sort_order, CAST(employee_code AS INTEGER)
  `);
  response.json({ data: rows.map(normalizeEmployee) });
}));

attendanceRouter.post("/employees", requireWriteAccess, validate(employeeSchema), asyncHandler(async (request, response) => {
  const existing = await first("SELECT employee_code AS employeeCode, is_active AS isActive FROM attendance_employees WHERE employee_code = ?", request.body.employeeCode);
  if (existing) throw new AppError(409, existing.isActive ? "رمز الموظف مستخدم بالفعل." : "هذا الرمز يخص موظفاً مؤرشفاً. يمكنك استعادته بدلاً من إنشاء سجل جديد.", "EMPLOYEE_CODE_EXISTS");
  const nextOrder = await first("SELECT COALESCE(MAX(sort_order), 0) + 1 AS sortOrder FROM attendance_employees");
  const row = { employeeCode: request.body.employeeCode, name: request.body.name, isActive: true, sortOrder: Number(nextOrder.sortOrder) };
  const db = database();
  await batch([
    db.prepare("INSERT INTO attendance_employees (employee_code, name, sort_order) VALUES (?, ?, ?)").bind(row.employeeCode, row.name, row.sortOrder),
    auditStatement(db, request, "create", "attendance_employee", row.employeeCode, null, row)
  ]);
  response.status(201).json({ data: row, message: "تمت إضافة موظف الحضور." });
}));

attendanceRouter.patch("/employees/:employeeCode", requireWriteAccess, validate(employeeCodeSchema, "params"), validate(employeeNameSchema), asyncHandler(async (request, response) => {
  const before = normalizeEmployee(await first("SELECT employee_code AS employeeCode, name, is_active AS isActive, sort_order AS sortOrder FROM attendance_employees WHERE employee_code = ?", request.params.employeeCode));
  if (!before) throw new AppError(404, "موظف الحضور غير موجود.", "NOT_FOUND");
  const row = { ...before, name: request.body.name };
  const db = database();
  await batch([
    db.prepare("UPDATE attendance_employees SET name = ? WHERE employee_code = ?").bind(row.name, row.employeeCode),
    auditStatement(db, request, "update", "attendance_employee", row.employeeCode, before, row)
  ]);
  response.json({ data: row, message: "تم حفظ اسم الموظف." });
}));

attendanceRouter.delete("/employees/:employeeCode", requireWriteAccess, validate(employeeCodeSchema, "params"), asyncHandler(async (request, response) => {
  const before = normalizeEmployee(await first("SELECT employee_code AS employeeCode, name, is_active AS isActive, sort_order AS sortOrder FROM attendance_employees WHERE employee_code = ?", request.params.employeeCode));
  if (!before) throw new AppError(404, "موظف الحضور غير موجود.", "NOT_FOUND");
  const db = database();
  await batch([
    db.prepare("UPDATE attendance_employees SET is_active = 0 WHERE employee_code = ?").bind(before.employeeCode),
    auditStatement(db, request, "archive", "attendance_employee", before.employeeCode, before, { ...before, isActive: false })
  ]);
  response.status(204).end();
}));

attendanceRouter.patch("/employees/:employeeCode/restore", requireWriteAccess, validate(employeeCodeSchema, "params"), asyncHandler(async (request, response) => {
  const before = normalizeEmployee(await first("SELECT employee_code AS employeeCode, name, is_active AS isActive, sort_order AS sortOrder FROM attendance_employees WHERE employee_code = ?", request.params.employeeCode));
  if (!before) throw new AppError(404, "موظف الحضور غير موجود.", "NOT_FOUND");
  const row = { ...before, isActive: true };
  const db = database();
  await batch([
    db.prepare("UPDATE attendance_employees SET is_active = 1 WHERE employee_code = ?").bind(before.employeeCode),
    auditStatement(db, request, "restore", "attendance_employee", before.employeeCode, before, row)
  ]);
  response.json({ data: row, message: "تمت استعادة الموظف إلى كشف الحضور." });
}));

attendanceRouter.get("/", validate(dateSchema, "query"), asyncHandler(async (request, response) => {
  const rows = await loadDay(request.query.date);
  response.json({
    date: request.query.date,
    officialHours: { start: "07:00", end: "17:00", earlyBefore: "06:00", lateAfter: "21:00", dinnerFrom: "22:00" },
    rows,
    summary: { total: rows.length, recorded: rows.filter((row) => row.hasRecord).length }
  });
}));

attendanceRouter.put("/", requireWriteAccess, validate(dateSchema, "query"), validate(saveSchema), asyncHandler(async (request, response) => {
  const codes = request.body.entries.map((entry) => entry.employeeCode);
  if (codes.length) {
    const placeholders = codes.map(() => "?").join(", ");
    const employees = await all(`
      SELECT ae.employee_code
      FROM attendance_employees ae
      LEFT JOIN attendance_records ar ON ar.employee_code = ae.employee_code AND ar.attendance_date = ?
      WHERE ae.employee_code IN (${placeholders}) AND (ae.is_active = 1 OR ar.id IS NOT NULL)
    `, request.query.date, ...codes);
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
    officialHours: { start: "07:00", end: "17:00", earlyBefore: "06:00", lateAfter: "21:00", dinnerFrom: "22:00" },
    rows,
    summary: { total: rows.length, recorded: rows.filter((row) => row.hasRecord).length },
    message: "تم حفظ سجل الحضور لهذا اليوم."
  });
}));
