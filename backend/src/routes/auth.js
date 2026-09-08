import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { config } from "../config.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();
const loginSchema = z.object({ email: z.string().email().max(255), password: z.string().min(1).max(200) });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

authRouter.post("/login", loginLimiter, validate(loginSchema), asyncHandler(async (request, response) => {
  const result = await pool.query(
    "SELECT id, name, email, password_hash, role FROM app_users WHERE lower(email) = lower($1) AND is_active = true",
    [request.body.email]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(request.body.password, user.password_hash))) {
    throw new AppError(401, "البريد الإلكتروني أو كلمة المرور غير صحيحة.", "INVALID_CREDENTIALS");
  }
  const token = jwt.sign({ sub: user.id, name: user.name, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  response.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (request, response) => {
  const result = await pool.query("SELECT id, name, email, role FROM app_users WHERE id = $1 AND is_active = true", [request.user.sub]);
  if (!result.rowCount) throw new AppError(401, "الحساب غير متاح.", "INVALID_USER");
  response.json({ user: result.rows[0] });
}));
