import Link from "next/link"
import { checkAIAccess } from "@/lib/ai/guard"
import { AIChat } from "@/components/ai/ai-chat"

export const dynamic = "force-dynamic"

export default async function AIPage() {
  const gate = await checkAIAccess()

  if (!gate.ok && gate.reason === "not_lead") {
    return (
      <Gate
        title="AI للقادة فقط"
        message="هذا المساعد متاح لقائد الفريق فقط لتقليل التكلفة والتحكم."
      />
    )
  }
  if (!gate.ok && gate.reason === "site_disabled") {
    return (
      <Gate
        title="AI مُعطّل"
        message="تم تعطيل المساعد الذكي على مستوى المنصة. تواصل مع مدير المنصة."
      />
    )
  }
  if (!gate.ok && gate.reason === "no_team") {
    return (
      <Gate
        title="لا يوجد فريق"
        message="أنشئ فريقاً أولاً من الصفحة الرئيسية."
      />
    )
  }
  if (!gate.ok) {
    return <Gate title="غير متاح" message={gate.message} />
  }

  return (
    <main className="mx-auto max-w-[1080px] px-6 lg:px-10 py-10 lg:py-14">
      <header className="mb-10">
        <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
          AI Co-pilot · Lead only
        </div>
        <h1 className="display-hero text-3xl lg:text-4xl text-foreground">
          المساعد الذكي
        </h1>
        <p className="text-muted-foreground leading-relaxed mt-4 max-w-xl text-pretty">
          اسأله عن حالة الفريق، خلّيه يتوقع تاريخ انتهاء مشروع، يصيغ تحديث
          للعميل، أو يراجع الـ audit log. الحد اليومي للفريق: {gate.dailyLimit}{" "}
          طلب، مُستخدَم اليوم: {gate.usedToday}.
        </p>
        <div className="gold-rule w-14 mt-6" />
      </header>

      <AIChat usedToday={gate.usedToday} dailyLimit={gate.dailyLimit} />

      <section className="mt-10 card-paper p-5">
        <div className="eyebrow mb-3">Tips</div>
        <ul className="text-sm text-muted-foreground leading-relaxed flex flex-col gap-2">
          <li>• "ايه اللي حصل في الفريق الأسبوع اللي فات؟"</li>
          <li>• "توقّع تاريخ انتهاء مشروع …" (الصق id المشروع)</li>
          <li>• "ملخص تغييرات العميل للمشروع … من بداية الشهر"</li>
          <li>• "مين عدّل على milestone X آخر أسبوعين؟"</li>
        </ul>
      </section>

      <div className="mt-8">
        <Link
          href="/ai/brief"
          className="tag-mono text-muted-foreground hover:text-foreground"
        >
          ← إنشاء مشروع من ملف .md
        </Link>
      </div>
    </main>
  )
}

function Gate({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto max-w-[720px] px-6 lg:px-10 py-16 text-center">
      <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
        AI Co-pilot
      </div>
      <h1 className="display-hero text-3xl text-foreground">{title}</h1>
      <p className="text-muted-foreground leading-relaxed mt-4">{message}</p>
    </main>
  )
}
