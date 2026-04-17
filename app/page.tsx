import Link from "next/link"
import { getCurrentUser } from "@/lib/auth/helpers"
import { createServiceClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function LandingPage() {
  const me = await getCurrentUser()

  const service = createServiceClient()
  const { data: settings } = await service
    .from("site_settings")
    .select("site_name, signups_open")
    .eq("id", 1)
    .maybeSingle()

  const siteName = settings?.site_name ?? "Team Platform"
  const signupsOpen = settings?.signups_open ?? true

  return (
    <div className="min-h-screen paper-bg">
      {/* Nav */}
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10 h-16 flex items-center justify-between">
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
              {siteName}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="tag-mono text-muted-foreground hover:text-foreground transition">
              Features
            </a>
            <a href="#roles" className="tag-mono text-muted-foreground hover:text-foreground transition">
              Roles
            </a>
            <a href="#workflow" className="tag-mono text-muted-foreground hover:text-foreground transition">
              Workflow
            </a>
            <Link href="/testing" className="tag-mono text-muted-foreground hover:text-foreground transition">
              ITQ Testing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {me ? (
              <Link
                href="/dashboard"
                className="h-9 px-4 rounded-md text-sm font-medium flex items-center"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                الدخول للّوحة
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="tag-mono text-muted-foreground hover:text-foreground transition hidden sm:inline"
                >
                  تسجيل دخول
                </Link>
                {signupsOpen ? (
                  <Link
                    href="/signup"
                    className="h-9 px-4 rounded-md text-sm font-medium flex items-center"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                    }}
                  >
                    ابدأ فريقك
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1320px] px-6 lg:px-10 pt-16 lg:pt-24 pb-20 lg:pb-28">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-end">
          <div className="lg:col-span-8 rise-in">
            <div className="flex items-center gap-3 mb-6">
              <span className="eyebrow" style={{ color: "var(--gold)" }}>
                Internal · Team Platform
              </span>
              <span className="hairline w-16" />
              <span className="tag-mono text-muted-foreground num-latin">
                Vol. 01
              </span>
            </div>
            <h1 className="display-hero text-5xl sm:text-6xl lg:text-[6.5rem] text-foreground text-balance">
              منصة واحدة <br />
              <span className="text-gradient-emerald">لإدارة مشاريع</span>
              <br />
              فريقك بالكامل.
            </h1>
            <div className="gold-rule w-24 mt-10" />
          </div>

          <div className="lg:col-span-4 rise-in" style={{ animationDelay: "120ms" }}>
            <p className="text-muted-foreground leading-relaxed text-lg text-pretty">
              مشاريع، milestones، ملفات، توثيق، وتعاون مباشر مع العميل عبر رابط
              مشاركة واحد — بدون حسابات للعملاء.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              {me ? (
                <Link
                  href="/dashboard"
                  className="h-11 px-5 rounded-md font-medium text-[0.95rem] flex items-center"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  فتح لوحتي
                </Link>
              ) : (
                <>
                  {signupsOpen ? (
                    <Link
                      href="/signup"
                      className="h-11 px-5 rounded-md font-medium text-[0.95rem] flex items-center"
                      style={{
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      أنشئ فريق جديد
                    </Link>
                  ) : null}
                  <Link
                    href="/login"
                    className="h-11 px-5 rounded-md border border-border bg-card font-medium text-[0.95rem] text-foreground flex items-center hover:border-border-strong transition"
                  >
                    تسجيل الدخول
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Live strip */}
        <div
          className="mt-16 lg:mt-24 card-paper p-6 lg:p-8 flex flex-wrap items-center gap-6 lg:gap-10"
        >
          <StatBlock number="07" label="Project Tabs" />
          <span className="hairline flex-1 min-w-10" />
          <StatBlock number="22" label="Core Tables" />
          <span className="hairline flex-1 min-w-10" />
          <StatBlock number="03" label="Admin Roles" />
          <span className="hairline flex-1 min-w-10" />
          <StatBlock number="01" label="Client Link" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-[1320px] px-6 lg:px-10 pb-24">
        <div className="flex items-center gap-4 mb-10">
          <span className="eyebrow">Features</span>
          <span className="flex-1 hairline" />
          <span className="tag-mono text-muted-foreground num-latin">
            Phase One ready · More in Phase 2+
          </span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            num="01"
            title="مشاريع متعددة التبويبات"
            desc="Overview · Milestones · Timeline · Docs · Goals · Changelog · Resources — كل حاجة في مكانها."
          />
          <FeatureCard
            num="02"
            title="Milestones + Checklists"
            desc="تقسم المشروع لمراحل واضحة، توزعها على الأعضاء، وتراقب التقدم بشريط إنجاز حي."
          />
          <FeatureCard
            num="03"
            title="ملفات مع إبقاء آخر 5 نسخ"
            desc="رفع .zip مباشرة لـ Vercel Blob، النسخ القديمة تنظف تلقائياً عند الحد الـ 6."
          />
          <FeatureCard
            num="04"
            title="مشاركة العميل بلينك"
            desc="لينك واحد بتوكن 64 حرف. العميل يشوف التقدم، ينزل الملفات، يعلق — بدون حساب."
          />
          <FeatureCard
            num="05"
            title="Realtime + Audit Log"
            desc="كل تحديث يبث فوراً لكل الفريق، وكل خطوة تتسجل في سجل تدقيق كامل."
          />
          <FeatureCard
            num="06"
            title="AI Assistant"
            desc="توليد milestones من brief، مسودات changelog تلقائية، وتقدير حالة المشروع."
            soon
          />
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="bg-card border-y border-border">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10 py-20 lg:py-28">
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <span className="eyebrow" style={{ color: "var(--gold)" }}>
                Roles
              </span>
              <h2 className="display-hero text-4xl lg:text-5xl mt-4 text-foreground text-balance">
                ثلاثة أدوار. <br />
                صلاحيات واضحة.
              </h2>
              <div className="gold-rule w-16 mt-6" />
              <p className="text-muted-foreground leading-relaxed mt-8 max-w-md text-pretty">
                كل دور له واجهته وصلاحياته. لا خلط بين المستويات، ولا تسجيل
                عشوائي — فقط أعضاء الفريق المعتمدون.
              </p>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <RoleRow
                index="01"
                name="Site Admin"
                arabic="مدير المنصة"
                desc="صاحب المنصة. يدير الإعدادات العامة، يراقب كل الفرق، ويصنع حساب الأدمن يدوياً."
              />
              <RoleRow
                index="02"
                name="Team Lead"
                arabic="قائد الفريق"
                desc="ينشئ المشاريع، يدعو أعضاء، يدير milestones، ويولد لينكات مشاركة للعملاء."
              />
              <RoleRow
                index="03"
                name="Member"
                arabic="عضو الفريق"
                desc="ينفذ المهام المسندة له، يرفع ملفات، ويشارك في توثيق المشروع."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="mx-auto max-w-[1320px] px-6 lg:px-10 py-20 lg:py-28">
        <div className="flex items-center gap-4 mb-10">
          <span className="eyebrow">Workflow</span>
          <span className="flex-1 hairline" />
        </div>

        <div className="grid md:grid-cols-4 gap-5">
          <StepCard
            step="01"
            title="أنشئ فريق"
            desc="سجل كقائد فريق، واحصل على كود فريق فريد."
          />
          <StepCard
            step="02"
            title="ادع أعضاء"
            desc="عبر كود الفريق أو لينك دعوة مباشر."
          />
          <StepCard
            step="03"
            title="ابدأ مشروع"
            desc="Milestones، ملفات، توثيق، وتايم لاين."
          />
          <StepCard
            step="04"
            title="شارك العميل"
            desc="لينك واحد آمن، قابل للإبطال في أي وقت."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1320px] px-6 lg:px-10 pb-24">
        <div
          className="card-paper p-10 lg:p-14"
          style={{
            background: "linear-gradient(135deg, var(--card), color-mix(in oklch, var(--primary) 4%, var(--card)))",
          }}
        >
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8">
              <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
                Ready
              </div>
              <h2 className="display-hero text-4xl lg:text-5xl text-foreground text-balance">
                جاهز تبدأ فريقك؟
              </h2>
              <p className="text-muted-foreground leading-relaxed mt-4 max-w-xl text-pretty">
                إنشاء الحساب مجاني، والتفعيل عبر إيميل. بعد التأكيد، تولد لوحة
                فريقك في ثواني.
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-wrap items-center gap-3 lg:justify-end">
              {me ? (
                <Link
                  href="/dashboard"
                  className="h-11 px-5 rounded-md font-medium text-[0.95rem] flex items-center"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  فتح لوحتي
                </Link>
              ) : (
                <>
                  {signupsOpen ? (
                    <Link
                      href="/signup"
                      className="h-11 px-5 rounded-md font-medium text-[0.95rem] flex items-center"
                      style={{
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      أنشئ حساب
                    </Link>
                  ) : null}
                  <Link
                    href="/login"
                    className="h-11 px-5 rounded-md border border-border bg-card font-medium text-[0.95rem] text-foreground flex items-center hover:border-border-strong transition"
                  >
                    تسجيل دخول
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10 py-12 lg:py-14">
          <div className="gold-rule w-16 mb-8" />
          <div className="grid md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-6">
              <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
                Colophon
              </div>
              <h3 className="font-display text-2xl lg:text-3xl text-foreground leading-tight text-balance">
                منصة داخلية — مش SaaS. مُصممة لفريق واحد فقط.
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3 max-w-md">
                الوصول عبر دعوة فقط. العملاء بدون حسابات. كل شيء محمي بطبقة
                RLS على مستوى القاعدة.
              </p>
            </div>
            <div className="md:col-span-3">
              <div className="eyebrow mb-3">Links</div>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/login" className="text-muted-foreground hover:text-foreground transition">
                    تسجيل دخول
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="text-muted-foreground hover:text-foreground transition">
                    إنشاء حساب
                  </Link>
                </li>
                <li>
                  <Link href="/testing" className="text-muted-foreground hover:text-foreground transition">
                    ITQ Testing Checklist
                  </Link>
                </li>
              </ul>
            </div>
            <div className="md:col-span-3">
              <div className="eyebrow mb-3">Issue</div>
              <p className="font-display text-2xl text-foreground">Vol. 01</p>
              <p className="tag-mono text-muted-foreground mt-1">Phase One — 001</p>
              <p className="tag-mono text-muted-foreground mt-6 num-latin">
                © {new Date().getFullYear()} {siteName}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Subcomponents ───────────────────────────────────────────

function StatBlock({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="display-number text-4xl lg:text-5xl text-foreground num-latin">
        {number}
      </span>
      <span className="tag-mono text-muted-foreground mt-1">{label}</span>
    </div>
  )
}

function FeatureCard({
  num,
  title,
  desc,
  soon,
}: {
  num: string
  title: string
  desc: string
  soon?: boolean
}) {
  return (
    <article className="card-paper p-6 lg:p-7 flex flex-col gap-4 h-full">
      <div className="flex items-start justify-between">
        <span className="tag-mono text-muted-foreground num-latin">{num}</span>
        {soon ? (
          <span className="tag-mono" style={{ color: "var(--gold)" }}>
            Soon
          </span>
        ) : (
          <span
            className="size-2 rounded-full mt-1.5"
            style={{ background: "var(--status-pass)" }}
          />
        )}
      </div>
      <h3 className="font-display text-2xl text-foreground text-balance leading-tight">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
        {desc}
      </p>
    </article>
  )
}

function RoleRow({
  index,
  name,
  arabic,
  desc,
}: {
  index: string
  name: string
  arabic: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-5 lg:gap-8 py-5 border-t border-border first:border-t-0">
      <span className="display-number text-3xl text-muted-foreground num-latin pt-1 shrink-0 w-12">
        {index}
      </span>
      <div className="flex-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-display text-2xl text-foreground">{arabic}</span>
          <span className="tag-mono text-muted-foreground">{name}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2 text-pretty">
          {desc}
        </p>
      </div>
    </div>
  )
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <article className="flex flex-col gap-3 relative">
      <span
        className="display-number text-5xl num-latin"
        style={{ color: "color-mix(in oklch, var(--primary) 80%, transparent)" }}
      >
        {step}
      </span>
      <h3 className="font-display text-xl text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
        {desc}
      </p>
    </article>
  )
}
