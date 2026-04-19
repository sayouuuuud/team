import Link from "next/link"
import { requireProjectAccess } from "@/lib/auth/project-access"
import { getDocPagesByProject, type DocPageRow } from "@/lib/data/collab"
import { DocPageCreateForm } from "@/components/projects/docs-create-form"

export const dynamic = "force-dynamic"

type Node = DocPageRow & { children: Node[] }

function buildTree(pages: DocPageRow[]): Node[] {
  const byId = new Map<string, Node>()
  pages.forEach((p) => byId.set(p.id, { ...p, children: [] }))
  const roots: Node[] = []
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function TreeItem({ node, projectId }: { node: Node; projectId: string }) {
  return (
    <li>
      <Link
        href={`/projects/${projectId}/docs/${node.id}`}
        className="block rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm text-foreground">{node.title}</span>
      </Link>
      {node.children.length > 0 ? (
        <ul className="border-s mt-1 ms-3 ps-3" style={{ borderColor: "var(--border)" }}>
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} projectId={projectId} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default async function DocsIndexPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  await requireProjectAccess(id)
  const pages = await getDocPagesByProject(id)
  const tree = buildTree(pages)

  return (
    <section className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="eyebrow">Documentation</div>
            <h2 className="text-lg text-foreground mt-1">صفحات الدوكيومنتيشن</h2>
          </div>
        </div>

        <div className="card-paper p-6">
          {tree.length === 0 ? (
            <div className="py-16 text-center">
              <p className="tag-mono text-muted-foreground">
                لا توجد صفحات بعد. أضف أول صفحة من الجنب ←
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {tree.map((n) => (
                <TreeItem key={n.id} node={n} projectId={id} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside>
        <div className="card-paper p-5">
          <div className="eyebrow mb-3">إنشاء صفحة</div>
          <DocPageCreateForm projectId={id} pages={pages} />
        </div>
      </aside>
    </section>
  )
}
