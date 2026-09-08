import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { AppError } from "../lib/errors.js";

export function requireAuth(request, response, next) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new AppError(401, "يرجى تسجيل الدخول للمتابعة.", "AUTH_REQUIRED"));
  try {
    request.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    next(new AppError(401, "انتهت جلسة الدخول. يرجى تسجيل الدخول مجدداً.", "INVALID_TOKEN"));
  }
}
