import { Router } from "express";
import { z } from "zod";
import { transaction } from "../db.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { writeAudit } from "../lib/audit.js";
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

async function verifyReferences(client, body) {
  const operator = await client.query("SELECT id FROM operators WHERE id = $1 AND is_active = true", [body.operatorId]);
  const workers = await client.query("SELECT id FROM workers WHERE id = ANY($1::uuid[]) AND is_active = true", [body.workerIds]);
  const additions = body.additionCodes.length
    ? await client.query("SELECT id, code, price FROM additions WHERE code = ANY($1::text[]) AND is_active = true", [body.additionCodes])
    : { rows: [], rowCount: 0 };
  if (!operator.rowCount) throw new AppError(400, "المشغل المحدد غير متاح.", "INVALID_OPERATOR");
  if (workers.rowCount !== body.workerIds.length) throw new AppError(400, "أحد العمال المحددين غير متاح.", "INVALID_WORKER");
  if (additions.rowCount !== new Set(body.additionCodes).size) throw new AppError(400, "إحدى الإضافات المحددة غير متاحة.", "INVALID_ADDITION");
  return additions.rows;
}

async function saveAssignments(client, recordId, body, additions) {
  for (const [index, workerId] of body.workerIds.entries()) {
    await client.query("INSERT INTO work_record_workers (work_record_id, worker_id, position) VALUES ($1, $2, $3)", [recordId, workerId, index + 1]);
  }
  for (const addition of additions) {
    await client.query("INSERT INTO work_record_additions (work_record_id, addition_id, price_snapshot) VALUES ($1, $2, $3)", [recordId, addition.id, addition.price]);
  }
}

async function loadRecord(client, id) {
  const result = await client.query(`${RECORD_SELECT} WHERE wr.id = $1`, [id]);
  return result.rowCount ? normalizeRecord(result.rows[0]) : null;
}

recordsRouter.post("/", requireWriteAccess, validate(recordSchema), asyncHandler(async (request, response) => {
  const record = await transaction(async (client) => {
    const additions = await verifyReferences(client, request.body);
    const result = await client.query(
      `INSERT INTO work_records (operator_id, work_date, operator_meters, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
      [request.body.operatorId, request.body.date, request.body.operatorMeters, request.body.notes, request.user.sub]
    );
    await saveAssignments(client, result.rows[0].id, request.body, additions);
    const created = await loadRecord(client, result.rows[0].id);
    await writeAudit(client, request, "create", "work_record", created.id, null, created);
    return created;
  });
  response.status(201).json({ data: record, message: "تمت إضافة سجل العمل." });
}));

recordsRouter.put("/:id", requireWriteAccess, validate(idSchema, "params"), validate(recordSchema), asyncHandler(async (request, response) => {
  const record = await transaction(async (client) => {
    const lock = await client.query("SELECT id FROM work_records WHERE id = $1 FOR UPDATE", [request.params.id]);
    if (!lock.rowCount) throw new AppError(404, "سجل العمل غير موجود.", "NOT_FOUND");
    const before = await loadRecord(client, request.params.id);
    const additions = await verifyReferences(client, request.body);
    await client.query(
      `UPDATE work_records SET operator_id = $1, work_date = $2, operator_meters = $3, notes = $4, updated_by = $5 WHERE id = $6`,
      [request.body.operatorId, request.body.date, request.body.operatorMeters, request.body.notes, request.user.sub, request.params.id]
    );
    await client.query("DELETE FROM work_record_workers WHERE work_record_id = $1", [request.params.id]);
    await client.query("DELETE FROM work_record_additions WHERE work_record_id = $1", [request.params.id]);
    await saveAssignments(client, request.params.id, request.body, additions);
    const updated = await loadRecord(client, request.params.id);
    await writeAudit(client, request, "update", "work_record", request.params.id, before, updated);
    return updated;
  });
  response.json({ data: record, message: "تم حفظ تعديل السجل." });
}));

recordsRouter.delete("/:id", requireWriteAccess, validate(idSchema, "params"), asyncHandler(async (request, response) => {
  await transaction(async (client) => {
    const lock = await client.query("SELECT id FROM work_records WHERE id = $1 FOR UPDATE", [request.params.id]);
    if (!lock.rowCount) throw new AppError(404, "سجل العمل غير موجود.", "NOT_FOUND");
    const before = await loadRecord(client, request.params.id);
    await writeAudit(client, request, "delete", "work_record", request.params.id, before, null);
    await client.query("DELETE FROM work_records WHERE id = $1", [request.params.id]);
  });
  response.status(204).end();
}));
