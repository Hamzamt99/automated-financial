import { AppError } from "../lib/errors.js";

export const validate = (schema, source = "body") => (request, response, next) => {
  const result = schema.safeParse(request[source]);
  if (!result.success) {
    return next(new AppError(400, "يرجى مراجعة البيانات المدخلة.", "VALIDATION_ERROR", result.error.flatten()));
  }
  if (source === "body") request.body = result.data;
  else Object.assign(request[source], result.data);
  next();
};

export function requireWriteAccess(request, response, next) {
  if (!request.user || !["admin", "accountant"].includes(request.user.role)) {
    return next(new AppError(403, "ليس لديك صلاحية لتعديل البيانات.", "FORBIDDEN"));
  }
  next();
}
