import { requireProjectAccess } from "@/lib/auth/project-access"
import { getGoalsByProject } from "@/lib/data/collab"
import { GoalsPanel } from "@/components/projects/goals-panel"

export const dynamic = "force-dynamic"

export default async function GoalsPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const { isLead } = await requireProjectAccess(id)
  const goals = await getGoalsByProject(id)

  return (
    <section>
      <div className="mb-6">
        <div className="eyebrow">Goals</div>
        <h2 className="text-lg text-foreground mt-1">
          الأهداف الاستراتيجية للمشروع
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          الأهداف يراها العميل في صفحته المشتركة. اكتب نتائج عالية المستوى، ليست
          خطوات تنفيذية (استخدم الـ milestones لذلك).
        </p>
      </div>
      <GoalsPanel projectId={id} goals={goals} isLead={isLead} />
    </section>
  )
}
