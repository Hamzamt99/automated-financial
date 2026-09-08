import { Router } from "express";
import { z } from "zod";
import { pool, transaction } from "../db.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { writeAudit } from "../lib/audit.js";
import { requireWriteAccess, validate } from "../middleware/validate.js";

export const entityRouter = Router();
const idSchema = z.object({ id: z.string().uuid() });
const nameSchema = z.object({ name: z.string().trim().min(2).max(120) });

function entityRoutes(path, table, entityType, singularArabic) {
  entityRouter.get(path, asyncHandler(async (request, response) => {
    const includeInactive = request.query.includeInactive === "true" && request.user.role === "admin";
    const result = await pool.query(
      `SELECT id, name, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM ${table} ${includeInactive ? "" : "WHERE is_active = true"} ORDER BY name`
    );
    response.json({ data: result.rows });
  }));

  entityRouter.post(path, requireWriteAccess, validate(nameSchema), asyncHandler(async (request, response) => {
    const row = await transaction(async (client) => {
      const result = await client.query(`INSERT INTO ${table} (name) VALUES ($1) RETURNING id, name, is_active AS "isActive"`, [request.body.name]);
      await writeAudit(client, request, "create", entityType, result.rows[0].id, null, result.rows[0]);
      return result.rows[0];
    });
    response.status(201).json({ data: row, message: `تمت إضافة ${singularArabic} بنجاح.` });
  }));

  entityRouter.patch(`${path}/:id`, requireWriteAccess, validate(idSchema, "params"), validate(nameSchema), asyncHandler(async (request, response) => {
    const row = await transaction(async (client) => {
      const before = await client.query(`SELECT id, name, is_active AS "isActive" FROM ${table} WHERE id = $1 FOR UPDATE`, [request.params.id]);
      if (!before.rowCount) throw new AppError(404, `${singularArabic} غير موجود.`, "NOT_FOUND");
      const result = await client.query(`UPDATE ${table} SET name = $1 WHERE id = $2 RETURNING id, name, is_active AS "isActive"`, [request.body.name, request.params.id]);
      await writeAudit(client, request, "update", entityType, request.params.id, before.rows[0], result.rows[0]);
      return result.rows[0];
    });
    response.json({ data: row, message: "تم حفظ التعديل." });
  }));

  entityRouter.delete(`${path}/:id`, requireWriteAccess, validate(idSchema, "params"), asyncHandler(async (request, response) => {
    await transaction(async (client) => {
      const before = await client.query(`SELECT id, name, is_active AS "isActive" FROM ${table} WHERE id = $1 FOR UPDATE`, [request.params.id]);
      if (!before.rowCount) throw new AppError(404, `${singularArabic} غير موجود.`, "NOT_FOUND");
      await client.query(`UPDATE ${table} SET is_active = false WHERE id = $1`, [request.params.id]);
      await writeAudit(client, request, "archive", entityType, request.params.id, before.rows[0], { ...before.rows[0], isActive: false });
    });
    response.status(204).end();
  }));
}

entityRoutes("/operators", "operators", "operator", "المشغل");
entityRoutes("/workers", "workers", "worker", "العامل");

entityRouter.get("/bootstrap", asyncHandler(async (request, response) => {
  const [settings, additions] = await Promise.all([
    pool.query(`SELECT company_name AS "companyName", operator_rate AS "operatorRate", worker_rate AS "workerRate",
      cycle_start_day AS "cycleStartDay", currency_code AS "currencyCode" FROM company_settings WHERE id = 1`),
    pool.query(`SELECT id, code, name_ar AS "name", price FROM additions WHERE is_active = true ORDER BY price, name_ar`)
  ]);
  response.json({ settings: settings.rows[0], additions: additions.rows });
}));
