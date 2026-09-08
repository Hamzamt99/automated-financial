import { Router } from "express";
import { z } from "zod";
import { all, batch, database, first } from "../db.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { auditStatement } from "../lib/audit.js";
import { requireWriteAccess, validate } from "../middleware/validate.js";
import { RECORD_SELECT, normalizeRecord } from "../services/records.js";

export const recordsRouter = Router();
const idSchema = z.object({ id: z.string().uuid() });
const recordSchema = z.object({
  operatorId: z.string().uuid(),
  date: z.iso.date(),
  operatorMeters: z.coerce.number().positive().max(10_000_000),
  workerIds: z.array(z.string().uuid()).min(1).max(2).refine((ids) => new Set(ids).size === ids.length, "يجب اختيار عاملين مختلفين."),
  additionCodes: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  notes: z.string().trim().max(1000).nullish().transform((value) => value || null)
});

const placeholders = (length) => Array.from({ length }, () => "?").join(", ");

async function verifyReferences(body) {
  const operator = await first("SELECT id FROM operators WHERE id = ? AND is_active = 1", body.operatorId);
  const workers = await all(`SELECT id FROM workers WHERE id IN (${placeholders(body.workerIds.length)}) AND is_active = 1`, ...body.workerIds);
  const uniqueAdditionCodes = [...new Set(body.additionCodes)];
  const additions = uniqueAdditionCodes.length
    ? await all(`SELECT id, code, name_ar AS name, price FROM additions WHERE code IN (${placeholders(uniqueAdditionCodes.length)}) AND is_active = 1`, ...uniqueAdditionCodes)
    : [];
  if (!operator) throw new AppError(400, "المشغل المحدد غير متاح.", "INVALID_OPERATOR");
  if (workers.length !== body.workerIds.length) throw new AppError(400, "أحد العمال المحددين غير متاح.", "INVALID_WORKER");
  if (additions.length !== uniqueAdditionCodes.length) throw new AppError(400, "إحدى الإضافات المحددة غير متاحة.", "INVALID_ADDITION");
  return additions;
}

function assignmentStatements(db, recordId, body, additions) {
  const statements = body.workerIds.map((workerId, index) =>
    db.prepare("INSERT INTO work_record_workers (work_record_id, worker_id, position) VALUES (?, ?, ?)").bind(recordId, workerId, index + 1)
  );
  for (const addition of additions) {
    statements.push(db.prepare("INSERT INTO work_record_additions (work_record_id, addition_id, price_snapshot) VALUES (?, ?, ?)").bind(recordId, addition.id, addition.price));
  }
  return statements;
}

async function loadRecord(id) {
  const row = await first(`${RECORD_SELECT} WHERE wr.id = ?`, id);
  return row ? normalizeRecord(row) : null;
}

recordsRouter.post("/", requireWriteAccess, validate(recordSchema), asyncHandler(async (request, response) => {
  const additions = await verifyReferences(request.body);
  const id = crypto.randomUUID();
  const db = database();
  const auditData = { id, ...request.body };
  await batch([
    db.prepare(`INSERT INTO work_records (id, operator_id, work_date, operator_meters, notes, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, request.body.operatorId, request.body.date, request.body.operatorMeters, request.body.notes, request.user.sub, request.user.sub),
    ...assignmentStatements(db, id, request.body, additions),
    auditStatement(db, request, "create", "work_record", id, null, auditData)
  ]);
  response.status(201).json({ data: await loadRecord(id), message: "تمت إضافة سجل العمل." });
}));

recordsRouter.put("/:id", requireWriteAccess, validate(idSchema, "params"), validate(recordSchema), asyncHandler(async (request, response) => {
  const before = await loadRecord(request.params.id);
  if (!before) throw new AppError(404, "سجل العمل غير موجود.", "NOT_FOUND");
  const additions = await verifyReferences(request.body);
  const db = database();
  const auditData = { id: request.params.id, ...request.body };
  await batch([
    db.prepare(`UPDATE work_records SET operator_id = ?, work_date = ?, operator_meters = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(request.body.operatorId, request.body.date, request.body.operatorMeters, request.body.notes, request.user.sub, request.params.id),
    db.prepare("DELETE FROM work_record_workers WHERE work_record_id = ?").bind(request.params.id),
    db.prepare("DELETE FROM work_record_additions WHERE work_record_id = ?").bind(request.params.id),
    ...assignmentStatements(db, request.params.id, request.body, additions),
    auditStatement(db, request, "update", "work_record", request.params.id, before, auditData)
  ]);
  response.json({ data: await loadRecord(request.params.id), message: "تم حفظ تعديل السجل." });
}));

recordsRouter.delete("/:id", requireWriteAccess, validate(idSchema, "params"), asyncHandler(async (request, response) => {
  const before = await loadRecord(request.params.id);
  if (!before) throw new AppError(404, "سجل العمل غير موجود.", "NOT_FOUND");
  const db = database();
  await batch([
    auditStatement(db, request, "delete", "work_record", request.params.id, before, null),
    db.prepare("DELETE FROM work_records WHERE id = ?").bind(request.params.id)
  ]);
  response.status(204).end();
}));
