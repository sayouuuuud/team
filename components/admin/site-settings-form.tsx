"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import {
  updateSiteSettingsAction,
  type SettingsState,
} from "@/app/admin/actions"

export type SiteSettingsValues = {
  site_name: string
  signups_open: boolean
  default_team_capacity: number
  default_max_files: number
  max_file_size_mb: number
  invitation_ttl_days: number
  ai_enabled: boolean
  ai_daily_limit_per_team: number
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 px-6 rounded-md font-medium text-[0.95rem] transition disabled:opacity-60"
      style={{
        background: "var(--primary)",
        color: "var(--primary-foreground)",
      }}
    >
      {pending ? "جاري الحفظ..." : "حفظ الإعدادات"}
    </button>
  )
}

export function SiteSettingsForm({ initial }: { initial: SiteSettingsValues }) {
  const [state, action] = useActionState<SettingsState, FormData>(
    updateSiteSettingsAction,
    null,
  )

  return (
    <form action={action} className="space-y-8">
      <Fieldset legend="الهوية">
        <TextField
          name="site_name"
          label="اسم المنصة"
          defaultValue={initial.site_name}
        />
      </Fieldset>

      <Fieldset legend="التسجيل والفرق">
        <ToggleField
          name="signups_open"
          label="التسجيل مفتوح"
          desc="السماح لقادة فرق جدد بإنشاء حسابات."
          defaultChecked={initial.signups_open}
        />
        <NumberField
          name="default_team_capacity"
          label="الحد الأقصى لأعضاء الفريق الواحد"
          defaultValue={initial.default_team_capacity}
          min={1}
          max={500}
        />
        <NumberField
          name="invitation_ttl_days"
          label="صلاحية روابط الدعوة (بالأيام)"
          defaultValue={initial.invitation_ttl_days}
          min={1}
          max={90}
        />
      </Fieldset>

      <Fieldset legend="الملفات">
        <NumberField
          name="default_max_files"
          label="أقصى عدد ملفات محفوظة لكل milestone"
          defaultValue={initial.default_max_files}
          min={1}
          max={50}
        />
        <NumberField
          name="max_file_size_mb"
          label="أقصى حجم للملف (ميجا)"
          defaultValue={initial.max_file_size_mb}
          min={1}
          max={5000}
        />
      </Fieldset>

      <Fieldset legend="الذكاء الاصطناعي">
        <ToggleField
          name="ai_enabled"
          label="تفعيل مساعد AI"
          desc="تفعيل/إيقاف ميزات AI في كل الفرق."
          defaultChecked={initial.ai_enabled}
        />
        <NumberField
          name="ai_daily_limit_per_team"
          label="حد الاستخدام اليومي لكل فريق"
          defaultValue={initial.ai_daily_limit_per_team}
          min={0}
          max={10000}
        />
      </Fieldset>

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
      {state?.ok ? (
        <div
          className="text-sm rounded-md px-3 py-2 border"
          style={{
            color: "var(--status-pass)",
            borderColor: "color-mix(in oklch, var(--status-pass) 40%, transparent)",
            background: "var(--status-pass-soft)",
          }}
        >
          تم حفظ الإعدادات.
        </div>
      ) : null}

      <div className="flex items-center justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  )
}

// ─── Primitives ───────────────────────────────────────────

function Fieldset({
  legend,
  children,
}: {
  legend: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="card-paper p-6 lg:p-7">
      <legend className="eyebrow px-2 -ml-2">{legend}</legend>
      <div className="mt-4 space-y-5">{children}</div>
    </fieldset>
  )
}

function TextField({
  name,
  label,
  defaultValue,
}: {
  name: string
  label: string
  defaultValue?: string
}) {
  return (
    <div className="space-y-2">
      <label className="tag-mono text-muted-foreground block">{label}</label>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition"
      />
    </div>
  )
}

function NumberField({
  name,
  label,
  defaultValue,
  min,
  max,
}: {
  name: string
  label: string
  defaultValue?: number
  min?: number
  max?: number
}) {
  return (
    <div className="space-y-2">
      <label className="tag-mono text-muted-foreground block">{label}</label>
      <input
        name={name}
        type="number"
        dir="ltr"
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="w-full h-11 rounded-md border border-border bg-card px-3 text-foreground outline-none focus:border-primary transition num-latin"
      />
    </div>
  )
}

function ToggleField({
  name,
  label,
  desc,
  defaultChecked,
}: {
  name: string
  label: string
  desc?: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex items-start gap-4 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        className="mt-0.5 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition peer-checked:border-transparent"
        style={{
          background: "var(--secondary)",
        }}
      >
        <span
          className="absolute inline-block size-5 rounded-full bg-card shadow translate-x-0.5 peer-checked:translate-x-[1.35rem] transition"
          style={{
            insetInlineStart: 0,
          }}
        />
        <span
          className="absolute inset-0 rounded-full transition opacity-0 peer-checked:opacity-100"
          style={{ background: "var(--primary)" }}
          aria-hidden
        />
      </span>
      <span className="flex-1 text-sm">
        <span className="block text-foreground">{label}</span>
        {desc ? (
          <span className="block text-muted-foreground leading-relaxed mt-0.5">
            {desc}
          </span>
        ) : null}
      </span>
    </label>
  )
}
