import { requireProjectAccess } from "@/lib/auth/project-access"
import { getResourcesByProject } from "@/lib/data/collab"
import { ResourcesPanel } from "@/components/projects/resources-panel"

export const dynamic = "force-dynamic"

export default async function ResourcesPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const { isLead } = await requireProjectAccess(id)
  const resources = await getResourcesByProject(id)

  return (
    <section>
      <div className="mb-6">
        <div className="eyebrow">Resources</div>
        <h2 className="text-lg text-foreground mt-1">موارد المشروع</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          أصول العلامة، الأدلة، ومعلومات الوصول. العميل يرى الموارد المعلمة
          public فقط.
        </p>
      </div>
      <ResourcesPanel projectId={id} resources={resources} isLead={isLead} />
    </section>
  )
}
