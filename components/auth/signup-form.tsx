"use client"

import { useActionState, useState } from "react"
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

type Mode = "lead" | "member-code"

export function SignupForm({
  inviteToken,
  inviteEmail,
}: {
  inviteToken?: string
  inviteEmail?: string
}) {
  const [mode, setMode] = useState<Mode>("lead")
  const [state, action] = useActionState<ActionState, FormData>(signupAction, null)
  const isInvite = Boolean(inviteToken)

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
      {isInvite ? (
        <input type="hidden" name="mode" value="invite" />
      ) : (
        <input type="hidden" name="mode" value={mode} />
      )}
      {inviteToken ? (
        <input type="hidden" name="invite_token" value={inviteToken} />
      ) : null}

      {!isInvite ? (
        <div
          className="grid grid-cols-2 rounded-md border border-border p-1 bg-secondary text-sm"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            onClick={() => setMode("lead")}
            className="h-9 rounded transition"
            style={
              mode === "lead"
                ? {
                    background: "var(--card)",
                    color: "var(--foreground)",
                    boxShadow: "0 1px 0 color-mix(in oklch, var(--foreground) 6%, transparent)",
                  }
                : { color: "var(--muted-foreground)" }
            }
          >
            قائد فريق
          </button>
          <button
            type="button"
            role="tab"
            onClick={() => setMode("member-code")}
            className="h-9 rounded transition"
            style={
              mode === "member-code"
                ? {
                    background: "var(--card)",
                    color: "var(--foreground)",
                    boxShadow: "0 1px 0 color-mix(in oklch, var(--foreground) 6%, transparent)",
                  }
                : { color: "var(--muted-foreground)" }
            }
          >
            انضمام بكود
          </button>
        </div>
      ) : (
        <div
          className="rounded-md border border-border bg-secondary px-3 py-3 text-sm flex items-center gap-3"
        >
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
      )}

      <div className="space-y-2">
        <label className="tag-mono text-muted-foreground block">
          الاسم الكامل
        </label>
        <input
          name="full_name"
          type="text"
          required
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

      {!isInvite && mode === "lead" ? (
        <div className="space-y-2">
          <label className="tag-mono text-muted-foreground block">
            اسم الفريق
          </label>
          <input
            name="team_name"
            type="text"
            required
            className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition"
            placeholder="Studio X"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            سيتم توليد كود فريق (TEAM-XXXX-XXXX) يمكنك مشاركته مع أعضائك
            لينضموا.
          </p>
        </div>
      ) : null}

      {!isInvite && mode === "member-code" ? (
        <div className="space-y-2">
          <label className="tag-mono text-muted-foreground block">
            كود الفريق
          </label>
          <input
            name="team_code"
            type="text"
            required
            dir="ltr"
            className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition font-mono uppercase tracking-wider"
            placeholder="TEAM-XXXX-XXXX"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            سيراجع القائد طلب انضمامك قبل تفعيله.
          </p>
        </div>
      ) : null}

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

      <p className="text-center text-sm text-muted-foreground">
        عندك حساب بالفعل؟{" "}
        <Link href="/login" className="text-foreground hover:underline">
          سجّل دخول
        </Link>
      </p>
    </form>
  )
}
