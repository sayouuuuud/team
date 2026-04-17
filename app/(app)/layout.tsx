import { requireUser } from "@/lib/auth/helpers"
import { getTeamById } from "@/lib/data/team"
import { logoutAction } from "@/app/auth/actions"
import { AppNav } from "@/components/shell/app-nav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser()

  const team = me.team_id ? await getTeamById(me.team_id) : null

  const items =
    me.role === "site_admin"
      ? [
          { href: "/dashboard", label: "الرئيسية" },
          { href: "/admin/settings", label: "إعدادات المنصة" },
          { href: "/testing", label: "ITQ Testing" },
        ]
      : [
          { href: "/dashboard", label: "الرئيسية" },
          { href: "/projects", label: "المشاريع" },
          { href: "/team", label: "الفريق" },
          { href: "/testing", label: "ITQ Testing" },
        ]

  return (
    <div className="min-h-screen paper-bg">
      <AppNav
        items={items}
        logoutAction={logoutAction}
        profile={{
          full_name: me.full_name,
          email: me.email,
          role: me.role,
        }}
        teamName={team?.name ?? null}
      />
      <main className="mx-auto w-full max-w-[1320px] px-6 py-12 lg:px-10 lg:py-16">
        {children}
      </main>
    </div>
  )
}
