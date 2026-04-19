import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"

export const dynamic = "force-dynamic"

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Create account"
      title="أنشئ حسابك"
      subtitle="حساب واحد يكفي. بعد التسجيل تقدر تنشئ فريقك أو تنضم لفريق موجود بكود."
    >
      <SignupForm />
    </AuthShell>
  )
}
