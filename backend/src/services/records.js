import { pool } from "../db.js";
import { numeric, roundMoney } from "../lib/domain.js";

const RECORD_SELECT = `
  SELECT wr.id, wr.operator_id AS "operatorId", o.name AS "operatorName", wr.work_date AS "date",
    wr.operator_meters AS "operatorMeters", wr.notes,
    COALESCE((SELECT json_agg(json_build_object('id', w.id, 'name', w.name, 'position', wrw.position) ORDER BY wrw.position)
      FROM work_record_workers wrw JOIN workers w ON w.id = wrw.worker_id WHERE wrw.work_record_id = wr.id), '[]'::json) AS workers,
    COALESCE((SELECT json_agg(json_build_object('id', a.id, 'code', a.code, 'name', a.name_ar, 'price', wra.price_snapshot) ORDER BY a.name_ar)
      FROM work_record_additions wra JOIN additions a ON a.id = wra.addition_id WHERE wra.work_record_id = wr.id), '[]'::json) AS additions
  FROM work_records wr JOIN operators o ON o.id = wr.operator_id`;

export async function getSettings(client = pool) {
  const result = await client.query(`SELECT operator_rate AS "operatorRate", worker_rate AS "workerRate", cycle_start_day AS "cycleStartDay", currency_code AS "currencyCode" FROM company_settings WHERE id = 1`);
  return result.rows[0];
}

export async function getRecordRows({ operatorId, workerId, start, end }, client = pool) {
  const values = [start, end];
  const conditions = ["wr.work_date BETWEEN $1 AND $2"];
  if (operatorId) {
    values.push(operatorId);
    conditions.push(`wr.operator_id = $${values.length}`);
  }
  if (workerId) {
    values.push(workerId);
    conditions.push(`EXISTS (SELECT 1 FROM work_record_workers selected WHERE selected.work_record_id = wr.id AND selected.worker_id = $${values.length})`);
  }
  const result = await client.query(`${RECORD_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY wr.work_date, wr.created_at`, values);
  return result.rows.map(normalizeRecord);
}

export function normalizeRecord(row) {
  const operatorMeters = numeric(row.operatorMeters);
  const workerMeters = row.workers.length ? operatorMeters / row.workers.length : 0;
  const additions = row.additions.map((addition) => ({ ...addition, price: numeric(addition.price) }));
  return {
    ...row,
    date: typeof row.date === "string" ? row.date : row.date.toISOString().slice(0, 10),
    operatorMeters,
    workers: row.workers.map((person) => ({ ...person, meters: workerMeters })),
    additions,
    additionsTotal: roundMoney(additions.reduce((sum, addition) => sum + addition.price, 0))
  };
}

export { RECORD_SELECT };
