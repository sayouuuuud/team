import { requireUser } from "@/lib/auth/helpers"
import { getTeamById } from "@/lib/data/team"
import { getMyUnreadCount } from "@/lib/data/notifications"
import { logoutAction } from "@/app/auth/actions"
import { AppNav } from "@/components/shell/app-nav"

type NavItem = { href: string; label: string }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser()

  const [team, initialUnread] = await Promise.all([
    me.team_id ? getTeamById(me.team_id) : Promise.resolve(null),
    getMyUnreadCount(),
  ])

  let items: NavItem[]
  if (me.role === "site_admin") {
    items = [
      { href: "/dashboard", label: "الرئيسية" },
      { href: "/admin/settings", label: "إعدادات المنصة" },
      { href: "/testing", label: "ITQ Testing" },
    ]
  } else if (me.team_id && !me.pending_approval) {
    items = [
      { href: "/dashboard", label: "الرئيسية" },
      { href: "/projects", label: "المشاريع" },
      { href: "/my-tasks", label: "مهامي" },
      ...(me.role === "team_lead"
        ? [
            { href: "/ai", label: "المساعد" },
            { href: "/team/templates", label: "القوالب" },
            { href: "/team/audit", label: "السجل" },
          ]
        : []),
      { href: "/team", label: "الفريق" },
      { href: "/account", label: "حسابي" },
    ]
  } else {
    // solo user: no team yet, or pending approval
    items = [
      { href: "/dashboard", label: "الرئيسية" },
      { href: "/account", label: "حسابي" },
    ]
  }

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
        bell={{ userId: me.id, initialUnread }}
      />
      <main className="mx-auto w-full max-w-[1320px] px-6 py-12 lg:px-10 lg:py-16">
        {children}
      </main>
    </div>
  )
}
