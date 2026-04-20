import "server-only"

/**
 * Vercel Cron sends requests with the `Authorization: Bearer $CRON_SECRET`
 * header. Any other path (manual curl, etc.) must use the same secret.
 *
 * Returns `true` if the request is authorised, `false` otherwise.
 */
export function isAuthorisedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Hard-fail in production rather than silently allowing unauthenticated cron.
    console.error("[v0] CRON_SECRET not configured")
    return false
  }
  const header = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  // Timing-safe comparison when lengths match.
  if (header.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < header.length; i++) {
    mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}
