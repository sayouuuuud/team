import Link from "next/link"
import { requireUser } from "@/lib/auth/helpers"
import { getMyNotifications } from "@/lib/data/notifications"
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
} from "./actions"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "الإشعارات",
  description: "آخر الأحداث التي تخصك",
}

const KIND_LABEL: Record<string, string> = {
  milestone_assigned: "تم إسنادك لمعلم",
  milestone_submitted: "معلم للمراجعة",
  milestone_approved: "معلم معتمد",
  milestone_rejected: "معلم مرفوض",
  announcement_posted: "إعلان جديد",
  comment_added: "تعليق جديد",
  goal_updated: "تحديث هدف",
  system: "إشعار نظام",
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.round(ms / 1000)
  if (s < 60) return "الآن"
  const m = Math.round(s / 60)
  if (m < 60) return `منذ ${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return `منذ ${h} ساعة`
  const d = Math.round(h / 24)
  if (d < 7) return `منذ ${d} يوم`
  return new Date(iso).toLocaleDateString("ar")
}

export default async function NotificationsPage() {
  await requireUser("/notifications")
  const items = await getMyNotifications(100)
  const unread = items.filter((n) => !n.read_at).length

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">الإشعارات</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            {unread > 0
              ? `لديك ${unread} إشعار غير مقروء`
              : "كل شيء على ما يرام — لا إشعارات جديدة"}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button
              type="submit"
              className="text-xs tag-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              وضع الكل مقروء
            </button>
          </form>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="card-paper p-8 text-center text-sm text-muted-foreground">
          لا إشعارات حتى الآن.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const isUnread = !n.read_at
            return (
              <li
                key={n.id}
                className="card-paper p-4 flex items-start gap-3"
                style={{
                  borderInlineStartWidth: isUnread ? 3 : 1,
                  borderInlineStartColor: isUnread
                    ? "var(--color-foreground)"
                    : undefined,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="tag-mono text-muted-foreground">
                      {KIND_LABEL[n.type] ?? n.type}
                    </span>
                    <span className="tag-mono text-muted-foreground num-latin">
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                  <div className="font-medium text-foreground text-sm leading-relaxed">
                    {n.link ? (
                      <Link href={n.link} className="hover:underline">
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </div>
                  {n.body ? (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {n.body}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {isUnread ? (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        className="tag-mono text-muted-foreground hover:text-foreground transition-colors"
                      >
                        مقروء
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteNotificationAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      className="tag-mono text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="حذف"
                    >
                      حذف
                    </button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
