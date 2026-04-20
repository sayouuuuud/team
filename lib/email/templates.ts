import "server-only"

/**
 * Minimal, structural email templates.
 *
 * All templates return { subject, html, text } and are ready for `sendEmail`.
 * Styling is intentionally minimal / inline-only: looks OK in Gmail, Outlook,
 * Apple Mail, and plain-text clients. No external CSS, no images.
 *
 * Design polish can be applied later without touching callers.
 */

export type TemplateBrand = {
  teamName: string
  accentColor?: string | null
  logoUrl?: string | null
}

const DEFAULT_ACCENT = "#B89968"

function safeAccent(v?: string | null): string {
  if (!v) return DEFAULT_ACCENT
  return /^#[0-9A-Fa-f]{6}$/.test(v) ? v : DEFAULT_ACCENT
}

function baseLayout({
  brand,
  preheader,
  title,
  bodyHtml,
  cta,
}: {
  brand: TemplateBrand
  preheader: string
  title: string
  bodyHtml: string
  cta?: { label: string; url: string } | null
}): string {
  const accent = safeAccent(brand.accentColor)
  const logo = brand.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${escapeHtml(brand.teamName)}" width="40" height="40" style="border-radius:6px;vertical-align:middle;margin-left:10px;" />`
    : ""
  const ctaHtml = cta
    ? `<p style="margin:24px 0 8px 0;"><a href="${cta.url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;">${escapeHtml(cta.label)}</a></p>`
    : ""

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f4f1;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,Arial,sans-serif;color:#1f1f1f;">
    <span style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f4f1;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e2dc;border-top:3px solid ${accent};border-radius:8px;">
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid #eeeae3;">
                ${logo}<span style="font-size:14px;color:#6b6b6b;">${escapeHtml(brand.teamName)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;">
                <h1 style="margin:0 0 14px 0;font-size:20px;font-weight:700;color:#1f1f1f;">${escapeHtml(title)}</h1>
                <div style="font-size:15px;line-height:1.7;color:#333333;">${bodyHtml}</div>
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #eeeae3;font-size:12px;color:#888888;">
                هذا إشعار تلقائي من منصة ${escapeHtml(brand.teamName)}. يمكنك تعطيل إشعارات البريد من صفحة "حسابي".
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ─── Public templates ────────────────────────────────────────────────────────

export function tplMilestoneSubmitted(input: {
  brand: TemplateBrand
  milestoneTitle: string
  projectName: string
  link: string
}) {
  const subject = `معلم بانتظار المراجعة: ${input.milestoneTitle}`
  const html = baseLayout({
    brand: input.brand,
    preheader: `${input.milestoneTitle} — ${input.projectName}`,
    title: "معلم بانتظار المراجعة",
    bodyHtml: `<p>تم تسليم المعلم <strong>${escapeHtml(input.milestoneTitle)}</strong> في مشروع <strong>${escapeHtml(input.projectName)}</strong> وهو بانتظار مراجعتك.</p>`,
    cta: { label: "مراجعة المعلم", url: input.link },
  })
  const text = `معلم بانتظار المراجعة\n\n${input.milestoneTitle} في ${input.projectName}\n\n${input.link}`
  return { subject, html, text }
}

export function tplMilestoneDecision(input: {
  brand: TemplateBrand
  milestoneTitle: string
  projectName: string
  decision: "approved" | "rejected"
  link: string
}) {
  const isApproved = input.decision === "approved"
  const subject = isApproved
    ? `تم اعتماد معلمك: ${input.milestoneTitle}`
    : `تم رفض معلمك: ${input.milestoneTitle}`
  const html = baseLayout({
    brand: input.brand,
    preheader: `${input.milestoneTitle} — ${input.projectName}`,
    title: subject,
    bodyHtml: `<p>معلم <strong>${escapeHtml(input.milestoneTitle)}</strong> في مشروع <strong>${escapeHtml(input.projectName)}</strong> ${
      isApproved ? "تم اعتماده." : "تم رفضه — يرجى مراجعة ملاحظات الفريق."
    }</p>`,
    cta: { label: "فتح المشروع", url: input.link },
  })
  const text = `${subject}\n\n${input.link}`
  return { subject, html, text }
}

export function tplAnnouncement(input: {
  brand: TemplateBrand
  announcementTitle: string
  projectName: string
  link: string
}) {
  const subject = `إعلان جديد: ${input.announcementTitle}`
  const html = baseLayout({
    brand: input.brand,
    preheader: `${input.announcementTitle} — ${input.projectName}`,
    title: input.announcementTitle,
    bodyHtml: `<p>تم نشر إعلان جديد في مشروع <strong>${escapeHtml(input.projectName)}</strong>.</p>`,
    cta: { label: "قراءة الإعلان", url: input.link },
  })
  return { subject, html, text: `${subject}\n\n${input.link}` }
}

export function tplCommentAdded(input: {
  brand: TemplateBrand
  authorName: string
  milestoneTitle: string
  snippet: string
  link: string
}) {
  const subject = `تعليق جديد من ${input.authorName}: ${input.milestoneTitle}`
  const html = baseLayout({
    brand: input.brand,
    preheader: input.snippet.slice(0, 120),
    title: "تعليق جديد على معلمك",
    bodyHtml: `<p><strong>${escapeHtml(input.authorName)}</strong> علّق على <strong>${escapeHtml(input.milestoneTitle)}</strong>:</p>
      <blockquote style="margin:12px 0;padding:10px 14px;background:#f7f5f1;border-right:3px solid #e5e2dc;color:#333;font-style:italic;">${escapeHtml(input.snippet)}</blockquote>`,
    cta: { label: "عرض التعليق", url: input.link },
  })
  return { subject, html, text: `${subject}\n\n${input.snippet}\n\n${input.link}` }
}

export function tplInvite(input: {
  brand: TemplateBrand
  inviterName: string
  joinUrl: string
}) {
  const subject = `دعوة للانضمام إلى ${input.brand.teamName}`
  const html = baseLayout({
    brand: input.brand,
    preheader: `${input.inviterName} دعاك للانضمام`,
    title: `دعوة للانضمام إلى ${input.brand.teamName}`,
    bodyHtml: `<p><strong>${escapeHtml(input.inviterName)}</strong> دعاك للانضمام إلى فريق <strong>${escapeHtml(input.brand.teamName)}</strong>.</p>`,
    cta: { label: "قبول الدعوة", url: input.joinUrl },
  })
  return { subject, html, text: `${subject}\n\n${input.joinUrl}` }
}

export function tplClientNotification(input: {
  brand: TemplateBrand
  projectName: string
  message: string
  shareUrl: string
}) {
  const subject = `${input.brand.teamName}: ${input.projectName}`
  const html = baseLayout({
    brand: input.brand,
    preheader: input.message.slice(0, 120),
    title: input.message,
    bodyHtml: `<p>هناك تحديث جديد في مشروع <strong>${escapeHtml(input.projectName)}</strong>.</p>`,
    cta: { label: "فتح المشروع", url: input.shareUrl },
  })
  return { subject, html, text: `${input.message}\n\n${input.shareUrl}` }
}
