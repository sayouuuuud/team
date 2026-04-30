import type { TestPhase, ItemStatus } from "@/lib/types"

const STATUS_EMOJI: Record<ItemStatus, string> = {
  pass: "✅",
  fail: "❌",
  blocked: "🚫",
  skip: "⏭️",
  pending: "⏳",
}

const STATUS_LABEL_AR: Record<ItemStatus, string> = {
  pass: "نجاح",
  fail: "فشل",
  blocked: "محجوب",
  skip: "متخطى",
  pending: "معلق",
}

function escapeCell(val: string | null | undefined): string {
  if (!val) return "—"
  // Escape pipe chars inside table cells
  return val.replace(/\|/g, "\\|").replace(/\n/g, " ").trim()
}

export function generateMarkdownReport(phases: TestPhase[]): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const allItems = phases.flatMap((p) => p.sections.flatMap((s) => s.items))
  const total = allItems.length
  const counts: Record<ItemStatus, number> = {
    pass: 0,
    fail: 0,
    blocked: 0,
    skip: 0,
    pending: 0,
  }
  for (const it of allItems) counts[it.status]++
  const done = counts.pass + counts.skip
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const lines: string[] = []

  // ── Title block ──────────────────────────────────────────────
  lines.push("# 📋 تقرير الاختبار — ITQ Testing Journal")
  lines.push("")
  lines.push(`> **تاريخ التصدير:** ${dateStr} — ${timeStr}`)
  lines.push(">")
  lines.push(`> **إجمالي البنود:** ${total} | **مكتمل:** ${done} | **نسبة الإنجاز:** ${pct}%`)
  lines.push("")
  lines.push("---")
  lines.push("")

  // ── Summary table ────────────────────────────────────────────
  lines.push("## ملخص الحالات")
  lines.push("")
  lines.push("| الحالة | العدد | النسبة |")
  lines.push("|--------|-------|--------|")
  for (const [status, count] of Object.entries(counts) as [ItemStatus, number][]) {
    const p = total > 0 ? Math.round((count / total) * 100) : 0
    lines.push(
      `| ${STATUS_EMOJI[status]} ${STATUS_LABEL_AR[status]} | ${count} | ${p}% |`
    )
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // ── Phases ───────────────────────────────────────────────────
  lines.push("## تفاصيل الاختبار")
  lines.push("")

  for (const phase of phases) {
    lines.push(`## 🔷 المرحلة ${phase.order_num}: ${phase.title}`)
    lines.push("")

    if (phase.goal) {
      lines.push(`**الهدف:** ${phase.goal}`)
      lines.push("")
    }

    if (phase.notes) {
      lines.push(`**ملاحظات المرحلة:** ${phase.notes}`)
      lines.push("")
    }

    for (const section of phase.sections) {
      lines.push(`### ${section.section_num} — ${section.title}`)
      lines.push("")

      if (section.notes) {
        lines.push(`> 📝 ${section.notes}`)
        lines.push("")
      }

      if (section.items.length === 0) {
        lines.push("_لا توجد بنود في هذا القسم_")
        lines.push("")
        continue
      }

      // Table header
      lines.push("| الكود | الوصف | الحالة | المختبر | ملاحظات | وصف الخطأ | كود الخطأ |")
      lines.push("|-------|-------|--------|---------|---------|-----------|-----------|")

      for (const item of section.items) {
        const statusCell = `${STATUS_EMOJI[item.status]} ${STATUS_LABEL_AR[item.status]}`
        lines.push(
          [
            "",
            escapeCell(item.code),
            escapeCell(item.description),
            statusCell,
            escapeCell(item.tester_name),
            escapeCell(item.notes),
            escapeCell(item.error_description),
            escapeCell(item.error_code),
            "",
          ].join(" | ")
        )
      }

      lines.push("")
    }

    lines.push("---")
    lines.push("")
  }

  // ── Footer ───────────────────────────────────────────────────
  lines.push(`_تم توليد هذا التقرير تلقائياً بواسطة ITQ Testing Platform — ${dateStr}_`)

  return lines.join("\n")
}

export function downloadMarkdown(content: string, filename?: string): void {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const name = filename ?? `ITQ-Testing-Report-${stamp}.md`

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
