import bcrypt from "bcryptjs";
import { pool, transaction } from "../src/db.js";
import { validateConfig } from "../src/config.js";

validateConfig();
const email = process.env.ADMIN_EMAIL || "admin@company.local";
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters");

await transaction(async (client) => {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await client.query(
    `INSERT INTO app_users (name, email, password_hash, role)
     VALUES ($1, lower($2), $3, 'admin')
     ON CONFLICT ((lower(email))) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, is_active = true
     RETURNING id`,
    [process.env.ADMIN_NAME || "System Administrator", email, passwordHash]
  );

  if (process.env.SEED_DEMO_DATA !== "true") return;
  const operatorNames = ["أحمد محمود", "محمود حسن", "عمر سليمان"];
  const workerNames = ["خالد سمير", "يوسف علي", "سامر عادل", "وليد عمر", "رامي سالم", "حسام ناصر", "فادي إبراهيم", "أنس طارق", "زياد جمال"];
  for (const name of operatorNames) await client.query("INSERT INTO operators (name) VALUES ($1) ON CONFLICT DO NOTHING", [name]);
  for (const name of workerNames) await client.query("INSERT INTO workers (name) VALUES ($1) ON CONFLICT DO NOTHING", [name]);

  const existing = await client.query("SELECT 1 FROM work_records LIMIT 1");
  if (existing.rowCount) return;
  const operators = await client.query("SELECT id, name FROM operators WHERE name = ANY($1)", [operatorNames]);
  const workers = await client.query("SELECT id, name FROM workers WHERE name = ANY($1)", [workerNames]);
  const op = Object.fromEntries(operators.rows.map((row) => [row.name, row.id]));
  const wk = Object.fromEntries(workers.rows.map((row) => [row.name, row.id]));
  const additions = await client.query("SELECT id, code, price FROM additions");
  const ad = Object.fromEntries(additions.rows.map((row) => [row.code, row]));
  const demo = [
    ["2026-09-02", 125, ["خالد سمير", "يوسف علي"], ["sahra", "dinner"]],
    ["2026-09-07", 140, ["يوسف علي", "سامر عادل"], ["holiday"]],
    ["2026-09-13", 108, ["خالد سمير"], []]
  ];
  for (const [date, meters, assignedWorkers, selectedAdditions] of demo) {
    const record = await client.query(
      "INSERT INTO work_records (operator_id, work_date, operator_meters, created_by, updated_by) VALUES ($1, $2, $3, $4, $4) RETURNING id",
      [op["أحمد محمود"], date, meters, user.rows[0].id]
    );
    for (const [index, name] of assignedWorkers.entries()) {
      await client.query("INSERT INTO work_record_workers (work_record_id, worker_id, position) VALUES ($1, $2, $3)", [record.rows[0].id, wk[name], index + 1]);
    }
    for (const code of selectedAdditions) {
      await client.query("INSERT INTO work_record_additions (work_record_id, addition_id, price_snapshot) VALUES ($1, $2, $3)", [record.rows[0].id, ad[code].id, ad[code].price]);
    }
  }
});

process.stdout.write(`Seed complete. Admin: ${email}\n`);
await pool.end();
