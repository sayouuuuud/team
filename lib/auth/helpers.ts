import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type Role = "site_admin" | "team_lead" | "member"

export type AuthProfile = {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  team_id: string | null
  language: "ar" | "en"
  theme: "light" | "dark" | "system"
  pending_approval: boolean
}

/**
 * Resolve the current authenticated user + profile in one call.
 * Cached per request via React `cache`.
 */
export const getCurrentUser = cache(async (): Promise<AuthProfile | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, team_id, language, theme, pending_approval")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? null,
      full_name: null,
      role: "member",
      team_id: null,
      language: "ar",
      theme: "system",
      pending_approval: true,
    }
  }

  return {
    id: profile.id,
    email: user.email ?? null,
    full_name: profile.full_name,
    role: profile.role as Role,
    team_id: profile.team_id,
    language: profile.language,
    theme: profile.theme,
    pending_approval: profile.pending_approval,
  }
})

/** Require a logged-in user or redirect to /login. */
export async function requireUser(nextPath?: string): Promise<AuthProfile> {
  const user = await getCurrentUser()
  if (!user) {
    const target = nextPath
      ? `/login?next=${encodeURIComponent(nextPath)}`
      : "/login"
    redirect(target)
  }
  return user
}

/** Require a specific role (or one of several) or redirect. */
export async function requireRole(
  roles: Role | Role[],
  nextPath?: string,
): Promise<AuthProfile> {
  const user = await requireUser(nextPath)
  const allowed = Array.isArray(roles) ? roles : [roles]
  if (!allowed.includes(user.role)) {
    redirect("/")
  }
  return user
}
