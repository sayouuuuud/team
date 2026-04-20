import { requireProjectAccess } from "@/lib/auth/project-access"
import { getMilestonesByProject } from "@/lib/data/projects"
import {
  getProjectTimeEntries,
  getProjectTimeSummary,
  getRunningTimerForUser,
} from "@/lib/data/time"
import { TimePanel } from "@/components/projects/time-panel"

export const dynamic = "force-dynamic"

export default async function ProjectTimePage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const { me, isLead } = await requireProjectAccess(id)

  const [milestones, entries, summary, running] = await Promise.all([
    getMilestonesByProject(id),
    getProjectTimeEntries(id),
    getProjectTimeSummary(id),
    getRunningTimerForUser(me.id, id),
  ])

  return (
    <section>
      <div className="mb-6">
        <div className="eyebrow">Time</div>
        <h2 className="text-lg text-foreground mt-1">تتبع الوقت</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          شغّل العداد وأنت بتشتغل، وأوقفه لما تخلص. كل عضو يشوف سجل ساعاته
          وسجلات الفريق في المشروع ده.
        </p>
      </div>

      <TimePanel
        projectId={id}
        currentUserId={me.id}
        isLead={isLead}
        milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
        entries={entries}
        summary={summary}
        running={running}
      />
    </section>
  )
}
