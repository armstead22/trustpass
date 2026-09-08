import { db } from "../storage";
import { auditLogs } from "@shared/schema";

/**
 * Immutable audit log. Every sensitive action is recorded with actor,
 * role, action verb, target, and JSON metadata. Never mutates rows.
 */
export async function audit(input: {
  actorId: number | null;
  actorRole: "user" | "admin" | "partner" | "system";
  action: string;
  targetId?: number | null;
  metadata?: Record<string, unknown>;
}) {
  db.insert(auditLogs)
    .values({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      targetId: input.targetId ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
    })
    .run();
}
