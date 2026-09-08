export async function writeAudit(client, request, action, entityType, entityId, beforeData = null, afterData = null) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_data, after_data, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [request.user?.sub || null, action, entityType, String(entityId), beforeData, afterData, request.ip]
  );
}
