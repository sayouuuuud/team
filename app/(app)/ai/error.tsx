"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function AiError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] ai segment error:", error)
  }, [error])

  const msg = error.message || ""
  const isRateLimit = /quota|limit|rate/i.test(msg)
  const isAuth = /unauthor|forbidden|access/i.test(msg)

  return (
    <div className="rise-in max-w-xl">
      <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
        Assistant
      </div>
      <h1 className="display-hero text-3xl text-foreground mb-3">
        {isRateLimit
          ? "تجاوزت الحد المسموح اليوم"
          : isAuth
            ? "لا يمكن الوصول للمساعد"
            : "تعذّر تشغيل المساعد"}
      </h1>
      <div className="gold-rule w-16 mb-6" />
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        {isRateLimit
          ? "استُخدم نصيب الفريق اليومي من المساعد. حاول غداً أو اطلب من المسؤول زيادة الحد."
          : isAuth
            ? "قد تحتاج لصلاحية قائد فريق للوصول للمساعد."
            : "حصل خطأ غير متوقع. حاول مرة أخرى."}
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
