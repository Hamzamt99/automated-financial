import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config, validateConfig } from "./config.js";
import { first } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { entityRouter } from "./routes/entities.js";
import { recordsRouter } from "./routes/records.js";
import { reportsRouter } from "./routes/reports.js";
import { attendanceRouter } from "./routes/attendance.js";
import { requireAuth } from "./middleware/auth.js";
import { asyncHandler, errorHandler, notFound } from "./lib/errors.js";

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    const isProjectWorker = origin && /^https:\/\/automated-financial-web\.[a-z0-9-]+\.workers\.dev$/i.test(origin);
    callback(null, !origin || config.frontendOrigins.includes(origin) || isProjectWorker);
  },
  credentials: false
}));
app.use(express.json({ limit: "200kb" }));
app.use((request, response, next) => {
  try { validateConfig(); next(); }
  catch (error) { next(error); }
});

app.get("/api/health", asyncHandler(async (request, response) => {
  await first("SELECT 1 AS healthy");
  response.json({ status: "ok", service: "production-ledger-api", timestamp: new Date().toISOString() });
}));
app.use("/api/auth", authRouter);
app.use("/api", requireAuth);
app.use("/api", entityRouter);
app.use("/api/records", recordsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/attendance", attendanceRouter);
app.use(notFound);
app.use(errorHandler);
