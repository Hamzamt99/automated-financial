import { Router } from "express";
import { z } from "zod";
import { all, batch, database, first } from "../db.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { auditStatement } from "../lib/audit.js";
import { requireWriteAccess, validate } from "../middleware/validate.js";

export const entityRouter = Router();
const idSchema = z.object({ id: z.string().uuid() });
const nameSchema = z.object({ name: z.string().trim().min(2).max(120) });
const normalize = (row) => row ? { ...row, isActive: Boolean(row.isActive) } : row;

function entityRoutes(path, table, entityType, singularArabic) {
  entityRouter.get(path, asyncHandler(async (request, response) => {
    const includeInactive = request.query.includeInactive === "true" && request.user.role === "admin";
    const rows = await all(
      `SELECT id, name, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
       FROM ${table} ${includeInactive ? "" : "WHERE is_active = 1"} ORDER BY name COLLATE NOCASE`
    );
    response.json({ data: rows.map(normalize) });
  }));

  entityRouter.post(path, requireWriteAccess, validate(nameSchema), asyncHandler(async (request, response) => {
    const id = crypto.randomUUID();
    const row = { id, name: request.body.name, isActive: true };
    const db = database();
    await batch([
      db.prepare(`INSERT INTO ${table} (id, name) VALUES (?, ?)`).bind(id, row.name),
      auditStatement(db, request, "create", entityType, id, null, row)
    ]);
    response.status(201).json({ data: row, message: `تمت إضافة ${singularArabic} بنجاح.` });
  }));

  entityRouter.patch(`${path}/:id`, requireWriteAccess, validate(idSchema, "params"), validate(nameSchema), asyncHandler(async (request, response) => {
    const before = normalize(await first(`SELECT id, name, is_active AS isActive FROM ${table} WHERE id = ?`, request.params.id));
    if (!before) throw new AppError(404, `${singularArabic} غير موجود.`, "NOT_FOUND");
    const row = { ...before, name: request.body.name };
    const db = database();
    await batch([
      db.prepare(`UPDATE ${table} SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(row.name, row.id),
      auditStatement(db, request, "update", entityType, row.id, before, row)
    ]);
    response.json({ data: row, message: "تم حفظ التعديل." });
  }));

  entityRouter.delete(`${path}/:id`, requireWriteAccess, validate(idSchema, "params"), asyncHandler(async (request, response) => {
    const before = normalize(await first(`SELECT id, name, is_active AS isActive FROM ${table} WHERE id = ?`, request.params.id));
    if (!before) throw new AppError(404, `${singularArabic} غير موجود.`, "NOT_FOUND");
    const db = database();
    await batch([
      db.prepare(`UPDATE ${table} SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(request.params.id),
      auditStatement(db, request, "archive", entityType, request.params.id, before, { ...before, isActive: false })
    ]);
    response.status(204).end();
  }));
}

entityRoutes("/operators", "operators", "operator", "المشغل");
entityRoutes("/workers", "workers", "worker", "العامل");

entityRouter.get("/bootstrap", asyncHandler(async (request, response) => {
  const [settings, additions] = await Promise.all([
    first(`SELECT company_name AS companyName, operator_rate AS operatorRate, worker_rate AS workerRate,
      cycle_start_day AS cycleStartDay, currency_code AS currencyCode FROM company_settings WHERE id = 1`),
    all("SELECT id, code, name_ar AS name, price FROM additions WHERE is_active = 1 ORDER BY price, name_ar")
  ]);
  response.json({ settings, additions });
}));
