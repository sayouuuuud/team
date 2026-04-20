"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

type Props = {
  events: string[]
  current: {
    event: string
    entity: string
    from: string
    to: string
  }
}

export function AuditFilters({ events, current }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()

  const update = (patch: Partial<Props["current"]>) => {
    const params = new URLSearchParams(sp?.toString() ?? "")
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v == null) params.delete(k)
      else params.set(k, v)
    }
    startTransition(() => {
      router.push(`/team/audit${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  const inputCls =
    "w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"

  const clear = () => {
    startTransition(() => router.push("/team/audit"))
  }

  return (
    <section
      className="card-paper p-4 flex flex-col gap-3 md:flex-row md:items-end md:gap-4"
      aria-busy={pending}
    >
      <label className="flex-1 flex flex-col gap-1">
        <span className="tag-mono text-muted-foreground">الحدث</span>
        <select
          className={inputCls}
          value={current.event}
          onChange={(e) => update({ event: e.target.value })}
        >
          <option value="">الكل</option>
          {events.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>

      <label className="flex-1 flex flex-col gap-1">
        <span className="tag-mono text-muted-foreground">الكائن</span>
        <input
          className={inputCls}
          type="text"
          value={current.entity}
          onChange={(e) => update({ entity: e.target.value })}
          placeholder="milestone / announcement / …"
        />
      </label>

      <label className="flex-1 flex flex-col gap-1">
        <span className="tag-mono text-muted-foreground">من</span>
        <input
          className={inputCls + " num-latin"}
          type="date"
          value={current.from}
          onChange={(e) => update({ from: e.target.value })}
        />
      </label>

      <label className="flex-1 flex flex-col gap-1">
        <span className="tag-mono text-muted-foreground">إلى</span>
        <input
          className={inputCls + " num-latin"}
          type="date"
          value={current.to}
          onChange={(e) => update({ to: e.target.value })}
        />
      </label>

      <button
        type="button"
        onClick={clear}
        className="tag-mono text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-3 py-2"
      >
        إعادة تعيين
      </button>
    </section>
  )
}
