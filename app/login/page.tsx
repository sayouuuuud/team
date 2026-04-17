import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"

export const dynamic = "force-dynamic"

type SP = Promise<{ next?: string; error?: string }>

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const { next, error } = await searchParams

  return (
    <AuthShell
      eyebrow="Sign in"
      title="أهلاً بعودتك"
      subtitle="ادخل بيانات حسابك للوصول إلى لوحة الفريق ومشاريعك."
    >
      {error === "auth_callback" ? (
        <div
          className="text-sm rounded-md px-3 py-2 border mb-4"
          style={{
            color: "var(--destructive)",
            borderColor: "color-mix(in oklch, var(--destructive) 35%, transparent)",
            background: "color-mix(in oklch, var(--destructive) 8%, transparent)",
          }}
        >
          فشل تأكيد البريد. حاول تسجيل الدخول مباشرة أو أعد إرسال الرابط.
        </div>
      ) : null}

      <LoginForm next={next} />
    </AuthShell>
  )
}
