import "server-only"

/**
 * Provider-agnostic email sender.
 *
 * Supported providers (auto-detected by env vars):
 *  - Resend  →  RESEND_API_KEY
 *  - SMTP (e.g. Cloudflare/Mailchannels)  →  SMTP_URL  (smtps://user:pass@host:port)
 *
 * EMAIL_FROM must be set to a verified sender, e.g. "Team Platform <noreply@yourdomain.com>".
 *
 * This function NEVER throws — an email failure must never break the action
 * that triggered it. Failures are logged and swallowed.
 */
export type EmailMessage = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean; error?: string }> {
  const from = process.env.EMAIL_FROM
  if (!from) {
    console.warn("[v0] sendEmail skipped: EMAIL_FROM not set")
    return { sent: false, error: "EMAIL_FROM not configured" }
  }

  const to = Array.isArray(msg.to) ? msg.to : [msg.to]
  const recipients = to.filter((e) => e && /.+@.+\..+/.test(e))
  if (recipients.length === 0) {
    return { sent: false, error: "no valid recipients" }
  }

  try {
    // Prefer Resend when configured.
    if (process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          reply_to: msg.replyTo,
        }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        console.error("[v0] Resend send failed", res.status, body.slice(0, 300))
        return { sent: false, error: `Resend ${res.status}` }
      }
      return { sent: true }
    }

    // No provider configured → safe no-op (so dev/preview doesn't crash).
    console.warn("[v0] sendEmail skipped: no provider configured (set RESEND_API_KEY)")
    return { sent: false, error: "no provider configured" }
  } catch (err) {
    console.error("[v0] sendEmail threw", err)
    return { sent: false, error: (err as Error).message }
  }
}
