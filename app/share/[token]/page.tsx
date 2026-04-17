import { notFound } from "next/navigation"
import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

type ShareStatus =
  | { kind: "ok"; project: any; team: any; milestones: any[]; files: any[] }
  | { kind: "expired" }
  | { kind: "not_found" }

async function loadShareData(token: string): Promise<ShareStatus> {
  if (!token || token.length < 20) return { kind: "not_found" }

  const admin = createServiceClient()

  const { data: project, error } = await admin
    .from("projects")
    .select(
      "id, team_id, name, description, client_name, status, work_mode, share_expires_at, show_team_to_client, start_date, expected_end_date, created_at",
    )
    .eq("share_token", token)
    .maybeSingle()

  if (error || !project) return { kind: "not_found" }

  if (project.share_expires_at) {
    const exp = new Date(project.share_expires_at).getTime()
    if (exp < Date.now()) return { kind: "expired" }
  }

  const { data: team } = await admin
    .from("teams")
    .select("name")
    .eq("id", project.team_id)
    .maybeSingle()

  const { data: milestones } = await admin
    .from("milestones")
    .select(
      "id, title, description, status, progress, start_date, due_date, needs_client_approval, client_approved_at",
    )
    .eq("project_id", project.id)
    .order("order_index", { ascending: true })

  const { data: files } = await admin
    .from("files")
    .select("id, filename, size_bytes, blob_url, uploaded_at, pinned")
    .eq("project_id", project.id)
    .eq("is_deleted", false)
    .eq("pinned", true)
    .order("uploaded_at", { ascending: false })

  return {
    kind: "ok",
    project,
    team,
    milestones: milestones ?? [],
    files: files ?? [],
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const status = await loadShareData(token)
  if (status.kind !== "ok") {
    return { title: "رابط المشاركة — Team Platform" }
  }
  return {
    title: `${status.project.name} — مشاركة مع العميل`,
    description: "صفحة متابعة المشروع المخصصة للعميل.",
  }
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—"
  try {
    return new Intl.DateTimeFormat("ar", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(d))
  } catch {
    return d
  }
}

function formatBytes(n: number) {
  if (!n) return "0 KB"
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const STATUS_LABELS: Record<string, string> = {
  // project_status
  active: "نشط",
  paused: "متوقف مؤقتاً",
  completed: "مكتمل",
  archived: "مؤرشف",
  // work_mode
  parallel: "عمل متوازٍ",
  assigned: "إسناد فردي",
  mixed: "مختلط",
  // milestone_status
  pending: "قيد الانتظار",
  working: "قيد التنفيذ",
  review: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const status = await loadShareData(token)

  if (status.kind === "not_found") notFound()

  if (status.kind === "expired") {
    return (
      <main className="paper-bg min-h-screen flex items-center justify-center p-6">
        <div className="card-paper max-w-md w-full p-8 text-center">
          <div className="eyebrow mb-3">رابط المشاركة</div>
          <h1 className="font-display text-3xl text-foreground mb-3">
            انتهت صلاحية هذا الرابط
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            يرجى التواصل مع فريق العمل للحصول على رابط محدَّث.
          </p>
        </div>
      </main>
    )
  }

  const { project, team, milestones, files } = status
  const overallProgress =
    milestones.length === 0
      ? 0
      : Math.round(
          milestones.reduce((s, m) => s + (Number(m.progress) || 0), 0) /
            milestones.length,
        )

  return (
    <main className="paper-bg min-h-screen">
      {/* Top brand bar */}
      <header className="border-b border-border bg-background/60 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="tag-mono text-muted-foreground">
              مشاركة مع العميل
            </span>
            <span className="font-display text-lg text-foreground">
              {team?.name ?? "Team Platform"}
            </span>
          </div>
          <Link href="/" className="tag-mono text-muted-foreground hover:text-foreground">
            Team Platform
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col gap-8">
        {/* Project header */}
        <section className="card-paper p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <div className="eyebrow mb-2">المشروع</div>
              <h1 className="font-display text-4xl text-foreground text-balance leading-tight">
                {project.name}
              </h1>
              {project.client_name && (
                <div className="mt-2 text-sm text-muted-foreground">
                  للعميل:{" "}
                  <span className="text-foreground">{project.client_name}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="tag-mono px-3 py-1 rounded-full border border-border bg-background">
                {STATUS_LABELS[project.status] ?? project.status}
              </span>
              <span className="tag-mono text-muted-foreground">
                {STATUS_LABELS[project.work_mode] ?? project.work_mode}
              </span>
            </div>
          </div>

          {project.description && (
            <p className="text-sm text-foreground leading-relaxed mb-6 text-pretty">
              {project.description}
            </p>
          )}

          <div className="gold-rule my-6" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="التقدم الإجمالي" value={`${overallProgress}%`} />
            <Stat label="عدد المراحل" value={String(milestones.length)} />
            <Stat
              label="تاريخ البدء"
              value={formatDate(project.start_date)}
            />
            <Stat
              label="التسليم المتوقع"
              value={formatDate(project.expected_end_date)}
            />
          </div>
        </section>

        {/* Milestones */}
        <section className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-foreground">المراحل</h2>
            <span className="tag-mono text-muted-foreground">
              {milestones.length} مرحلة
            </span>
          </header>

          {milestones.length === 0 ? (
            <div className="card-paper p-8 text-center text-sm text-muted-foreground">
              لا توجد مراحل منشورة بعد.
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {milestones.map((m, i) => (
                <li key={m.id} className="card-paper p-5">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="tag-mono text-muted-foreground shrink-0 mt-1">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-lg text-foreground">
                          {m.title}
                        </h3>
                        {m.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                            {m.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="tag-mono px-2.5 py-1 rounded-full border border-border bg-background shrink-0">
                      {STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground"
                        style={{ width: `${m.progress ?? 0}%` }}
                      />
                    </div>
                    <span className="tag-mono text-muted-foreground min-w-[3ch] text-left">
                      {m.progress ?? 0}%
                    </span>
                  </div>

                  {(m.start_date || m.due_date) && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      {m.start_date && (
                        <span>بدء: {formatDate(m.start_date)}</span>
                      )}
                      {m.due_date && (
                        <span>استحقاق: {formatDate(m.due_date)}</span>
                      )}
                    </div>
                  )}

                  {m.needs_client_approval && (
                    <div className="mt-3 text-xs">
                      {m.client_approved_at ? (
                        <span className="text-foreground">
                          تم اعتماد هذه المرحلة بتاريخ{" "}
                          {formatDate(m.client_approved_at)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          هذه المرحلة تنتظر اعتمادك.
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Pinned files */}
        {files.length > 0 && (
          <section className="flex flex-col gap-4">
            <header className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl text-foreground">
                ملفات مثبّتة
              </h2>
              <span className="tag-mono text-muted-foreground">
                {files.length} ملف
              </span>
            </header>

            <ul className="flex flex-col gap-2">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="card-paper p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-display text-base text-foreground truncate">
                      {f.filename}
                    </div>
                    <div className="tag-mono text-muted-foreground mt-1">
                      {formatBytes(f.size_bytes)} · {formatDate(f.uploaded_at)}
                    </div>
                  </div>
                  <a
                    href={f.blob_url}
                    target="_blank"
                    rel="noreferrer"
                    className="tag-mono px-3 py-1.5 rounded-full border border-border hover:bg-muted shrink-0"
                  >
                    فتح
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center pt-6">
          <p className="text-xs text-muted-foreground">
            صفحة مشاركة آمنة. إذا لم تكن الشخص المقصود بهذا الرابط، يرجى تجاهله.
          </p>
        </footer>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="tag-mono text-muted-foreground">{label}</span>
      <span className="font-display text-xl text-foreground">{value}</span>
    </div>
  )
}
