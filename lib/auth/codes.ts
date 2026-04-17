/**
 * Shared helpers for generating team join-codes and invitation tokens.
 * Kept pure so they work both server-side (Node) and in edge runtime.
 */

const TEAM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/1/I/O ambiguity

/**
 * Generate a human-readable team join code in the form `TEAM-XXXX-XXXX`.
 * ~30 bits of entropy — ok for a non-public, revocable code.
 */
export function generateTeamCode(): string {
  const pick = (n: number) => {
    const bytes = new Uint8Array(n)
    crypto.getRandomValues(bytes)
    let out = ""
    for (let i = 0; i < n; i++) {
      out += TEAM_ALPHABET[bytes[i] % TEAM_ALPHABET.length]
    }
    return out
  }
  return `TEAM-${pick(4)}-${pick(4)}`
}

/** Generate a URL-safe random token (default 48 bytes → 64 chars base64url). */
export function generateInviteToken(byteLength = 48): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
