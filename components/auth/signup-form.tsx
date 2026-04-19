"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { signupAction, type ActionState } from "@/app/auth/actions"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-11 rounded-md font-medium text-[0.95rem] transition disabled:opacity-60"
      style={{
        background: "var(--primary)",
        color: "var(--primary-foreground)",
      }}
    >
      {pending ? "جاري الإنشاء..." : "إنشاء الحساب"}
    </button>
  )
}

export function SignupForm({
  inviteToken,
  inviteEmail,
}: {
  inviteToken?: string
  inviteEmail?: string
}) {
  const [state, action] = useActionState<ActionState, FormData>(signupAction, null)

  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <div
          className="size-12 rounded-full mx-auto grid place-items-center"
          style={{
            background: "var(--status-pass-soft)",
            color: "var(--status-pass)",
          }}
        >
          <span className="font-display text-2xl">✓</span>
        </div>
        <h3 className="font-display text-2xl text-foreground">
          افحص بريدك الإلكتروني
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {state.info ?? "أرسلنا لك رسالة تأكيد. اضغط على الرابط لتفعيل الحساب."}
        </p>
        <Link
          href="/login"
          className="tag-mono text-muted-foreground hover:text-foreground inline-block transition"
        >
          الرجوع لتسجيل الدخول →
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5">
      {inviteToken ? (
        <>
          <input type="hidden" name="invite_token" value={inviteToken} />
          <div className="rounded-md border border-border bg-secondary px-3 py-3 text-sm flex items-center gap-3">
            <span
              className="size-2 rounded-full"
              style={{ background: "var(--gold)" }}
            />
            <div className="flex-1">
              <div className="text-foreground">تم التحقق من الدعوة</div>
              <div className="text-xs text-muted-foreground">
                ستنضم للفريق مباشرة بعد تأكيد البريد.
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <label className="tag-mono text-muted-foreground block">
          الاسم الكامل
        </label>
        <input
          name="full_name"
          type="text"
          required
          maxLength={120}
          className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition"
          placeholder="محمد عبد الله"
        />
      </div>

      <div className="space-y-2">
        <label className="tag-mono text-muted-foreground block">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          defaultValue={inviteEmail}
          readOnly={Boolean(inviteEmail)}
          className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <label className="tag-mono text-muted-foreground block">
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          dir="ltr"
          className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition"
          placeholder="6 أحرف على الأقل"
        />
      </div>

      {state?.error ? (
        <div
          className="text-sm rounded-md px-3 py-2 border"
          style={{
            color: "var(--destructive)",
            borderColor: "color-mix(in oklch, var(--destructive) 35%, transparent)",
            background: "color-mix(in oklch, var(--destructive) 8%, transparent)",
          }}
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />

      <p className="text-center text-xs text-muted-foreground leading-relaxed">
        بعد إنشاء الحساب تقدر تنشئ فريقك أو تنضم لفريق بكود دعوة.
      </p>

      <p className="text-center text-sm text-muted-foreground">
        عندك حساب بالفعل؟{" "}
        <Link href="/login" className="text-foreground hover:underline">
          سجّل دخول
        </Link>
      </p>
    </form>
  )
}
