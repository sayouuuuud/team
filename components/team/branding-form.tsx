"use client"

import { useState, useTransition } from "react"
import { updateTeamBrandingAction } from "@/app/(app)/team/branding-actions"

const DEFAULT_ACCENT = "#B89968"

export function BrandingForm({
  initialLogo,
  initialAccent,
}: {
  initialLogo: string | null
  initialAccent: string | null
}) {
  const [logoUrl, setLogoUrl] = useState(initialLogo ?? "")
  const [accent, setAccent] = useState(initialAccent ?? DEFAULT_ACCENT)
  const [msg, setMsg] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null)
  const [pending, startTransition] = useTransition()

  function submit(fd: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await updateTeamBrandingAction(fd)
      if (r.error) setMsg({ kind: "err", text: r.error })
      else if (r.success) setMsg({ kind: "ok", text: r.success })
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl || "/placeholder.svg"}
            alt="preview"
            className="h-12 w-12 rounded-md object-cover border border-border"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = "none"
            }}
          />
        ) : (
          <div className="h-12 w-12 rounded-md border border-dashed border-border grid place-items-center tag-mono text-muted-foreground">
            —
          </div>
        )}
        <div
          className="h-12 w-12 rounded-md border border-border"
          style={{ background: accent }}
          aria-label="accent preview"
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">رابط الشعار</span>
        <input
          name="logo_url"
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://..."
          maxLength={500}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="tag-mono text-muted-foreground text-xs">
          اتركه فارغاً لحذف الشعار. يظهر فقط على صفحة المشاركة مع العميل.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">لون هوية الفريق</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value.toUpperCase())}
            className="h-10 w-14 rounded-md border border-border bg-background cursor-pointer"
            aria-label="accent color picker"
          />
          <input
            name="accent_color"
            type="text"
            value={accent}
            onChange={(e) => setAccent(e.target.value.toUpperCase())}
            placeholder="#B89968"
            pattern="^#[0-9A-Fa-f]{6}$"
            maxLength={7}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </label>

      {msg ? (
        <div
          className={`tag-mono text-xs rounded-lg px-3 py-2 border ${
            msg.kind === "ok"
              ? "border-border text-foreground"
              : "border-destructive/50 bg-destructive/5 text-destructive"
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="tag-mono px-4 py-2 rounded-full border border-foreground bg-foreground text-background hover:opacity-90 disabled:opacity-50 transition"
        >
          {pending ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>
    </form>
  )
}
