import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { getPayPeriod, numeric, roundMoney } from "../lib/domain.js";
import { getRecordRows, getSettings } from "../services/records.js";
import { validate } from "../middleware/validate.js";

export const reportsRouter = Router();
const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

reportsRouter.get("/operators/:id", validate(paramsSchema, "params"), validate(querySchema, "query"), asyncHandler(async (request, response) => {
  const [operatorResult, settings] = await Promise.all([
    pool.query("SELECT id, name, is_active AS \"isActive\" FROM operators WHERE id = $1", [request.params.id]),
    getSettings()
  ]);
  if (!operatorResult.rowCount) throw new AppError(404, "المشغل غير موجود.", "NOT_FOUND");
  const period = getPayPeriod(request.query.month, settings.cycleStartDay);
  const records = await getRecordRows({ operatorId: request.params.id, start: period.start, end: period.end });
  const people = new Map();
  const addPerson = (id, name, role, meters, date, rate) => {
    if (!people.has(id)) people.set(id, { id, name, role, meters: 0, dates: new Set(), rate });
    const person = people.get(id);
    person.meters += meters;
    person.dates.add(date);
  };
  for (const record of records) {
    addPerson(operatorResult.rows[0].id, operatorResult.rows[0].name, "operator", record.operatorMeters, record.date, numeric(settings.operatorRate));
    for (const worker of record.workers) addPerson(worker.id, worker.name, "worker", worker.meters, record.date, numeric(settings.workerRate));
  }
  const payouts = [...people.values()].map(({ dates, ...person }) => ({
    ...person,
    meters: roundMoney(person.meters),
    days: dates.size,
    amount: roundMoney(person.meters * person.rate)
  }));
  response.json({
    operator: operatorResult.rows[0], period, settings: { ...settings, operatorRate: numeric(settings.operatorRate), workerRate: numeric(settings.workerRate) }, records,
    totals: {
      records: records.length,
      days: new Set(records.map((record) => record.date)).size,
      meters: roundMoney(records.reduce((sum, record) => sum + record.operatorMeters, 0)),
      additions: roundMoney(records.reduce((sum, record) => sum + record.additionsTotal, 0)),
      meterEarnings: roundMoney(payouts.reduce((sum, person) => sum + person.amount, 0))
    },
    payouts
  });
}));

reportsRouter.get("/workers/:id", validate(paramsSchema, "params"), validate(querySchema, "query"), asyncHandler(async (request, response) => {
  const [workerResult, settings] = await Promise.all([
    pool.query("SELECT id, name, is_active AS \"isActive\" FROM workers WHERE id = $1", [request.params.id]),
    getSettings()
  ]);
  if (!workerResult.rowCount) throw new AppError(404, "العامل غير موجود.", "NOT_FOUND");
  const period = getPayPeriod(request.query.month, settings.cycleStartDay);
  const records = await getRecordRows({ workerId: request.params.id, start: period.start, end: period.end });
  const normalized = records.map((record) => {
    const assignment = record.workers.find((person) => person.id === request.params.id);
    return { ...record, workerMeters: assignment.meters, position: assignment.position, meterEarnings: roundMoney(assignment.meters * numeric(settings.workerRate)) };
  });
  const meters = normalized.reduce((sum, record) => sum + record.workerMeters, 0);
  response.json({
    worker: workerResult.rows[0], period, settings: { ...settings, workerRate: numeric(settings.workerRate) }, records: normalized,
    totals: {
      records: normalized.length,
      days: new Set(normalized.map((record) => record.date)).size,
      operators: new Set(normalized.map((record) => record.operatorId)).size,
      meters: roundMoney(meters),
      additions: roundMoney(normalized.reduce((sum, record) => sum + record.additionsTotal, 0)),
      meterEarnings: roundMoney(meters * numeric(settings.workerRate))
    }
  });
}));
