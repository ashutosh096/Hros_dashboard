import { db, auditLogsTable } from "@workspace/db";

export async function logAuditEvent(
  organizationId: number,
  actorUserId: number | null,
  action: string,
  entityType: string,
  entityId: number,
  before?: any,
  after?: any
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      before: before || null,
      after: after || null,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
