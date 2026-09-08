export class AppError extends Error {
  constructor(status, message, code = "REQUEST_FAILED", details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export function notFound(request, response) {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "المسار المطلوب غير موجود." } });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  if (error.code === "23505") {
    return response.status(409).json({ error: { code: "DUPLICATE", message: "هذه البيانات موجودة مسبقاً." } });
  }
  if (error.code === "23503") {
    return response.status(409).json({ error: { code: "IN_USE", message: "لا يمكن تنفيذ العملية لأن السجل مرتبط ببيانات أخرى." } });
  }
  const status = error.status || 500;
  if (status >= 500) request.log?.error(error);
  response.status(status).json({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: status >= 500 ? "حدث خطأ غير متوقع في الخادم." : error.message,
      ...(error.details ? { details: error.details } : {})
    }
  });
}
