import Link from "next/link"
import { requireRole } from "@/lib/auth/helpers"
import { getTeamTemplates } from "@/lib/data/templates"
import { deleteTemplateAction } from "./actions"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "قوالب المعالم",
  description: "قوالب معالم قابلة لإعادة الاستخدام لفريقك",
}

export default async function TemplatesPage() {
  const me = await requireRole("team_lead", "/team/templates")
  if (!me.team_id) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">لا يوجد فريق مرتبط.</p>
      </main>
    )
  }

  const templates = await getTeamTemplates(me.team_id)

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-foreground">قوالب المعالم</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            احفظ قائمة معالم مشروع ناجح، ثم استخدمها في أي مشروع جديد من نفس
            النوع.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="tag-mono text-foreground border border-border rounded-md px-3 py-1.5 hover:bg-muted transition-colors"
        >
          إنشاء مشروع من قالب
        </Link>
      </header>

      {templates.length === 0 ? (
        <div className="card-paper p-8 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            لم تنشئ قوالب بعد.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            من صفحة أي مشروع، اضغط &quot;حفظ كقالب&quot; لحفظ معالمه كقالب
            قابل لإعادة الاستخدام.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id} className="card-paper p-5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg text-foreground">
                  {t.name}
                </h3>
                <span className="tag-mono text-muted-foreground num-latin shrink-0">
                  {t.milestone_count} معلم
                </span>
              </div>
              {t.description ? (
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {t.description}
                </p>
              ) : null}
              <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                <span className="tag-mono text-muted-foreground num-latin">
                  {new Date(t.created_at).toLocaleDateString("ar")}
                </span>
                <form action={deleteTemplateAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="tag-mono text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`حذف ${t.name}`}
                  >
                    حذف
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
