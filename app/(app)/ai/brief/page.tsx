import Link from "next/link"
import { checkAIAccess } from "@/lib/ai/guard"
import { getTeamMembers } from "@/lib/data/team"
import { BriefComposer } from "@/components/ai/brief-composer"

export const dynamic = "force-dynamic"

export default async function BriefPage() {
  const gate = await checkAIAccess()

  if (!gate.ok) {
    return (
      <main className="mx-auto max-w-[720px] px-6 lg:px-10 py-16 text-center">
        <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
          Brief → Project
        </div>
        <h1 className="display-hero text-3xl text-foreground">غير متاح</h1>
        <p className="text-muted-foreground leading-relaxed mt-4">{gate.message}</p>
        <Link
          href="/ai"
          className="tag-mono text-muted-foreground hover:text-foreground inline-block mt-6"
        >
          ← العودة للمساعد
        </Link>
      </main>
    )
  }

  const members = await getTeamMembers(gate.teamId)
  const roster = members
    .filter((m) => !m.pending_approval)
    .map((m) => ({
      id: m.id,
      full_name: m.full_name ?? "Member",
    }))

  return (
    <main className="mx-auto max-w-[960px] px-6 lg:px-10 py-10 lg:py-14">
      <header className="mb-10">
        <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
          Brief → Project
        </div>
        <h1 className="display-hero text-3xl lg:text-4xl text-foreground">
          إنشاء مشروع من ملف .md
        </h1>
        <p className="text-muted-foreground leading-relaxed mt-4 max-w-xl text-pretty">
          الصق نص الـ brief (وصف المشروع، الأهداف، أسماء الأعضاء ومهاراتهم).
          المساعد هيقترح milestones و checklist وتوزيع على الأعضاء. هتراجع
          وتعتمد قبل الإنشاء.
        </p>
        <div className="gold-rule w-14 mt-6" />
      </header>

      <BriefComposer roster={roster} />
    </main>
  )
}
