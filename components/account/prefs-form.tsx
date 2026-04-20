"use client"

import { useState, useTransition } from "react"
import {
  updateProfileAction,
  updateNotificationPrefsAction,
} from "@/app/(app)/account/actions"

const TIMEZONES = [
  { value: "Africa/Cairo", label: "القاهرة (UTC+2)" },
  { value: "Asia/Riyadh", label: "الرياض (UTC+3)" },
  { value: "Asia/Dubai", label: "دبي (UTC+4)" },
  { value: "Asia/Amman", label: "عمّان (UTC+3)" },
  { value: "Asia/Beirut", label: "بيروت (UTC+3)" },
  { value: "Africa/Casablanca", label: "الدار البيضاء (UTC+1)" },
  { value: "Europe/Istanbul", label: "إسطنبول (UTC+3)" },
  { value: "UTC", label: "UTC" },
]

type Profile = {
  full_name: string | null
  language: string | null
  timezone: string | null
  notify_in_app: boolean
  notify_email: boolean
  notify_mentions: boolean
  notify_assignments: boolean
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({})

  return (
    <form
      className="space-y-5"
      action={(fd) => {
        setMsg({})
        start(async () => {
          const res = await updateProfileAction(fd)
          setMsg(res.error ? { err: res.error } : { ok: res.success })
        })
      }}
    >
      <Field label="الاسم الكامل">
        <input
          name="full_name"
          defaultValue={profile.full_name ?? ""}
          maxLength={120}
          className="input w-full"
        />
      </Field>

      <Field label="اللغة">
        <select
          name="language"
          defaultValue={profile.language ?? "ar"}
          className="input w-full"
        >
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </Field>

      <Field label="المنطقة الزمنية">
        <select
          name="timezone"
          defaultValue={profile.timezone ?? "Africa/Cairo"}
          className="input w-full"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md px-5 text-sm font-medium transition disabled:opacity-50"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          {pending ? "..." : "حفظ"}
        </button>
        {msg.ok ? (
          <span className="tag-mono text-green-700">{msg.ok}</span>
        ) : null}
        {msg.err ? (
          <span className="tag-mono text-destructive">{msg.err}</span>
        ) : null}
      </div>
    </form>
  )
}

export function NotificationPrefsForm({ profile }: { profile: Profile }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({})

  return (
    <form
      className="space-y-4"
      action={(fd) => {
        setMsg({})
        start(async () => {
          const res = await updateNotificationPrefsAction(fd)
          setMsg(res.error ? { err: res.error } : { ok: res.success })
        })
      }}
    >
      <Toggle
        name="notify_in_app"
        defaultChecked={profile.notify_in_app}
        label="إشعارات داخل التطبيق"
        hint="في جرس الإشعارات"
      />
      <Toggle
        name="notify_email"
        defaultChecked={profile.notify_email}
        label="إشعارات بريدية"
        hint="قريباً"
      />
      <Toggle
        name="notify_mentions"
        defaultChecked={profile.notify_mentions}
        label="عند الإشارة إليّ"
      />
      <Toggle
        name="notify_assignments"
        defaultChecked={profile.notify_assignments}
        label="عند تعيين معلم لي"
      />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md px-5 text-sm font-medium transition disabled:opacity-50"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          {pending ? "..." : "حفظ"}
        </button>
        {msg.ok ? (
          <span className="tag-mono text-green-700">{msg.ok}</span>
        ) : null}
        {msg.err ? (
          <span className="tag-mono text-destructive">{msg.err}</span>
        ) : null}
      </div>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="tag-mono text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Toggle({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string
  defaultChecked: boolean
  label: string
  hint?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-border"
      />
      <div>
        <div className="text-sm text-foreground">{label}</div>
        {hint ? (
          <div className="tag-mono text-muted-foreground">{hint}</div>
        ) : null}
      </div>
    </label>
  )
}
