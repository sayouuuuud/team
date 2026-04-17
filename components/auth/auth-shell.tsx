import Link from "next/link"
import type { ReactNode } from "react"

type Props = {
  eyebrow: string
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ eyebrow, title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-screen paper-bg flex flex-col">
      <header className="mx-auto w-full max-w-[1320px] px-6 lg:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="size-8 rounded-md grid place-items-center"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            <span className="font-display text-lg leading-none">T</span>
          </span>
          <span className="font-display text-lg text-foreground tracking-tight">
            Team Platform
          </span>
        </Link>
        <div className="tag-mono text-muted-foreground num-latin hidden sm:block">
          Vol. 01 · Phase One
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10 lg:py-16">
        <div className="w-full max-w-[460px]">
          <div className="mb-8">
            <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
              {eyebrow}
            </div>
            <h1 className="display-hero text-4xl lg:text-5xl text-foreground text-balance">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-muted-foreground leading-relaxed mt-4 text-pretty">
                {subtitle}
              </p>
            ) : null}
            <div className="gold-rule w-14 mt-6" />
          </div>

          <div className="card-paper p-6 lg:p-8">{children}</div>

          {footer ? (
            <div className="mt-6 text-sm text-muted-foreground text-center">
              {footer}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1320px] px-6 lg:px-10 py-6 flex items-center justify-between border-t border-border">
        <span className="tag-mono text-muted-foreground num-latin">
          © {new Date().getFullYear()} Team Platform
        </span>
        <Link
          href="/testing"
          className="tag-mono text-muted-foreground hover:text-foreground transition"
        >
          ITQ Testing →
        </Link>
      </footer>
    </div>
  )
}
