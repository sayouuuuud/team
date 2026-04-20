"use client"

import { useState, useTransition } from "react"
import {
  generateShareLinkAction,
  revokeShareLinkAction,
} from "@/app/(app)/projects/actions"
import type { ProjectRow } from "@/lib/data/projects"

export function ShareLinkPanel({ project }: { project: ProjectRow }) {
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expires, setExpires] = useState("never")

  const hasLink = Boolean(project.share_token)
  const expired =
    project.share_expires_at &&
    new Date(project.share_expires_at) < new Date()

  const fullLink =
    typeof window !== "undefined" && project.share_token
      ? `${window.location.origin}/share/${project.share_token}`
      : project.share_token
        ? `/share/${project.share_token}`
        : ""

  const generate = () => {
    setError(null)
    const fd = new FormData()
    fd.set("expires", expires)
    startTransition(async () => {
      const r = await generateShareLinkAction(project.id, fd)
      if (r.error) setError(r.error)
    })
  }

  const revoke = () => {
    setError(null)
    if (!confirm("إلغاء رابط المشاركة الحالي؟")) return
    startTransition(async () => {
      const r = await revokeShareLinkAction(project.id)
      if (r.error) setError(r.error)
    })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* noop */
    }
  }

  return (
    <div className="card-paper p-5">
      <div className="eyebrow mb-3">Client share link</div>

      {hasLink && !expired ? (
        <>
          <div
            className="rounded-md p-3 font-mono text-xs text-foreground break-all"
            style={{
              background: "color-mix(in oklch, var(--primary) 8%, var(--card))",
              direction: "ltr",
            }}
          >
            {fullLink}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={copy}
              type="button"
              className="tag-mono rounded-md border border-border px-3 py-1.5 hover:bg-muted"
            >
              {copied ? "copied" : "copy link"}
            </button>
            <button
              onClick={revoke}
              disabled={pending}
              type="button"
              className="tag-mono text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              revoke
            </button>
          </div>
          {project.share_expires_at ? (
            <p className="tag-mono text-muted-foreground mt-3 num-latin">
              expires {new Date(project.share_expires_at).toLocaleDateString("ar")}
            </p>
          ) : (
            <p className="tag-mono text-muted-foreground mt-3">no expiry</p>
          )}

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="tag-mono text-muted-foreground">views</span>
              <span className="font-display text-xl text-foreground num-latin">
                {project.share_views ?? 0}
              </span>
            </div>
            <div className="flex flex-col text-left">
              <span className="tag-mono text-muted-foreground">last opened</span>
              <span className="tag-mono text-foreground num-latin">
                {project.share_last_viewed_at
                  ? new Date(project.share_last_viewed_at).toLocaleDateString(
                      "ar",
                      { dateStyle: "medium" },
                    )
                  : "—"}
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          {expired ? (
            <p className="text-xs text-destructive leading-relaxed mb-3">
              الرابط السابق منتهي الصلاحية. ولّد رابطاً جديداً.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              لا يوجد رابط مشاركة. ولّد رابطاً لعرض حالة المشروع للعميل بدون حساب.
            </p>
          )}
          <label className="flex flex-col gap-1.5 mb-3">
            <span className="tag-mono text-muted-foreground">Expires</span>
            <select
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              <option value="never">بدون انتهاء</option>
              <option value="7">7 أيام</option>
              <option value="30">30 يوماً</option>
              <option value="90">90 يوماً</option>
            </select>
          </label>
          <button
            onClick={generate}
            disabled={pending}
            type="button"
            className="tag-mono rounded-md px-4 py-2 disabled:opacity-50 w-full"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            {pending ? "..." : "توليد رابط"}
          </button>
        </>
      )}

      {error ? (
        <p className="text-xs text-destructive leading-relaxed mt-2">{error}</p>
      ) : null}
    </div>
  )
}
