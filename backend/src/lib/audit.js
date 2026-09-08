export function auditStatement(db, request, action, entityType, entityId, beforeData = null, afterData = null) {
  return db.prepare(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_data, after_data, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    request.user?.sub || null,
    action,
    entityType,
    String(entityId),
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    request.headers["cf-connecting-ip"] || request.ip || null
  );
}
