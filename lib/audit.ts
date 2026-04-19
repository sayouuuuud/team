import { createClient } from "@/lib/supabase/server"

/**
 * Write an entry to audit_log. Swallows errors so it can't break the
 * user-facing action if the log insert fails.
 */
export async function audit(
  actorId: string | null,
  teamId: string | null,
  event: string,
  entityType: string | null,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from("audit_log").insert({
      team_id: teamId,
      actor_type: actorId ? "user" : "system",
      actor_id: actorId,
      event,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to write", event, err)
  }
}
