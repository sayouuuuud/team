import { requireProjectAccess } from "@/lib/auth/project-access"
import { getMessagesByProject, getTeamMembersById } from "@/lib/data/collab"
import { ChatPanel } from "@/components/projects/chat-panel"

export const dynamic = "force-dynamic"

export default async function ChatPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const { me, isLead } = await requireProjectAccess(id)
  const [messages, members] = await Promise.all([
    getMessagesByProject(id, 200),
    getTeamMembersById(me.team_id as string),
  ])

  return (
    <section>
      <div className="mb-6">
        <div className="eyebrow">Internal Chat</div>
        <h2 className="text-lg text-foreground mt-1">شات الفريق</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          شات فوري داخلي للمشروع. العميل لا يراه. التحديثات فورية.
        </p>
      </div>
      <ChatPanel
        projectId={id}
        meId={me.id}
        isLead={isLead}
        initialMessages={messages}
        members={members}
      />
    </section>
  )
}
