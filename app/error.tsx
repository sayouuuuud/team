"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] root error boundary:", error)
  }, [error])

  return (
    <main className="paper-bg min-h-screen flex items-center justify-center p-6">
      <div className="card-paper max-w-md w-full p-8 text-center flex flex-col items-center gap-5">
        <div className="eyebrow" style={{ color: "var(--gold)" }}>
          Error
        </div>
        <h1 className="font-display text-3xl text-foreground text-balance">
          حصل خطأ غير متوقع
        </h1>
        <div className="gold-rule w-12" />
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          حدثت مشكلة أثناء تحميل هذه الصفحة. جرّب المحاولة مرة أخرى.
        </p>
        {error.digest ? (
          <p className="tag-mono text-xs text-muted-foreground">
            code: {error.digest}
          </p>
        ) : null}
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="tag-mono px-4 py-2 rounded-full border border-foreground bg-foreground text-background hover:opacity-90 transition"
          >
            حاول مرة أخرى
          </button>
          <Link
            href="/dashboard"
            className="tag-mono px-4 py-2 rounded-full border border-border hover:bg-muted transition"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </main>
  )
}
