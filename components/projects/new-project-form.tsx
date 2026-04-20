"use client"

import { useState, useTransition } from "react"
import { createProjectAction } from "@/app/(app)/projects/actions"

type TemplateOption = {
  id: string
  name: string
  milestone_count: number
}

type Props = {
  templates: TemplateOption[]
  initialTemplateId: string
}

export function NewProjectForm({ templates, initialTemplateId }: Props) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [startDate, setStartDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [templateId, setTemplateId] = useState<string>(initialTemplateId)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set("name", name)
    fd.set("description", description)
    fd.set("client_name", clientName)
    fd.set("client_email", clientEmail)
    fd.set("start_date", startDate)
    if (templateId) fd.set("template_id", templateId)
    startTransition(async () => {
      const res = await createProjectAction(fd)
      if (res?.error) setError(res.error)
      // On success the action redirects, so nothing to do here.
    })
  }

  return (
    <form onSubmit={submit} className="card-paper p-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="tag-mono text-muted-foreground">
          اسم المشروع
        </label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          className="h-11 rounded-md border border-border bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="مثال: موقع شركة العميل"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="tag-mono text-muted-foreground">
          الوصف
          <span className="mr-2 text-[10px] text-muted-foreground/70">(اختياري)</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="وصف مختصر لأهداف المشروع."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="client_name" className="tag-mono text-muted-foreground">
            اسم العميل
            <span className="mr-2 text-[10px] text-muted-foreground/70">(اختياري)</span>
          </label>
          <input
            id="client_name"
            name="client_name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            maxLength={200}
            className="h-11 rounded-md border border-border bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="client_email" className="tag-mono text-muted-foreground">
            بريد العميل
            <span className="mr-2 text-[10px] text-muted-foreground/70">(اختياري)</span>
          </label>
          <input
            id="client_email"
            name="client_email"
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className="h-11 rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ direction: "ltr" }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="start_date" className="tag-mono text-muted-foreground">
            تاريخ البدء
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-11 rounded-md border border-border bg-background px-3 num-latin text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="template_id" className="tag-mono text-muted-foreground">
            ابدأ من قالب
            <span className="mr-2 text-[10px] text-muted-foreground/70">(اختياري)</span>
          </label>
          <select
            id="template_id"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— بدون قالب —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.milestone_count} معلم)
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive leading-relaxed">{error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="tag-mono rounded-md px-5 py-2.5 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {pending ? "جاري الإنشاء..." : "إنشاء المشروع"}
        </button>
        <a
          href="/projects"
          className="tag-mono rounded-md border border-border px-5 py-2.5 hover:bg-muted"
        >
          إلغاء
        </a>
      </div>
    </form>
  )
}
