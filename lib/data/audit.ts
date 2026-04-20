import "server-only"
import { createClient } from "@/lib/supabase/server"

export type AuditRow = {
  id: number
  team_id: string | null
  actor_type: string
  actor_id: string | null
  actor_name: string | null
  event: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type AuditFilter = {
  event?: string | null
  entityType?: string | null
  actorId?: string | null
  from?: string | null // ISO date (yyyy-mm-dd)
  to?: string | null   // ISO date (yyyy-mm-dd)
  limit?: number
}

const SELECT =
  "id, team_id, actor_type, actor_id, actor_name, event, entity_type, entity_id, metadata, created_at"

export async function getAuditLog(
  teamId: string,
  filter: AuditFilter = {},
): Promise<AuditRow[]> {
  const supabase = await createClient()
  let q = supabase
    .from("audit_log")
    .select(SELECT)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 300)

  if (filter.event) q = q.eq("event", filter.event)
  if (filter.entityType) q = q.eq("entity_type", filter.entityType)
  if (filter.actorId) q = q.eq("actor_id", filter.actorId)
  if (filter.from) q = q.gte("created_at", `${filter.from}T00:00:00Z`)
  if (filter.to) q = q.lte("created_at", `${filter.to}T23:59:59Z`)

  const { data } = await q
  return (data ?? []) as AuditRow[]
}

/**
 * Distinct event names for the current team (used in filter dropdown).
 */
export async function getDistinctAuditEvents(teamId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("audit_log")
    .select("event")
    .eq("team_id", teamId)
    .order("event")
    .limit(500)

  const set = new Set<string>()
  for (const row of data ?? []) set.add((row as { event: string }).event)
  return Array.from(set).sort()
}
