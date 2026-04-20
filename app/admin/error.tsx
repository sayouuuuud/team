"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] admin segment error:", error)
  }, [error])

  return (
    <div className="rise-in max-w-xl">
      <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
        Admin
      </div>
      <h1 className="display-hero text-3xl text-foreground mb-3">
        تعذّر تحميل لوحة المسؤول
      </h1>
      <div className="gold-rule w-16 mb-6" />
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        حصل خطأ في تحميل هذا القسم. إذا تكرّر الخطأ، تحقق من صلاحياتك.
      </p>
      {error.digest ? (
        <p className="tag-mono text-xs text-muted-foreground mb-4">
          code: {error.digest}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="tag-mono px-4 py-2 rounded-full border border-foreground bg-foreground text-background hover:opacity-90 transition"
        >
          المحاولة مرة أخرى
        </button>
        <Link
          href="/dashboard"
          className="tag-mono px-4 py-2 rounded-full border border-border hover:bg-muted transition"
        >
          الرئيسية
        </Link>
      </div>
    </div>
  )
}
