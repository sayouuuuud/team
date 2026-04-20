"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  generateProjectFromBriefAction,
  applyProposalAction,
  type Proposal,
} from "@/app/(app)/ai/brief/actions"

type Roster = { id: string; full_name: string }[]

type EditableMilestone = {
  title: string
  description: string | null
  estimated_days: number
  checklist: string[]
  assignee_user_id: string | null
  assignee_hint: string | null
}

type EditableProposal = {
  project_name: string
  project_description: string | null
  client_name: string | null
  work_mode: "parallel" | "sequential" | "mixed"
  milestones: EditableMilestone[]
}

function bestMatchMemberId(hint: string | null, roster: Roster): string | null {
  if (!hint) return null
  const lc = hint.toLowerCase()
  const exact = roster.find((m) => m.full_name.toLowerCase() === lc)
  if (exact) return exact.id
  const partial = roster.find(
    (m) =>
      m.full_name.toLowerCase().includes(lc) ||
      lc.includes(m.full_name.toLowerCase()),
  )
  return partial?.id ?? null
}

function intoEditable(p: Proposal, roster: Roster): EditableProposal {
  return {
    project_name: p.project_name,
    project_description: p.project_description ?? null,
    client_name: p.client_name ?? null,
    work_mode: p.work_mode,
    milestones: p.milestones.map((m) => ({
      title: m.title,
      description: m.description ?? null,
      estimated_days: m.estimated_days,
      checklist: m.checklist ?? [],
      assignee_hint: m.assignee_hint ?? null,
      assignee_user_id: bestMatchMemberId(m.assignee_hint ?? null, roster),
    })),
  }
}

export function BriefComposer({ roster }: { roster: Roster }) {
  const router = useRouter()
  const [brief, setBrief] = useState("")
  const [proposal, setProposal] = useState<EditableProposal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, startGenerate] = useTransition()
  const [applying, startApply] = useTransition()

  function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startGenerate(async () => {
      const res = await generateProjectFromBriefAction(brief)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setProposal(intoEditable(res.proposal, roster))
    })
  }

  function handleApply() {
    if (!proposal) return
    setError(null)
    startApply(async () => {
      const res = await applyProposalAction({
        project_name: proposal.project_name,
        project_description: proposal.project_description,
        client_name: proposal.client_name,
        work_mode: proposal.work_mode,
        milestones: proposal.milestones.map((m) => ({
          title: m.title,
          description: m.description,
          estimated_days: m.estimated_days,
          checklist: m.checklist.filter((x) => x.trim().length > 0),
          assignee_user_id: m.assignee_user_id,
        })),
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.push(`/projects/${res.projectId}`)
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {!proposal ? (
        <form onSubmit={handleGenerate} className="card-paper p-5 lg:p-6 flex flex-col gap-4">
          <label className="eyebrow" htmlFor="brief">
            Project brief (Markdown)
          </label>
          <textarea
            id="brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={14}
            placeholder="# اسم المشروع&#10;&#10;وصف مختصر، الأعضاء ومهاراتهم، الأهداف، التسليمات المطلوبة…"
            className="w-full px-3 py-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground font-mono leading-relaxed"
          />
          <div className="flex items-center justify-between gap-4">
            <span className="tag-mono text-muted-foreground">
              {brief.trim().length} حرف
            </span>
            <button
              type="submit"
              disabled={generating || brief.trim().length < 40}
              className="tag-mono px-4 py-2 rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-40"
            >
              {generating ? "جاري التوليد…" : "توليد مقترح"}
            </button>
          </div>
        </form>
      ) : (
        <ProposalEditor
          proposal={proposal}
          roster={roster}
          onChange={setProposal}
          onDiscard={() => setProposal(null)}
          onApply={handleApply}
          applying={applying}
        />
      )}

      {error ? (
        <p className="text-sm text-destructive leading-relaxed">{error}</p>
      ) : null}
    </div>
  )
}

function ProposalEditor({
  proposal,
  roster,
  onChange,
  onDiscard,
  onApply,
  applying,
}: {
  proposal: EditableProposal
  roster: Roster
  onChange: (p: EditableProposal) => void
  onDiscard: () => void
  onApply: () => void
  applying: boolean
}) {
  function patch(partial: Partial<EditableProposal>) {
    onChange({ ...proposal, ...partial })
  }
  function patchMilestone(idx: number, partial: Partial<EditableMilestone>) {
    const next = proposal.milestones.map((m, i) =>
      i === idx ? { ...m, ...partial } : m,
    )
    onChange({ ...proposal, milestones: next })
  }
  function removeMilestone(idx: number) {
    onChange({
      ...proposal,
      milestones: proposal.milestones.filter((_, i) => i !== idx),
    })
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="card-paper p-5 lg:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Proposal · مسودة</div>
          <button
            onClick={onDiscard}
            className="tag-mono text-muted-foreground hover:text-foreground"
          >
            إلغاء وإعادة
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم المشروع">
            <input
              value={proposal.project_name}
              onChange={(e) => patch({ project_name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </Field>
          <Field label="اسم العميل (اختياري)">
            <input
              value={proposal.client_name ?? ""}
              onChange={(e) =>
                patch({ client_name: e.target.value || null })
              }
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </Field>
          <Field label="نمط العمل">
            <select
              value={proposal.work_mode}
              onChange={(e) =>
                patch({
                  work_mode: e.target.value as EditableProposal["work_mode"],
                })
              }
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="mixed">Mixed</option>
              <option value="parallel">Parallel</option>
              <option value="sequential">Sequential</option>
            </select>
          </Field>
          <Field label="وصف مختصر">
            <textarea
              value={proposal.project_description ?? ""}
              onChange={(e) =>
                patch({ project_description: e.target.value || null })
              }
              rows={2}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {proposal.milestones.map((m, idx) => (
          <div key={idx} className="card-paper p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="tag-mono text-muted-foreground">
                Milestone {idx + 1}
              </span>
              <button
                onClick={() => removeMilestone(idx)}
                className="tag-mono text-destructive hover:opacity-80"
              >
                حذف
              </button>
            </div>
            <Field label="العنوان">
              <input
                value={m.title}
                onChange={(e) => patchMilestone(idx, { title: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="الوصف">
                <textarea
                  value={m.description ?? ""}
                  onChange={(e) =>
                    patchMilestone(idx, {
                      description: e.target.value || null,
                    })
                  }
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </Field>
              <div className="flex flex-col gap-3">
                <Field label="المدة المقدرة (أيام)">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={m.estimated_days}
                    onChange={(e) =>
                      patchMilestone(idx, {
                        estimated_days: Math.max(
                          1,
                          Math.min(365, Number(e.target.value) || 1),
                        ),
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
                  />
                </Field>
                <Field label="المسؤول">
                  <select
                    value={m.assignee_user_id ?? ""}
                    onChange={(e) =>
                      patchMilestone(idx, {
                        assignee_user_id: e.target.value || null,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="">— (بدون)</option>
                    {roster.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <Field label="Checklist (سطر لكل بند)">
              <textarea
                value={m.checklist.join("\n")}
                onChange={(e) =>
                  patchMilestone(idx, {
                    checklist: e.target.value.split("\n"),
                  })
                }
                rows={Math.max(3, m.checklist.length)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground font-mono"
              />
            </Field>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 card-paper p-4">
        <span className="tag-mono text-muted-foreground">
          {proposal.milestones.length} milestones · سيتم إنشاء المشروع بكل
          المحتوى.
        </span>
        <button
          onClick={onApply}
          disabled={applying || proposal.milestones.length === 0}
          className="tag-mono px-5 py-2 rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-40"
        >
          {applying ? "جاري الإنشاء…" : "إنشاء المشروع"}
        </button>
      </div>
    </section>
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
    <label className="flex flex-col gap-1.5">
      <span className="tag-mono text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
