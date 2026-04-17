import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"

export const dynamic = "force-dynamic"

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Create account"
      title="ابدأ فريقك"
      subtitle="أنشئ حساب قائد فريق لتبدأ مشروعك، أو انضم لفريق موجود بكود دعوة."
    >
      <SignupForm />
    </AuthShell>
  )
}
