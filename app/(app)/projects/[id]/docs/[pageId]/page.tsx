import Link from "next/link"
import { notFound } from "next/navigation"
import { requireProjectAccess } from "@/lib/auth/project-access"
import { getDocPage } from "@/lib/data/collab"
import { DocPageEditor } from "@/components/projects/doc-page-editor"

export const dynamic = "force-dynamic"

export default async function DocPageView(props: {
  params: Promise<{ id: string; pageId: string }>
}) {
  const { id, pageId } = await props.params
  const { isLead } = await requireProjectAccess(id)
  const page = await getDocPage(pageId)
  if (!page || page.project_id !== id) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/projects/${id}/docs`}
          className="tag-mono text-muted-foreground hover:text-foreground"
        >
          ← كل الصفحات
        </Link>
      </div>
      <DocPageEditor projectId={id} page={page} canDelete={isLead} />
    </div>
  )
}
