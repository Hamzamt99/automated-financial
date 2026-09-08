import { Router } from "express";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { batch, database, first } from "../db.js";
import { config } from "../config.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { auditStatement } from "../lib/audit.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();
const loginSchema = z.object({ email: z.string().email().max(255), password: z.string().min(1).max(200) });
const setupSchema = z.object({
  setupToken: z.string().min(20).max(500),
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(255),
  password: z.string().min(10).max(200)
});

function tokensMatch(provided, expected) {
  const left = Buffer.from(provided || "");
  const right = Buffer.from(expected || "");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

authRouter.get("/status", asyncHandler(async (request, response) => {
  const existing = await first("SELECT COUNT(*) AS count FROM app_users");
  response.json({ setupRequired: Number(existing.count) === 0 });
}));

authRouter.post("/setup", validate(setupSchema), asyncHandler(async (request, response) => {
  const existing = await first("SELECT COUNT(*) AS count FROM app_users");
  if (Number(existing.count) > 0) throw new AppError(409, "تم إعداد مدير النظام مسبقاً.", "SETUP_COMPLETE");
  if (!tokensMatch(request.body.setupToken, config.setupToken)) throw new AppError(403, "رمز الإعداد غير صحيح.", "INVALID_SETUP_TOKEN");
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(request.body.password);
  const user = { id, name: request.body.name, email: request.body.email.toLowerCase(), role: "admin" };
  const db = database();
  await batch([
    db.prepare("INSERT INTO app_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')").bind(id, user.name, user.email, passwordHash),
    auditStatement(db, request, "create", "user", id, null, user)
  ]);
  response.status(201).json({ message: "تم إنشاء مدير النظام. يمكنك تسجيل الدخول الآن." });
}));

authRouter.post("/login", validate(loginSchema), asyncHandler(async (request, response) => {
  const user = await first(
    "SELECT id, name, email, password_hash AS passwordHash, role FROM app_users WHERE email = ? COLLATE NOCASE AND is_active = 1",
    request.body.email
  );
  if (!user || !(await verifyPassword(request.body.password, user.passwordHash))) {
    throw new AppError(401, "البريد الإلكتروني أو كلمة المرور غير صحيحة.", "INVALID_CREDENTIALS");
  }
  const token = jwt.sign({ sub: user.id, name: user.name, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  response.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (request, response) => {
  const user = await first("SELECT id, name, email, role FROM app_users WHERE id = ? AND is_active = 1", request.user.sub);
  if (!user) throw new AppError(401, "الحساب غير متاح.", "INVALID_USER");
  response.json({ user });
}));
