import { env } from "cloudflare:workers";

export const database = () => env.DB;

export async function all(sql, ...bindings) {
  const result = await database().prepare(sql).bind(...bindings).all();
  return result.results || [];
}

export async function first(sql, ...bindings) {
  return database().prepare(sql).bind(...bindings).first();
}

export async function run(sql, ...bindings) {
  return database().prepare(sql).bind(...bindings).run();
}

export async function batch(statements) {
  return database().batch(statements);
}
