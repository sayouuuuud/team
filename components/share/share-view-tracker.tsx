"use client"

import { useEffect, useRef } from "react"

export function ShareViewTracker({ token }: { token: string }) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    // Fire-and-forget. Errors are swallowed inside the route.
    void fetch(`/api/share/${encodeURIComponent(token)}/view`, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {})
  }, [token])

  return null
}
