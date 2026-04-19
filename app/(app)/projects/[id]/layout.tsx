import { requireProjectAccess } from "@/lib/auth/project-access"
import { ProjectTabs } from "@/components/projects/project-tabs"
import Link from "next/link"

export default async function ProjectLayout(props: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const { project } = await requireProjectAccess(id)

  return (
    <div className="rise-in">
      <Link
        href="/projects"
        className="tag-mono text-muted-foreground hover:text-foreground"
      >
        ← المشاريع
      </Link>

      <div className="mt-4 mb-6">
        <div className="eyebrow mb-2" style={{ color: "var(--gold)" }}>
          Project
        </div>
        <h1 className="display-hero text-2xl lg:text-3xl text-foreground text-balance">
          {project.name}
        </h1>
        {project.client_name ? (
          <p className="tag-mono text-muted-foreground mt-2">
            Client · {project.client_name}
          </p>
        ) : null}
      </div>

      <ProjectTabs projectId={id} />

      {props.children}
    </div>
  )
}
