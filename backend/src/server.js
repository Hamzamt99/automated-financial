import { app } from "./app.js";
import { config, validateConfig } from "./config.js";
import { pool } from "./db.js";

validateConfig();
const server = app.listen(config.port, () => process.stdout.write(`API listening on http://localhost:${config.port}\n`));

async function shutdown(signal) {
  process.stdout.write(`${signal} received, shutting down\n`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
