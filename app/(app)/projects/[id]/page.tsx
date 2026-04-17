import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/helpers"
import {
  getProjectById,
  getMilestonesByProject,
  getChecklistByMilestones,
  getFilesByProject,
} from "@/lib/data/projects"
import { MilestonesPanel } from "@/components/projects/milestones-panel"
import { FilesPanel } from "@/components/projects/files-panel"
import { ShareLinkPanel } from "@/components/projects/share-link-panel"
import { ProjectMetaCard } from "@/components/projects/project-meta-card"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  paused: "متوقف",
  completed: "مكتمل",
  archived: "مؤرشف",
}

const STATUS_COLOR: Record<string, string> = {
  active: "var(--status-pass)",
  paused: "var(--status-blocked)",
  completed: "var(--primary)",
  archived: "var(--status-skip)",
}

export default async function ProjectDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const me = await requireUser(`/projects/${id}`)
  if (!me.team_id) redirect("/dashboard")
  if (me.pending_approval) redirect("/dashboard")

  const project = await getProjectById(id)
  if (!project) notFound()
  if (project.team_id !== me.team_id && me.role !== "site_admin") notFound()

  const isLead = me.role === "team_lead"

  const [milestones, files] = await Promise.all([
    getMilestonesByProject(id),
    getFilesByProject(id),
  ])

  const checklistItems = await getChecklistByMilestones(
    milestones.map((m) => m.id),
  )

  const overallProgress =
    milestones.length > 0
      ? Math.round(
          milestones.reduce((acc, m) => acc + (m.progress ?? 0), 0) /
            milestones.length,
        )
      : 0

  return (
    <div className="rise-in">
      <Link
        href="/projects"
        className="tag-mono text-muted-foreground hover:text-foreground"
      >
        ← المشاريع
      </Link>

      <div className="mt-4 mb-10 flex flex-wrap items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <div className="eyebrow" style={{ color: "var(--gold)" }}>
              Project
            </div>
            <span
              className="tag-mono rounded-full px-2.5 py-1"
              style={{
                background: `color-mix(in oklch, ${STATUS_COLOR[project.status]} 12%, transparent)`,
                color: STATUS_COLOR[project.status],
              }}
            >
              {STATUS_LABEL[project.status]}
            </span>
          </div>
          <h1 className="display-hero text-3xl lg:text-4xl text-foreground text-balance">
            {project.name}
          </h1>
          {project.description ? (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {project.description}
            </p>
          ) : null}
          <div className="gold-rule w-16 mt-6" />
        </div>

        <div className="card-paper p-5 min-w-[220px]">
          <div className="eyebrow mb-2">Overall</div>
          <div className="display-number text-foreground text-4xl num-latin">
            {overallProgress}
            <span className="text-xl text-muted-foreground">%</span>
          </div>
          <div className="progress-rail mt-3">
            <div
              className="progress-fill"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="tag-mono text-muted-foreground mt-3 num-latin">
            {milestones.length} milestones · {files.length} files
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-10">
          <MilestonesPanel
            projectId={project.id}
            milestones={milestones}
            checklist={checklistItems}
            isLead={isLead}
          />

          <FilesPanel projectId={project.id} files={files} isLead={isLead} />
        </div>

        <aside className="lg:col-span-1 flex flex-col gap-6">
          <ProjectMetaCard project={project} />
          {isLead ? <ShareLinkPanel project={project} /> : null}
        </aside>
      </div>
    </div>
  )
}
