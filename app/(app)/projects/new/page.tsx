import Link from "next/link"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/helpers"
import { getTeamTemplates } from "@/lib/data/templates"
import { NewProjectForm } from "@/components/projects/new-project-form"

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>
}) {
  const me = await requireRole("team_lead", "/projects/new")
  if (!me.team_id) redirect("/dashboard")

  const [templates, sp] = await Promise.all([
    getTeamTemplates(me.team_id),
    searchParams,
  ])

  const preselected = sp.template && templates.some((t) => t.id === sp.template)
    ? sp.template
    : ""

  return (
    <div className="rise-in max-w-2xl">
      <Link href="/projects" className="tag-mono text-muted-foreground hover:text-foreground">
        ← المشاريع
      </Link>
      <div className="mt-4 mb-10">
        <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
          New project
        </div>
        <h1 className="display-hero text-3xl lg:text-4xl text-foreground">
          إنشاء مشروع
        </h1>
        <div className="gold-rule w-16 mt-6" />
      </div>

      <NewProjectForm
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          milestone_count: t.milestone_count,
        }))}
        initialTemplateId={preselected}
      />
    </div>
  )
}
