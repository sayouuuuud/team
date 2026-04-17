import Link from "next/link"
import { requireRole } from "@/lib/auth/helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { logoutAction } from "@/app/auth/actions"
import {
  SiteSettingsForm,
  type SiteSettingsValues,
} from "@/components/admin/site-settings-form"

export const dynamic = "force-dynamic"

export default async function AdminSettingsPage() {
  const me = await requireRole("site_admin", "/admin/settings")

  const service = createServiceClient()
  const { data } = await service
    .from("site_settings")
    .select(
      "site_name, signups_open, default_team_capacity, default_max_files, max_file_size_mb, invitation_ttl_days, ai_enabled, ai_daily_limit_per_team",
    )
    .eq("id", 1)
    .maybeSingle()

  const initial: SiteSettingsValues = {
    site_name: data?.site_name ?? "Team Platform",
    signups_open: data?.signups_open ?? true,
    default_team_capacity: data?.default_team_capacity ?? 8,
    default_max_files: data?.default_max_files ?? 5,
    max_file_size_mb: data?.max_file_size_mb ?? 500,
    invitation_ttl_days: data?.invitation_ttl_days ?? 7,
    ai_enabled: data?.ai_enabled ?? true,
    ai_daily_limit_per_team: data?.ai_daily_limit_per_team ?? 100,
  }

  return (
    <div className="min-h-screen paper-bg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <span
                className="size-8 rounded-md grid place-items-center"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                <span className="font-display text-lg leading-none">T</span>
              </span>
              <span className="font-display text-lg text-foreground tracking-tight">
                Team Platform
              </span>
            </Link>
            <span className="tag-mono text-muted-foreground hidden md:inline">
              · Site admin
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard"
              className="tag-mono text-muted-foreground hover:text-foreground transition"
            >
              Dashboard
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="tag-mono text-muted-foreground hover:text-foreground transition"
              >
                تسجيل خروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-6 lg:px-10 py-12 lg:py-16">
        <div className="mb-10">
          <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
            Admin · Settings
          </div>
          <h1 className="display-hero text-4xl lg:text-5xl text-foreground">
            إعدادات المنصة
          </h1>
          <p className="text-muted-foreground leading-relaxed mt-5 max-w-md text-pretty">
            تحكم في الإعدادات العامة للمنصة. تظهر فقط لـ Site Admin ({me.email}).
          </p>
          <div className="gold-rule w-14 mt-6" />
        </div>

        <SiteSettingsForm initial={initial} />
      </main>
    </div>
  )
}
