import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { entityRouter } from "./routes/entities.js";
import { recordsRouter } from "./routes/records.js";
import { reportsRouter } from "./routes/reports.js";
import { requireAuth } from "./middleware/auth.js";
import { asyncHandler, errorHandler, notFound } from "./lib/errors.js";

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(pinoHttp());
app.use(helmet());
app.use(cors({ origin: config.frontendOrigins, credentials: false }));
app.use(express.json({ limit: "200kb" }));

app.get("/api/health", asyncHandler(async (request, response) => {
  await pool.query("SELECT 1");
  response.json({ status: "ok", service: "production-ledger-api", timestamp: new Date().toISOString() });
}));
app.use("/api/auth", authRouter);
app.use("/api", requireAuth);
app.use("/api", entityRouter);
app.use("/api/records", recordsRouter);
app.use("/api/reports", reportsRouter);
app.use(notFound);
app.use(errorHandler);
