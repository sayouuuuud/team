import Link from "next/link"

export default function NotFound() {
  return (
    <main className="paper-bg min-h-screen flex items-center justify-center p-6">
      <div className="card-paper max-w-md w-full p-8 text-center flex flex-col items-center gap-5">
        <div className="eyebrow" style={{ color: "var(--gold)" }}>
          404
        </div>
        <h1 className="font-display text-4xl text-foreground text-balance">
          الصفحة غير موجودة
        </h1>
        <div className="gold-rule w-12" />
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          الرابط الذي حاولت الوصول إليه غير صالح أو تم حذف الصفحة.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Link
            href="/dashboard"
            className="tag-mono px-4 py-2 rounded-full border border-foreground bg-foreground text-background hover:opacity-90 transition"
          >
            العودة للرئيسية
          </Link>
          <Link
            href="/projects"
            className="tag-mono px-4 py-2 rounded-full border border-border hover:bg-muted transition"
          >
            المشاريع
          </Link>
        </div>
      </div>
    </main>
  )
}
