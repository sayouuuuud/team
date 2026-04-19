import { requireProjectAccess } from "@/lib/auth/project-access"
import { getChangelogByProject } from "@/lib/data/collab"
import { ChangelogPanel } from "@/components/projects/changelog-panel"

export const dynamic = "force-dynamic"

export default async function ChangelogPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const { isLead } = await requireProjectAccess(id)
  const entries = await getChangelogByProject(id)

  return (
    <section>
      <div className="mb-6">
        <div className="eyebrow">Client Changelog</div>
        <h2 className="text-lg text-foreground mt-1">
          تحديثات المشروع للعميل
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          اكتب تحديثات دورية يراها العميل في صفحته. ركز على الإنجازات والخطوات
          القادمة.
        </p>
      </div>
      <ChangelogPanel projectId={id} entries={entries} isLead={isLead} />
    </section>
  )
}
