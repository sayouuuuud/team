"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { loginAction, type ActionState } from "@/app/auth/actions"

function SubmitButton({ label }: { label: string }) {
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
      {pending ? "جاري الدخول..." : label}
    </button>
  )
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, null)

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next ?? "/dashboard"} />

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="tag-mono text-muted-foreground block"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="tag-mono text-muted-foreground block"
          >
            Password
          </label>
          <Link
            href="/login/reset"
            className="tag-mono text-muted-foreground hover:text-foreground transition"
          >
            نسيت كلمة المرور؟
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition"
          placeholder="••••••••"
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

      <SubmitButton label="تسجيل الدخول" />

      <p className="text-center text-sm text-muted-foreground">
        ما عندك حساب؟{" "}
        <Link href="/signup" className="text-foreground hover:underline">
          سجّل فريق جديد
        </Link>
      </p>
    </form>
  )
}
