import { createClient, createServiceClient } from "@/lib/supabase/server"

export type TeamMember = {
  id: string
  full_name: string | null
  email: string | null
  role: "team_lead" | "member" | "site_admin"
  pending_approval: boolean
  created_at: string
}

export async function getTeamById(teamId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("teams")
    .select("id, name, join_code, max_files, lead_id, created_at")
    .eq("id", teamId)
    .maybeSingle()
  return data
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, pending_approval, created_at")
    .eq("team_id", teamId)
    .order("pending_approval", { ascending: false })
    .order("created_at", { ascending: true })

  const rows = (data ?? []) as Omit<TeamMember, "email">[]
  if (rows.length === 0) return []

  // Enrich with email from auth.users (service role only; safe on the server).
  const admin = createServiceClient()
  const emailById = new Map<string, string | null>()
  await Promise.all(
    rows.map(async (r) => {
      try {
        const { data: userData } = await admin.auth.admin.getUserById(r.id)
        emailById.set(r.id, userData?.user?.email ?? null)
      } catch {
        emailById.set(r.id, null)
      }
    }),
  )

  return rows.map((r) => ({ ...r, email: emailById.get(r.id) ?? null }))
}

export async function getTeamInvitations(teamId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("team_invitations")
    .select("id, email, token, expires_at, accepted_at, created_at")
    .eq("team_id", teamId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
  return data ?? []
}
