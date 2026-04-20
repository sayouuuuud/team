import { requireProjectAccess } from "@/lib/auth/project-access"
import { getBoardMilestones } from "@/lib/data/board"
import { KanbanBoard } from "@/components/projects/kanban-board"

export const dynamic = "force-dynamic"

export default async function ProjectBoardPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const { isLead } = await requireProjectAccess(id)
  const milestones = await getBoardMilestones(id)

  return (
    <section>
      <div className="mb-6">
        <div className="eyebrow">Board</div>
        <h2 className="text-lg text-foreground mt-1">
          لوحة مراحل المشروع
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          اسحب وأفلت المايلستون بين الأعمدة لتغيير حالته. الترتيب داخل كل عمود
          يتحفظ تلقائياً. عند الإفلات في "Approved" يتم ختم موعد الاعتماد.
        </p>
      </div>

      <KanbanBoard
        projectId={id}
        milestones={milestones}
        canMove={isLead}
      />
    </section>
  )
}
