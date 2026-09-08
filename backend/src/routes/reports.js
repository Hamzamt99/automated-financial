import { Router } from "express";
import { z } from "zod";
import { first } from "../db.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { getPayPeriod, numeric, roundMoney } from "../lib/domain.js";
import { getRecordRows, getSettings } from "../services/records.js";
import { validate } from "../middleware/validate.js";

export const reportsRouter = Router();
const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

reportsRouter.get("/operators/:id", validate(paramsSchema, "params"), validate(querySchema, "query"), asyncHandler(async (request, response) => {
  const [operator, settings] = await Promise.all([
    first("SELECT id, name, is_active AS isActive FROM operators WHERE id = ?", request.params.id),
    getSettings()
  ]);
  if (!operator) throw new AppError(404, "المشغل غير موجود.", "NOT_FOUND");
  operator.isActive = Boolean(operator.isActive);
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
    addPerson(operator.id, operator.name, "operator", record.operatorMeters, record.date, numeric(settings.operatorRate));
    for (const worker of record.workers) addPerson(worker.id, worker.name, "worker", worker.meters, record.date, numeric(settings.workerRate));
  }
  const payouts = [...people.values()].map(({ dates, ...person }) => ({
    ...person,
    meters: roundMoney(person.meters),
    days: dates.size,
    amount: roundMoney(person.meters * person.rate)
  }));
  response.json({
    operator, period,
    settings: { ...settings, operatorRate: numeric(settings.operatorRate), workerRate: numeric(settings.workerRate) },
    records,
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
  const [worker, settings] = await Promise.all([
    first("SELECT id, name, is_active AS isActive FROM workers WHERE id = ?", request.params.id),
    getSettings()
  ]);
  if (!worker) throw new AppError(404, "العامل غير موجود.", "NOT_FOUND");
  worker.isActive = Boolean(worker.isActive);
  const period = getPayPeriod(request.query.month, settings.cycleStartDay);
  const records = await getRecordRows({ workerId: request.params.id, start: period.start, end: period.end });
  const normalized = records.map((record) => {
    const assignment = record.workers.find((person) => person.id === request.params.id);
    return { ...record, workerMeters: assignment.meters, position: assignment.position, meterEarnings: roundMoney(assignment.meters * numeric(settings.workerRate)) };
  });
  const meters = normalized.reduce((sum, record) => sum + record.workerMeters, 0);
  response.json({
    worker, period,
    settings: { ...settings, workerRate: numeric(settings.workerRate) },
    records: normalized,
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
