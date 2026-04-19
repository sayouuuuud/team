"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import {
  createTeamAction,
  joinTeamByCodeAction,
  type ActionState,
} from "@/app/auth/actions"

type Mode = "menu" | "create" | "join"

export function OnboardingPanel({
  fullName,
  email,
}: {
  fullName: string | null
  email: string | null
}) {
  const [mode, setMode] = useState<Mode>("menu")

  if (mode === "create") {
    return <CreateTeamForm onBack={() => setMode("menu")} />
  }
  if (mode === "join") {
    return <JoinTeamForm onBack={() => setMode("menu")} />
  }

  return (
    <div className="grid gap-5 md:grid-cols-3">
      <button
        type="button"
        onClick={() => setMode("create")}
        className="card-paper p-6 text-right flex flex-col gap-3 transition hover:translate-y-[-2px]"
      >
        <div
          className="size-10 rounded-md grid place-items-center shrink-0"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <span className="font-display text-xl leading-none">+</span>
        </div>
        <div>
          <div className="font-display text-xl text-foreground mb-2">
            أنشئ فريق
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            كن قائد الفريق. هنولّد لك كود انضمام تقدر تشاركه مع أعضائك.
          </p>
        </div>
        <span className="tag-mono text-muted-foreground mt-auto">ابدأ →</span>
      </button>

      <button
        type="button"
        onClick={() => setMode("join")}
        className="card-paper p-6 text-right flex flex-col gap-3 transition hover:translate-y-[-2px]"
      >
        <div
          className="size-10 rounded-md grid place-items-center shrink-0"
          style={{
            background: "color-mix(in oklch, var(--gold) 15%, transparent)",
            color: "var(--gold)",
          }}
        >
          <span className="font-display text-xl leading-none">↗</span>
        </div>
        <div>
          <div className="font-display text-xl text-foreground mb-2">
            انضم بكود
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            عندك كود انضمام من قائد فريق؟ ادخله وسيراجع طلبك قبل التفعيل.
          </p>
        </div>
        <span className="tag-mono text-muted-foreground mt-auto">
          استخدم الكود →
        </span>
      </button>

      <Link
        href="/account"
        className="card-paper p-6 text-right flex flex-col gap-3 transition hover:translate-y-[-2px]"
      >
        <div
          className="size-10 rounded-md grid place-items-center shrink-0 border border-border"
          style={{ color: "var(--foreground)" }}
        >
          <span className="font-display text-lg leading-none">@</span>
        </div>
        <div>
          <div className="font-display text-xl text-foreground mb-2">حسابي</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {fullName ?? email ?? "راجع بيانات حسابك"}
            <br />
            <span className="tag-mono num-latin" style={{ direction: "ltr" }}>
              {email ?? ""}
            </span>
          </p>
        </div>
        <span className="tag-mono text-muted-foreground mt-auto">
          الإعدادات →
        </span>
      </Link>
    </div>
  )
}

// ─── Create team ───────────────────────────────────────────────

function CreateSubmit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-md font-medium transition disabled:opacity-60 px-5"
      style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
    >
      {pending ? "جاري الإنشاء..." : "أنشئ الفريق"}
    </button>
  )
}

function CreateTeamForm({ onBack }: { onBack: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(createTeamAction, null)

  return (
    <form action={action} className="card-paper p-6 max-w-xl flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="tag-mono text-muted-foreground hover:text-foreground transition"
        >
          ← رجوع
        </button>
        <span className="flex-1 hairline" />
      </div>

      <div>
        <h2 className="font-display text-2xl text-foreground mb-2">
          أنشئ فريقك
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          هتبقى قائد الفريق. سيتم توليد كود انضمام (TEAM-XXXX-XXXX) تقدر
          تشاركه مع أعضائك.
        </p>
      </div>

      <div className="space-y-2">
        <label className="tag-mono text-muted-foreground block">
          اسم الفريق
        </label>
        <input
          name="team_name"
          type="text"
          required
          maxLength={80}
          className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition"
          placeholder="Studio X"
        />
      </div>

      {state?.error ? <ErrorBox msg={state.error} /> : null}

      <div className="flex items-center gap-3">
        <CreateSubmit />
      </div>
    </form>
  )
}

// ─── Join team ─────────────────────────────────────────────────

function JoinSubmit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-md font-medium transition disabled:opacity-60 px-5"
      style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
    >
      {pending ? "جاري الإرسال..." : "أرسل طلب الانضمام"}
    </button>
  )
}

function JoinTeamForm({ onBack }: { onBack: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(
    joinTeamByCodeAction,
    null,
  )

  return (
    <form action={action} className="card-paper p-6 max-w-xl flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="tag-mono text-muted-foreground hover:text-foreground transition"
        >
          ← رجوع
        </button>
        <span className="flex-1 hairline" />
      </div>

      <div>
        <h2 className="font-display text-2xl text-foreground mb-2">
          انضم لفريق
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          ادخل كود الانضمام اللي حصلت عليه من قائد الفريق. طلبك سيراجعه
          القائد قبل التفعيل.
        </p>
      </div>

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
      </div>

      {state?.error ? <ErrorBox msg={state.error} /> : null}
      {state?.ok ? (
        <div
          className="text-sm rounded-md px-3 py-2 border"
          style={{
            color: "var(--status-pass)",
            borderColor:
              "color-mix(in oklch, var(--status-pass) 35%, transparent)",
            background:
              "color-mix(in oklch, var(--status-pass) 8%, transparent)",
          }}
        >
          {state.info}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <JoinSubmit />
      </div>
    </form>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div
      className="text-sm rounded-md px-3 py-2 border"
      style={{
        color: "var(--destructive)",
        borderColor: "color-mix(in oklch, var(--destructive) 35%, transparent)",
        background: "color-mix(in oklch, var(--destructive) 8%, transparent)",
      }}
    >
      {msg}
    </div>
  )
}
