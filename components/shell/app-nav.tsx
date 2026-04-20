"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { NotificationsBell } from "./notifications-bell"

type NavItem = { href: string; label: string }

export function AppNav({
  items,
  logoutAction,
  profile,
  teamName,
  bell,
}: {
  items: NavItem[]
  logoutAction: () => Promise<void>
  profile: { full_name: string | null; email: string | null; role: string }
  teamName: string | null
  bell: { userId: string; initialUnread: number } | null
}) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-6 px-6 lg:px-10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span
            className="size-8 rounded-md grid place-items-center"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <span className="font-display text-lg leading-none">T</span>
          </span>
          <span className="font-display text-lg text-foreground tracking-tight hidden sm:inline">
            Team Platform
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "tag-mono rounded-md px-3 py-1.5 whitespace-nowrap transition-colors " +
                  (active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
                style={
                  active
                    ? { background: "color-mix(in oklch, var(--primary) 10%, transparent)" }
                    : undefined
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mr-auto flex items-center gap-3">
          {bell ? (
            <NotificationsBell
              userId={bell.userId}
              initialUnread={bell.initialUnread}
            />
          ) : null}
          <div className="hidden text-right sm:flex sm:flex-col">
            <span className="text-sm font-medium text-foreground leading-tight">
              {profile.full_name ?? profile.email ?? "—"}
            </span>
            <span className="tag-mono text-muted-foreground leading-tight">
              {teamName ?? (profile.role === "site_admin" ? "Site Admin" : "—")}
            </span>
          </div>
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
  )
}
