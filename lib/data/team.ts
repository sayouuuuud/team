import { createClient } from "@/lib/supabase/server"

export type TeamMember = {
  id: string
  full_name: string | null
  email: string | null
  role: "team_lead" | "member" | "site_admin"
  pending_approval: boolean
  avatar_url: string | null
  created_at: string
}

export async function getTeamById(teamId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("teams")
    .select("id, name, slug, join_code, brand_color, created_at")
    .eq("id", teamId)
    .maybeSingle()
  return data
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, pending_approval, avatar_url, created_at")
    .eq("team_id", teamId)
    .order("pending_approval", { ascending: false })
    .order("created_at", { ascending: true })
  return (data ?? []) as TeamMember[]
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
