import "server-only"
import { UTApi } from "uploadthing/server"

/**
 * Lazily-initialised UTApi instance. Keep this in a helper so the token env
 * is read once per cold start and both the soft-delete path and the cron
 * prune job share the same client.
 */
let _utapi: UTApi | null = null
function utapi(): UTApi {
  if (!_utapi) {
    _utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN })
  }
  return _utapi
}

/**
 * Delete a single UploadThing file by its storage key.
 * Safe to call with a missing key — resolves to `{ deleted: false }`.
 */
export async function deleteUtKey(key: string | null | undefined): Promise<{
  deleted: boolean
  error?: string
}> {
  if (!key) return { deleted: false }
  try {
    await utapi().deleteFiles(key)
    return { deleted: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[v0] UT deleteFiles failed", key, message)
    return { deleted: false, error: message }
  }
}

/**
 * Batch delete up to ~100 keys at a time — larger calls get chunked.
 * Returns the count of successful deletions.
 */
export async function deleteUtKeys(
  keys: Array<string | null | undefined>,
): Promise<{ total: number; deleted: number }> {
  const clean = keys.filter((k): k is string => typeof k === "string" && k.length > 0)
  if (clean.length === 0) return { total: 0, deleted: 0 }

  let deleted = 0
  const CHUNK = 100
  for (let i = 0; i < clean.length; i += CHUNK) {
    const slice = clean.slice(i, i + CHUNK)
    try {
      await utapi().deleteFiles(slice)
      deleted += slice.length
    } catch (err) {
      console.error(
        "[v0] UT batch delete failed",
        err instanceof Error ? err.message : String(err),
      )
    }
  }
  return { total: clean.length, deleted }
}
