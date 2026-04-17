import type { ProjectRow } from "@/lib/data/projects"

export function ProjectMetaCard({ project }: { project: ProjectRow }) {
  return (
    <div className="card-paper p-5">
      <div className="eyebrow mb-3">Project meta</div>
      <dl className="space-y-3 text-sm">
        <Row label="Client" value={project.client_name ?? "—"} />
        <Row label="Email" value={project.client_email ?? "—"} mono />
        <Row
          label="Start"
          value={
            project.start_date
              ? new Date(project.start_date).toLocaleDateString("ar")
              : "—"
          }
        />
        <Row
          label="Due"
          value={
            project.expected_end_date
              ? new Date(project.expected_end_date).toLocaleDateString("ar")
              : "—"
          }
        />
        <Row
          label="Created"
          value={new Date(project.created_at).toLocaleDateString("ar")}
        />
      </dl>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="tag-mono text-muted-foreground">{label}</dt>
      <dd
        className={
          "truncate max-w-[60%] " +
          (mono ? "font-mono text-xs text-foreground" : "text-foreground")
        }
        style={{ direction: mono ? "ltr" : undefined }}
      >
        {value}
      </dd>
    </div>
  )
}
