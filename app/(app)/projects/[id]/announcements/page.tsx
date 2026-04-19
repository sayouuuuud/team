import { requireProjectAccess } from "@/lib/auth/project-access"
import { getAnnouncementsByProject } from "@/lib/data/collab"
import { AnnouncementsPanel } from "@/components/projects/announcements-panel"

export const dynamic = "force-dynamic"

export default async function AnnouncementsPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const { isLead } = await requireProjectAccess(id)
  const items = await getAnnouncementsByProject(id)

  return (
    <section>
      <div className="mb-6">
        <div className="eyebrow">Internal Announcements</div>
        <h2 className="text-lg text-foreground mt-1">إعلانات الفريق</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          إعلانات داخلية للفريق فقط. العميل لا يراها. استخدم الـ Pin لتثبيت
          إعلان مهم في الأعلى.
        </p>
      </div>
      <AnnouncementsPanel projectId={id} items={items} isLead={isLead} />
    </section>
  )
}
