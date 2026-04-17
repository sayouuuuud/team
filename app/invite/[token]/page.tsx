import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"
import { createServiceClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type Params = Promise<{ token: string }>

export default async function InvitePage({ params }: { params: Params }) {
  const { token } = await params
  const service = createServiceClient()

  const { data: invitation } = await service
    .from("team_invitations")
    .select("id, team_id, email, expires_at, accepted_at, teams(name)")
    .eq("token", token)
    .maybeSingle()

  if (!invitation) {
    return (
      <AuthShell
        eyebrow="Invitation"
        title="رابط الدعوة غير صالح"
        subtitle="تأكد من الرابط أو اطلب من قائد الفريق إعادة إرساله."
      >
        <Link
          href="/login"
          className="inline-block tag-mono text-muted-foreground hover:text-foreground"
        >
          الرجوع لتسجيل الدخول →
        </Link>
      </AuthShell>
    )
  }

  const expired = new Date(invitation.expires_at) < new Date()
  const used = Boolean(invitation.accepted_at)
  const teamName = (invitation.teams as unknown as { name: string } | null)?.name

  if (expired || used) {
    return (
      <AuthShell
        eyebrow="Invitation"
        title={used ? "تم استخدام الدعوة" : "انتهت صلاحية الدعوة"}
        subtitle={
          used
            ? "هذه الدعوة استُخدمت بالفعل. سجّل دخول بحسابك."
            : "هذا الرابط انتهت صلاحيته. اطلب من قائد الفريق رابطاً جديداً."
        }
      >
        <Link
          href={used ? "/login" : "/signup"}
          className="inline-block tag-mono text-muted-foreground hover:text-foreground"
        >
          المتابعة →
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Invitation"
      title={teamName ? `انضم لفريق ${teamName}` : "انضم للفريق"}
      subtitle="أنشئ حسابك وسيتم إضافتك للفريق فور تأكيد البريد."
    >
      <SignupForm
        inviteToken={token}
        inviteEmail={invitation.email ?? undefined}
      />
    </AuthShell>
  )
}
