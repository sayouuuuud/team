"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type Tab = { href: string; label: string; labelEn: string }

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname()

  const tabs: Tab[] = [
    { href: `/projects/${projectId}`, label: "نظرة عامة", labelEn: "Overview" },
    { href: `/projects/${projectId}/board`, label: "اللوحة", labelEn: "Board" },
    { href: `/projects/${projectId}/time`, label: "الوقت", labelEn: "Time" },
    { href: `/projects/${projectId}/docs`, label: "الدوكيومنتيشن", labelEn: "Docs" },
    { href: `/projects/${projectId}/goals`, label: "الأهداف", labelEn: "Goals" },
    { href: `/projects/${projectId}/announcements`, label: "إعلانات داخلية", labelEn: "Announcements" },
    { href: `/projects/${projectId}/changelog`, label: "تحديثات العميل", labelEn: "Changelog" },
    { href: `/projects/${projectId}/resources`, label: "الموارد", labelEn: "Resources" },
    { href: `/projects/${projectId}/notes`, label: "ملاحظات داخلية", labelEn: "Notes" },
    { href: `/projects/${projectId}/chat`, label: "شات الفريق", labelEn: "Chat" },
  ]

  function isActive(href: string) {
    if (href === `/projects/${projectId}`) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <nav
      className="mb-8 flex flex-wrap gap-1 border-b overflow-x-auto"
      style={{ borderColor: "var(--border)" }}
      aria-label="Project sections"
    >
      {tabs.map((t) => {
        const active = isActive(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className="group relative px-4 py-2.5 flex flex-col items-start"
            style={{
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            <span className="text-sm">{t.label}</span>
            <span className="tag-mono text-[10px] opacity-60">{t.labelEn}</span>
            {active ? (
              <span
                aria-hidden="true"
                className="absolute bottom-[-1px] left-0 right-0 h-0.5"
                style={{ background: "var(--primary)" }}
              />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
