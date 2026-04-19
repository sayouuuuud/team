import { requireProjectAccess } from "@/lib/auth/project-access"
import { getNotesByProject, getTeamMembersById } from "@/lib/data/collab"
import { NotesPanel } from "@/components/projects/notes-panel"

export const dynamic = "force-dynamic"

export default async function NotesPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const { me } = await requireProjectAccess(id)
  const [notes, members] = await Promise.all([
    getNotesByProject(id),
    getTeamMembersById(me.team_id as string),
  ])

  return (
    <section>
      <div className="mb-6">
        <div className="eyebrow">Internal Notes</div>
        <h2 className="text-lg text-foreground mt-1">ملاحظات داخلية</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          ملاحظات حرة بين أعضاء الفريق. العميل لا يراها أبداً. كل عضو يقدر يحذف
          ملاحظاته فقط.
        </p>
      </div>
      <NotesPanel
        projectId={id}
        notes={notes}
        meId={me.id}
        members={members}
      />
    </section>
  )
}
