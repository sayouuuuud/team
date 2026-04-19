"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createResourceAction,
  toggleResourcePublicAction,
  deleteResourceAction,
} from "@/app/(app)/projects/[id]/collab-actions"
import type { ResourceRow, ResourceKind } from "@/lib/data/collab"

const TYPE_LABEL: Record<ResourceKind, string> = {
  brand_asset: "أصل هوية",
  guide: "دليل",
  credential: "بيانات وصول",
  other: "أخرى",
}

export function ResourcesPanel({
  projectId,
  resources,
  isLead,
}: {
  projectId: string
  resources: ResourceRow[]
  isLead: boolean
}) {
  const [showForm, setShowForm] = useState(false)

  const grouped: Record<ResourceKind, ResourceRow[]> = {
    brand_asset: [],
    guide: [],
    credential: [],
    other: [],
  }
  for (const r of resources) grouped[r.type].push(r)

  return (
    <div className="flex flex-col gap-6">
      {isLead ? (
        showForm ? (
          <Create projectId={projectId} onDone={() => setShowForm(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="self-start rounded-md px-4 py-2 text-sm border"
            style={{ borderColor: "var(--border)" }}
          >
            + إضافة مورد
          </button>
        )
      ) : null}

      {resources.length === 0 ? (
        <div className="card-paper p-10 text-center">
          <p className="tag-mono text-muted-foreground">لا توجد موارد بعد.</p>
        </div>
      ) : (
        (Object.keys(grouped) as ResourceKind[])
          .filter((k) => grouped[k].length > 0)
          .map((k) => (
            <section key={k}>
              <h3 className="eyebrow mb-3">{TYPE_LABEL[k]}</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {grouped[k].map((r) => (
                  <Card
                    key={r.id}
                    projectId={projectId}
                    r={r}
                    isLead={isLead}
                  />
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  )
}

function Create({
  projectId,
  onDone,
}: {
  projectId: string
  onDone: () => void
}) {
  const [type, setType] = useState<ResourceKind>("brand_asset")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onSubmit(fd: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        await createResourceAction(fd)
        onDone()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل")
      }
    })
  }

  return (
    <form action={onSubmit} className="card-paper p-5 flex flex-col gap-3">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">النوع</span>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as ResourceKind)}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="brand_asset">أصل هوية (شعار، لون، خط)</option>
          <option value="guide">دليل</option>
          <option value="credential">بيانات وصول</option>
          <option value="other">أخرى</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">العنوان</span>
        <input
          name="title"
          required
          minLength={2}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">
          الرابط (اختياري)
        </span>
        <input
          name="blob_url"
          type="url"
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">
          الوصف / البيانات
        </span>
        <textarea
          name="content"
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      {type !== "credential" ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_public" />
          <span className="tag-mono text-muted-foreground">
            متاح للعميل (public)
          </span>
        </label>
      ) : (
        <p
          className="tag-mono text-xs p-2 rounded"
          style={{
            color: "var(--status-blocked)",
            background: "color-mix(in oklch, var(--status-blocked) 8%, transparent)",
          }}
        >
          بيانات الوصول تبقى داخلية فقط — لا تُعرض للعميل.
        </p>
      )}
      {error ? (
        <p className="tag-mono text-xs" style={{ color: "var(--status-fail)" }}>
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md px-4 py-2 text-sm disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {pending ? "جاري الحفظ..." : "حفظ"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-4 py-2 text-sm border"
          style={{ borderColor: "var(--border)" }}
        >
          إلغاء
        </button>
      </div>
    </form>
  )
}

function Card({
  projectId,
  r,
  isLead,
}: {
  projectId: string
  r: ResourceRow
  isLead: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function togglePublic() {
    const fd = new FormData()
    fd.set("id", r.id)
    fd.set("project_id", projectId)
    fd.set("is_public", String(r.is_public))
    startTransition(async () => {
      try {
        await toggleResourcePublicAction(fd)
        router.refresh()
      } catch {}
    })
  }

  function onDelete() {
    if (!confirm("حذف المورد؟")) return
    const fd = new FormData()
    fd.set("id", r.id)
    fd.set("project_id", projectId)
    startTransition(async () => {
      try {
        await deleteResourceAction(fd)
        router.refresh()
      } catch {}
    })
  }

  const isCredential = r.type === "credential"

  return (
    <li className="card-paper p-4 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm text-foreground font-medium">{r.title}</h4>
          <div className="flex items-center gap-2 mt-1">
            {r.is_public && !isCredential ? (
              <span
                className="tag-mono text-xs rounded-full px-2 py-0.5"
                style={{
                  background: "color-mix(in oklch, var(--status-pass) 12%, transparent)",
                  color: "var(--status-pass)",
                }}
              >
                Public
              </span>
            ) : (
              <span className="tag-mono text-xs text-muted-foreground">
                Internal
              </span>
            )}
          </div>
        </div>
      </div>

      {r.blob_url ? (
        <a
          href={r.blob_url}
          target="_blank"
          rel="noreferrer"
          className="tag-mono text-xs truncate hover:underline"
          style={{ color: "var(--primary)" }}
        >
          {r.blob_url}
        </a>
      ) : null}

      {r.content ? (
        isCredential && !revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="tag-mono text-muted-foreground hover:text-foreground text-xs mt-2 self-start"
          >
            إظهار البيانات
          </button>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-6 mt-2 font-mono">
            {r.content}
          </p>
        )
      ) : null}

      {isLead ? (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          {!isCredential ? (
            <button
              type="button"
              onClick={togglePublic}
              disabled={pending}
              className="tag-mono text-muted-foreground hover:text-foreground text-xs"
            >
              {r.is_public ? "جعله داخلي" : "جعله عام"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="tag-mono hover:opacity-80 text-xs ms-auto"
            style={{ color: "var(--status-fail)" }}
          >
            حذف
          </button>
        </div>
      ) : null}
    </li>
  )
}
