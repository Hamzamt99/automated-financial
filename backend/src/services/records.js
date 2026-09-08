import { all, first } from "../db.js";
import { numeric, roundMoney } from "../lib/domain.js";

export const RECORD_SELECT = `
  SELECT wr.id, wr.operator_id AS operatorId, o.name AS operatorName, wr.work_date AS date,
    wr.operator_meters AS operatorMeters, wr.notes,
    COALESCE((
      SELECT json_group_array(json_object('id', ordered.id, 'name', ordered.name, 'position', ordered.position))
      FROM (
        SELECT w.id, w.name, wrw.position
        FROM work_record_workers wrw JOIN workers w ON w.id = wrw.worker_id
        WHERE wrw.work_record_id = wr.id ORDER BY wrw.position
      ) AS ordered
    ), '[]') AS workersJson,
    COALESCE((
      SELECT json_group_array(json_object('id', ordered.id, 'code', ordered.code, 'name', ordered.name, 'price', ordered.price))
      FROM (
        SELECT a.id, a.code, a.name_ar AS name, wra.price_snapshot AS price
        FROM work_record_additions wra JOIN additions a ON a.id = wra.addition_id
        WHERE wra.work_record_id = wr.id ORDER BY a.name_ar
      ) AS ordered
    ), '[]') AS additionsJson
  FROM work_records wr JOIN operators o ON o.id = wr.operator_id`;

export async function getSettings() {
  return first(`SELECT operator_rate AS operatorRate, worker_rate AS workerRate,
    cycle_start_day AS cycleStartDay, currency_code AS currencyCode FROM company_settings WHERE id = 1`);
}

export async function getRecordRows({ operatorId, workerId, start, end }) {
  const bindings = [start, end];
  const conditions = ["wr.work_date BETWEEN ? AND ?"];
  if (operatorId) {
    bindings.push(operatorId);
    conditions.push("wr.operator_id = ?");
  }
  if (workerId) {
    bindings.push(workerId);
    conditions.push("EXISTS (SELECT 1 FROM work_record_workers selected WHERE selected.work_record_id = wr.id AND selected.worker_id = ?)");
  }
  const rows = await all(`${RECORD_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY wr.work_date, wr.created_at`, ...bindings);
  return rows.map(normalizeRecord);
}

export function normalizeRecord(row) {
  const operatorMeters = numeric(row.operatorMeters);
  const workers = typeof row.workersJson === "string" ? JSON.parse(row.workersJson) : row.workersJson || [];
  const rawAdditions = typeof row.additionsJson === "string" ? JSON.parse(row.additionsJson) : row.additionsJson || [];
  const workerMeters = workers.length ? operatorMeters / workers.length : 0;
  const additions = rawAdditions.map((addition) => ({ ...addition, price: numeric(addition.price) }));
  const { workersJson, additionsJson, ...record } = row;
  return {
    ...record,
    operatorMeters,
    workers: workers.map((person) => ({ ...person, meters: workerMeters })),
    additions,
    additionsTotal: roundMoney(additions.reduce((sum, addition) => sum + addition.price, 0))
  };
}
