# PROJECT SPEC — Team Collaboration & Client Delivery Platform

> **Bilingual Document** — هذا المستند ثنائي اللغة. كل قسم مكتوب بالعربية أولاً ثم بالإنجليزية.
> **Last Updated:** 2026-04-17
> **Status:** Draft v1.0 — جاهز للمراجعة والاعتماد

---

## جدول المحتويات / Table of Contents

1. [نظرة عامة / Overview](#1-نظرة-عامة--overview)
2. [الأدوار والصلاحيات / Roles & Permissions](#2-الأدوار-والصلاحيات--roles--permissions)
3. [المصادقة والدخول / Authentication & Access](#3-المصادقة-والدخول--authentication--access)
4. [هيكل الفريق والمشاريع / Team & Project Structure](#4-هيكل-الفريق-والمشاريع--team--project-structure)
5. [المشروع من الداخل / Inside a Project](#5-المشروع-من-الداخل--inside-a-project)
6. [المهام و Milestones / Tasks & Milestones](#6-المهام-و-milestones--tasks--milestones)
7. [أوضاع العمل / Work Modes](#7-أوضاع-العمل--work-modes)
8. [الملفات والنسخ / Files & Versions](#8-الملفات-والنسخ--files--versions)
9. [تجربة العميل / Client Experience](#9-تجربة-العميل--client-experience)
10. [لوحات التحكم والإشعارات / Dashboards & Notifications](#10-لوحات-التحكم-والإشعارات--dashboards--notifications)
11. [المساعد الذكي / AI Assistant](#11-المساعد-الذكي--ai-assistant)
12. [سجل التدقيق / Audit Log](#12-سجل-التدقيق--audit-log)
13. [التعريب والثيم / Localization & Theming](#13-التعريب-والثيم--localization--theming)
14. [المكدس التقني / Tech Stack](#14-المكدس-التقني--tech-stack)
15. [مخطط قاعدة البيانات / Database Schema](#15-مخطط-قاعدة-البيانات--database-schema)
16. [هيكل الصفحات / Pages & Routes](#16-هيكل-الصفحات--pages--routes)
17. [خطة التنفيذ / Implementation Roadmap](#17-خطة-التنفيذ--implementation-roadmap)
18. [خارج النطاق / Out of Scope](#18-خارج-النطاق--out-of-scope)

---

## 1. نظرة عامة / Overview

### عربي

منصة خاصة للتعاون الداخلي بين فريق صغير (قائد + أعضاء) لإدارة المشاريع ومشاركة التقدم مع العملاء بشكل منظم واحترافي، مع دعم كامل للعربية والإنجليزية، ثيم فاتح/غامق، وتكامل مع مساعد ذكي (AI) يساعد القائد في توزيع المهام وتلخيص العمل.

**المنصة ليست SaaS عام** — هي أداة داخلية للفريق، لا يوجد تسجيل مفتوح للعملاء ولا لفرق أخرى. صفحة الهبوط لأغراض العرض فقط (portfolio/landing).

### English

A private internal platform for a small team (one lead + members) to manage projects and share progress with clients in an organized, professional way. Full Arabic/English support, light/dark theming, and an AI assistant integrated to help the lead distribute tasks and summarize work.

**This is not a public SaaS** — it's an internal tool for one team. No open client/team signups. The landing page is for presentation only.

---

## 2. الأدوار والصلاحيات / Roles & Permissions

### الأدوار الأربعة / The Four Roles

| # | Role | بالعربي | كيف يدخل؟ / How they join |
|---|------|---------|-----------|
| 1 | **Site Admin** (Owner) | أدمن الموقع | تم إنشاؤه يدوياً في قاعدة البيانات (seed) — واحد فقط |
| 2 | **Team Lead** | قائد الفريق | يسجّل بنفسه بإيميل + باسورد، ينشئ الفريق، يحصل على "كود الفريق" |
| 3 | **Member** | عضو في الفريق | يسجّل بإيميل + باسورد ويختار "عضو" ويُدخل كود الفريق، **أو** يُدعى عبر لينك/إيميل من القائد |
| 4 | **Client** | العميل | **ليس له حساب إطلاقاً** — يدخل عبر لينك مشاركة فيه توكن عشوائي طويل |

### جدول الصلاحيات التفصيلي / Detailed Permission Matrix

| العملية / Action | Site Admin | Team Lead | Member | Client |
|---|:-:|:-:|:-:|:-:|
| إدارة إعدادات الموقع العامة (شعار، لغة افتراضية، عدد النسخ) | ✅ | ❌ | ❌ | ❌ |
| رؤية كل الفرق والمستخدمين في المنصة | ✅ | ❌ | ❌ | ❌ |
| إنشاء فريق جديد | ✅ | ✅ (مرة واحدة) | ❌ | ❌ |
| دعوة/إضافة أعضاء للفريق | ✅ | ✅ | ❌ | ❌ |
| إزالة عضو من الفريق | ✅ | ✅ | ❌ | ❌ |
| إنشاء مشروع جديد | ✅ | ✅ | ❌ | ❌ |
| حذف مشروع | ✅ | ✅ | ❌ | ❌ |
| توليد/إبطال لينك المشاركة للعميل | ✅ | ✅ | ❌ | ❌ |
| إنشاء milestone جديد | ✅ | ✅ | ✅* | ❌ |
| تعديل milestone (عنوان/وصف/تواريخ) | ✅ | ✅ | ✅* | ❌ |
| تحديث نسبة الإنجاز / تحديث checklist | ✅ | ✅ | ✅ | ❌ |
| رفع ملفات .zip للمشروع | ✅ | ✅ | ✅ | ❌ |
| كتابة في الدوكيومنتيشن (Wiki) | ✅ | ✅ | ✅ | ❌ |
| كتابة ملاحظات داخلية (Internal Notes) | ✅ | ✅ | ✅ | ❌ |
| نشر إعلان داخل المشروع (للفريق) | ✅ | ✅ | ❌ | ❌ |
| نشر Changelog (للعميل) | ✅ | ✅ | ❌ | ❌ |
| استخدام AI Assistant (الكامل) | ✅ | ✅ | ❌ | ❌ |
| رؤية التقدم العام والتعليقات الخاصة بالمايلستونز | ✅ | ✅ | ✅ | ✅ (قراءة فقط) |
| كتابة تعليق على milestone (يظهر للفريق) | ✅ | ✅ | ✅ | ✅ |
| اعتماد / رفض milestone | ❌ | ❌ | ❌ | ✅ |
| رؤية Internal Chat للأدمنز | ✅ | ✅ | ❌ | ❌ |
| رؤية Audit Log | ✅ | ✅ | ❌ (فقط ما يخصه) | ❌ |

> *Member يقدر ينشئ/يعدل milestone **فقط** لو القائد أذن له (إعداد مستوى المشروع: "Members can create milestones").

---

## 3. المصادقة والدخول / Authentication & Access

### 3.1 الأدمنز (Owner / Lead / Member)

- **المزود:** Supabase Auth (Email + Password)
- **التسجيل الذاتي:** مفتوح فقط للـ Team Lead والـ Member. الـ Site Admin يُنشأ يدوياً.
- **التحقق:** إلزامي عبر إيميل تأكيد (email confirmation)
- **استرجاع كلمة المرور:** عبر إيميل إعادة تعيين (Supabase built-in)
- **الجلسة:** HTTP-only cookies عبر `@supabase/ssr` (الـ middleware/proxy يتعامل معها)
- **تدفق الانضمام للفريق:**
  1. **عبر كود الفريق:** العضو يسجّل بنفسه → يختار دور "Member" → يُدخل كود الفريق (مثلاً `TEAM-8F2A-91X`) → يُضاف للفريق بانتظار موافقة القائد.
  2. **عبر لينك دعوة:** القائد يولد لينك دعوة (`/invite/{token}`) صالح لفترة (مثلاً 7 أيام) → العضو يفتحه → يسجّل أو يسجّل دخول → يُضاف مباشرة.
  3. **عبر إيميل مباشر:** القائد يُدخل إيميل العضو → إذا لم يكن مسجلاً، يُرسل له إيميل دعوة مع لينك تسجيل خاص.

### 3.2 العملاء (Clients)

- **لا حساب.** الوصول فقط عبر لينك مشاركة:
  ```
  https://<domain>/c/{project_id}/{random_token_64_chars}
  ```
- **خصائص اللينك:**
  - توكن عشوائي 64 حرف (crypto-secure).
  - قابل للإبطال في أي وقت من القائد (revoke).
  - قابل للضبط بتاريخ انتهاء اختياري (مثلاً 30 يوم — قابل للتمديد).
  - عند الفتح: يُنشأ session cookie قصير المدى (لتخزين "من هذا الزائر") + يُسجَّل في Audit Log كل زيارة.
- **ما يمكن للعميل عمله:**
  - مشاهدة صفحة المشروع (الـ milestones، التقدم، الملفات، الـ changelog).
  - تنزيل آخر نسخة فقط من كل ملف (مش النسخ القديمة).
  - كتابة تعليق على أي milestone.
  - اعتماد أو رفض milestone (لو الـ milestone معلم بأنه "يحتاج موافقة").
- **ما لا يستطيع العميل عمله:**
  - رؤية الـ Internal Notes.
  - رؤية الـ Internal Chat.
  - رؤية Audit Log.
  - رؤية أسماء الأعضاء المسندة لهم المهام (اختياري — قابل للتفعيل من إعدادات المشروع).

---

## 4. هيكل الفريق والمشاريع / Team & Project Structure

### الهرمية / Hierarchy

```
Site Admin (Owner)
 └── Team (one per Lead)
      ├── Team Lead (1)
      ├── Members (n)
      └── Projects (n)
           ├── Milestones (n)
           │    └── Checklist items + Attachments (.zip files)
           ├── Documentation (wiki pages)
           ├── Goals (objectives)
           ├── Timeline (Gantt view of milestones)
           ├── Announcements (internal, team-only)
           ├── Changelog (public, client-visible)
           ├── Resources (brand, guides, passwords)
           ├── Internal Notes (team-only)
           ├── Internal Chat (admins-only)
           ├── Client Share Link
           └── Audit Log
```

### قواعد العمل / Rules

- **عميل → مشروع:** علاقة 1-إلى-1. كل مشروع لعميل واحد. (كما اتفقنا: "مال العميل بالمشاريع، المشروع بنسخ اللينك وأديه لأي حد يشوف التقدم بطل إفورة")
- **لا يوجد مفهوم "عميل" ككيان مستقل في قاعدة البيانات** — كل ما يُحفظ هو: اسم العميل (نصي)، إيميل اختياري (للإشعارات فقط)، لينك المشاركة.
- **Team Lead يقدر يكون عنده عدة مشاريع نشطة في نفس الوقت.**
- **المشروع له 3 حالات:** `active` / `paused` / `completed` / `archived`.

---

## 5. المشروع من الداخل / Inside a Project

كل مشروع عبارة عن مساحة تحتوي على **7 تبويبات / Tabs**:

### 5.1 Overview (نظرة عامة)
- اسم المشروع + اسم العميل + الحالة.
- نسبة الإنجاز الإجمالية (متوسط نسب الـ milestones).
- شريط زمني مصغر (start date → expected end date).
- آخر 5 نشاطات (من الـ Audit Log).
- بطاقة تلقائية من الـ AI: "On Track / At Risk / Delayed" مع السبب.

### 5.2 Milestones
- قائمة الـ milestones مرتبة بالترتيب.
- عرض Kanban اختياري (To Do / Doing / Review / Done).
- أزرار: "إضافة milestone"، "استيراد من قالب"، "توليد بالـ AI".

### 5.3 Timeline (Gantt)
- عرض بصري لكل الـ milestones على خط زمني.
- Drag لتغيير التواريخ (للأدمنز فقط).
- يعرض الاعتمادات (dependencies) لو في واحد بيعتمد على التاني.

### 5.4 Documentation (الدوكيومنتيشن الداخلي)
- **صفحات Markdown قابلة للتعديل** من أي عضو في الفريق (Notion-like).
- كل صفحة لها:
  - عنوان + محتوى markdown + آخر محرر + وقت التعديل.
  - تسلسل هرمي (صفحات رئيسية + فرعية).
- أمثلة للصفحات: "Project Brief"، "Tech Decisions"، "Meeting Notes"، "API Contract".
- **العميل لا يراها** (خاصة بالفريق).

### 5.5 Goals (الأهداف)
- **مختلفة عن الـ milestones.** الـ Goals هي الأهداف الاستراتيجية، والـ milestones هي خطوات التنفيذ.
- مثال: هدف = "إطلاق الموقع الجديد وزيادة المبيعات 20%". الـ milestones = "تصميم → برمجة → اختبار → إطلاق".
- كل هدف: عنوان + وصف + KPI (اختياري) + نسبة إنجاز (محسوبة من الـ milestones المرتبطة).
- **العميل يراها** (يعرف ليه المشروع ده بيتعمل).

### 5.6 Announcements (الإعلانات الداخلية)
- إعلانات من القائد للفريق **داخل المشروع** (مثلاً: "اجتماع بكرة 5م"، "غيّرنا التصميم الرئيسي").
- مثبّتة في أعلى صفحة المشروع (sticky).
- **العميل لا يراها.**

### 5.7 Changelog (للعميل)
- صفحة منفصلة يكتب فيها القائد تحديثات دورية **للعميل** (مثلاً: "تم الانتهاء من تصميم الهوية، سنبدأ في الموقع الأسبوع القادم").
- مرتبة بالتاريخ (الأحدث أولاً).
- **العميل يراها** في صفحته المشتركة.
- يمكن للـ AI اقتراح مسودة Changelog من الـ Audit Log (انظر القسم 11).

### 5.8 Resources (الموارد)
- مكتبة ثابتة لكل مشروع:
  - **Brand Assets** (شعار، ألوان، خطوط، ملفات هوية).
  - **Guides** (دليل الاستخدام، دليل التشغيل).
  - **Credentials** (كلمات مرور، API keys) — **مشفّرة في DB** ومخفية افتراضياً.
- **العميل يراها** (ما عدا الـ Credentials — إعداد لكل مورد: public/private).

### 5.9 Internal Notes (ملاحظات داخلية)
- ملاحظات حرة للفريق (شخصية العميل، نقاط انتباه، أفكار داخلية).
- **العميل لا يراها أبداً.**

### 5.10 Internal Chat (شات الأدمنز)
- شات فوري (realtime عبر Supabase Realtime) بين القائد والأعضاء.
- مخصص لكل مشروع.
- **العميل والأعضاء من فرق أخرى لا يرونه.** (وفي نسخة مستقبلية يمكن تقييده على Lead + Owner فقط).

---

## 6. المهام و Milestones / Tasks & Milestones

### 6.1 حقول الـ Milestone

| الحقل / Field | النوع / Type | وصف / Description |
|---|---|---|
| `title` | string | العنوان |
| `description` | markdown | وصف تفصيلي |
| `status` | enum | `pending` / `working` / `review` / `approved` / `rejected` |
| `start_date` | date | تاريخ البدء |
| `due_date` | date | تاريخ التسليم المتوقع |
| `progress` | int 0-100 | نسبة الإنجاز اليدوية (مع شريط تقدم) |
| `checklist` | array | مهام فرعية (عنوان + checkbox) |
| `attachments` | array | ملفات .zip متعددة (مع نسخها — انظر القسم 8) |
| `assignees` | array of user_ids | المسؤولون من الفريق (واحد أو أكثر — انظر Work Modes) |
| `needs_client_approval` | bool | هل يحتاج اعتماد من العميل قبل الانتقال للتالي؟ |
| `client_approved_at` | timestamp | وقت موافقة العميل (إن وُجدت) |
| `order` | int | الترتيب في القائمة |

### 6.2 قواعد حسابية

- نسبة الإنجاز الإجمالية للمشروع = متوسط نسبة الإنجاز اليدوية لكل الـ milestones.
- لو في checklist، الـ AI يقترح نسبة إنجاز تلقائية = (المهام المنجزة / إجمالي المهام) × 100، لكن القائد يقدر يعدلها يدوياً.
- **حالة المشروع التلقائية:**
  - `On Track` — التقدم يتماشى مع الوقت المستهلك من المدة.
  - `At Risk` — فات 70%+ من المدة والتقدم أقل من 50%.
  - `Delayed` — تخطى الـ due_date ولم يكتمل.

### 6.3 قوالب Milestones (Templates)

- الأدمن يقدر يحفظ قوالب milestones جاهزة.
- مثال قالب "موقع ويب": Discovery → Design → Development → Testing → Launch.
- عند إنشاء مشروع جديد، يمكن اختيار قالب وتطبيقه بنقرة واحدة.

---

## 7. أوضاع العمل / Work Modes

**⚠️ نقطة مهمة:** كما وضحت، الشغل مش لازم يكون متسلسل أو مقسّم على أشخاص. القائد يقرر.

### 7.1 الأوضاع الثلاثة / Three Modes

لكل milestone (أو لكل المشروع افتراضياً)، القائد يختار واحد من:

| الوضع / Mode | بالعربي | الوصف / Description |
|---|---|---|
| `parallel` | **تعاوني متوازي** | كل أعضاء الفريق يشتغلوا على نفس الـ milestone في نفس الوقت. كلهم Assignees. كلهم يشوفوا ويعدّلوا. (مثل "التيم كله بيشتغل في التيست"). |
| `assigned` | **موزّع** | كل milestone له Assignee واحد (أو أكثر) محدد، ومش ظاهر لباقي الأعضاء في "My Tasks" بتاعهم. |
| `mixed` | **مختلط** | مستوى المشروع: بعض الـ milestones متوازية وبعضها موزّعة. القائد يحدد لكل واحدة. |

### 7.2 "My Tasks" الشخصية

- كل عضو عنده صفحة `/my-tasks` تجمع:
  - **في الوضع Parallel:** كل الـ milestones النشطة في المشاريع اللي هو فيها.
  - **في الوضع Assigned:** فقط الـ milestones المسندة له.
- مرتبة حسب الأولوية + التاريخ.

### 7.3 Kanban Board داخلي

- لكل مشروع، عرض Kanban بصري للمهام الفرعية (checklist items) في الحالة الحالية.
- 4 أعمدة: To Do / Doing / Review / Done.
- Drag & drop لتغيير الحالة.

---

## 8. الملفات والنسخ / Files & Versions

### 8.1 التخزين

- **المزود:** Vercel Blob (للملفات) + Supabase Postgres (للميتاداتا).
- **نوع الملفات:** `.zip` فقط (كما طلبت — مش محتاج تتصفح جواها).
- **الحد الأقصى لحجم الملف:** 500MB (قابل للضبط من إعدادات الموقع).
- **الوصول:** private. الملف لا يُحمّل إلا عبر API محمي بالصلاحيات.

### 8.2 قاعدة الاحتفاظ بالنسخ

**⚠️ اتفقنا:** 5 نسخ لكل حساب (Team). لو بقوا 6، أقدم ملف يتمسح **فعلياً** (من Blob ومن DB).

- **الحساب (Team) = حد أقصى 5 ملفات نشطة في كل الوقت** عبر كل مشاريعه.
- عند رفع الملف السادس، يتم:
  1. البحث عن أقدم ملف في الفريق.
  2. حذفه من Vercel Blob.
  3. حذف صف الميتاداتا من DB (soft delete مع سبب "auto-pruned").
  4. إشعار القائد: "تم حذف `design-v1.zip` تلقائياً لإفساح المساحة."
- **استثناء:** لو الملف معلّم `pinned: true`، لا يُحذف (القائد يقدر يثبّت ملف مهم).

### 8.3 حقول الملف

```sql
file (
  id, team_id, project_id, milestone_id,
  filename, size_bytes, blob_url,
  uploaded_by, uploaded_at,
  pinned (bool), is_deleted (bool),
  deleted_reason enum('auto-pruned','manual','other')
)
```

---

## 9. تجربة العميل / Client Experience

### 9.1 الصفحة المشتركة

عند فتح لينك المشاركة، العميل يرى:

- **هيدر:** شعار الفريق + اسم المشروع + زر تبديل اللغة + زر تبديل الثيم.
- **قسم الترحيب:** "مرحباً {اسم العميل}، إليك تقدم مشروع {اسم المشروع}."
- **شريط التقدم الإجمالي** + حالة المشروع (On Track / At Risk / Delayed) ببادج ملون.
- **Timeline بصرية** للـ milestones.
- **قائمة Milestones** — كل واحد:
  - العنوان + الوصف.
  - نسبة الإنجاز + شريط.
  - تاريخ البدء والتسليم المتوقع.
  - الملفات المرفقة (آخر نسخة قابلة للتنزيل).
  - زر اعتماد/رفض (لو `needs_client_approval = true` والحالة `review`).
  - قسم التعليقات (عامة، مرئية للفريق).
- **Changelog** — قائمة تحديثات مرتبة بالتاريخ.
- **Goals** — الأهداف الاستراتيجية.
- **Resources** — ما تم تحديده كـ public فقط.

### 9.2 الخصوصية

العميل **لا يرى أبداً:**
- Internal Notes.
- Internal Chat.
- Announcements (الإعلانات الداخلية).
- Audit Log.
- النسخ القديمة من الملفات (فقط الأحدث).
- أسماء الأعضاء المسندة (قابل للتفعيل من إعدادات المشروع: "Show team members to client").
- الـ Resources المعلمة private.

### 9.3 الإشعارات للعميل

- **إيميل (اختياري):** لو العميل زوّد إيميل، يستقبل إشعار عند:
  - رفع ملف جديد.
  - اعتماد milestone (تم تسليم الخطوة التالية).
  - نشر Changelog جديد.
  - طلب اعتماد milestone منه.

---

## 10. لوحات التحكم والإشعارات / Dashboards & Notifications

### 10.1 Dashboard الأدمن (Lead)

الصفحة الرئيسية `/dashboard`:

- **4 بطاقات إحصائية:**
  - مشاريع نشطة.
  - مشاريع متأخرة (Delayed).
  - مشاريع منتهية هذا الشهر.
  - تعليقات/مهام تحتاج انتباه (pending review).
- **قائمة المشاريع** مع فلترة (نشط/متوقف/منتهي) وبحث.
- **Feed نشاط** (آخر 20 نشاط من كل الفريق).
- **My Tasks** بطاقة مختصرة.
- **Timeline شامل** (كل المشاريع معاً على Gantt واحد — اختياري).

### 10.2 Dashboard العضو (Member)

- **My Tasks** (القائمة الشخصية من كل المشاريع).
- المشاريع اللي هو فيها.
- Kanban شخصي (مهامه فقط).

### 10.3 Dashboard Site Admin (Owner)

- نظرة عامة على كل الفرق.
- إعدادات الموقع.
- Audit Log الشامل.

### 10.4 الإشعارات (Bell Icon)

- **داخل المنصة فقط** (لا push notifications في v1).
- الأدمنز يستقبلون إشعار عند:
  - تعليق جديد من العميل.
  - اعتماد/رفض milestone من العميل.
  - زيارة العميل للصفحة (أول زيارة لليوم).
  - الـ AI خلّص تحليل أسبوعي.
  - milestone اقترب من الـ due date (قبل 3 أيام).
  - milestone تخطّى الـ due date.
- **الأعضاء يستقبلون إشعار عند:**
  - تسنيد milestone جديد لهم.
  - mention في تعليق داخلي.
  - تعديل milestone مسند لهم.
- **Realtime** عبر Supabase Realtime.

### 10.5 الإشعارات عبر الإيميل (اختياري)

- إعدادات لكل مستخدم: "استقبل ملخص يومي/أسبوعي بالإيميل".
- يُرسل عبر Resend (أو Supabase SMTP).

### 10.6 إعدادات الموقع (Site Admin)

صفحة `/admin/settings`:

- الشعار والاسم التجاري.
- اللغة الافتراضية (ar/en).
- الثيم الافتراضي (light/dark/system).
- عدد النسخ المحفوظة لكل فريق (افتراضي 5، قابل للتغيير).
- الحد الأقصى لحجم الملف.
- مدة صلاحية لينكات الدعوة (افتراضي 7 أيام).
- تفعيل/تعطيل الـ AI Assistant.

---

## 11. المساعد الذكي / AI Assistant

### 11.1 المزود

- **AI SDK by Vercel (v6)** + **Vercel AI Gateway** (zero-config).
- **النموذج الافتراضي:** `anthropic/claude-opus-4.6` للمهام المعقدة، `openai/gpt-5-mini` للملخصات السريعة.

### 11.2 نقاط الوصول / Access

- **الـ AI متاح للقائد فقط** (Team Lead) — الأعضاء مش عندهم صلاحية (لتقليل التكلفة والتحكم).
- **Site Admin** يقدر يعطل الـ AI على مستوى الموقع كله.

### 11.3 المميزات التفصيلية

#### (أ) توليد هيكل المشروع من ملف .md

**كما طلبت حرفياً:** "القائد يرفع ملف .md فيه وصف المشروع + قائمة الأعضاء + مهاراتهم، والـ AI يقترح توزيع المهام."

**التدفق:**
1. القائد يرفع `project-brief.md` (أو يلصق النص مباشرة).
2. الـ AI يحلل المحتوى ويستخرج:
   - عنوان المشروع، وصفه، أهدافه.
   - الـ milestones المقترحة (مع تواريخ تقديرية).
   - checklist لكل milestone.
   - **توزيع الأعضاء** (لو الملف فيه قائمة أعضاء ومهاراتهم):
     - "أحمد — تصميم" → يُسند له milestones التصميم.
     - "محمد — Frontend" → يُسند له milestones البرمجة.
3. النتيجة تظهر للقائد كـ **اقتراح قابل للمراجعة والتعديل والاعتماد** (مش بيطبّق مباشرة).
4. القائد يعدّل ويعتمد → يُنشأ المشروع بالكامل.

#### (ب) أوامر طبيعية لتوزيع المهام

**كما طلبت:** "ادّي 50% من المهام اللي في الفايل للعضو الفلاني."

- واجهة chat داخل صفحة المشروع.
- الـ AI يفهم أوامر مثل:
  - "اسند كل المهام اللي فيها كلمة design لأحمد."
  - "وزّع المهام المتبقية بالتساوي بين محمد وعلي."
  - "خلّي الـ milestones الحرجة بتاعتي أنا، والباقي للفريق."
- يولد **اقتراح + diff** قبل التطبيق.

#### (ج) وضع "التعاوني الكامل"

**كما وضحت:** "التيم كله بيشتغل في التيست — كلنا بنقدر نعدل فيه دلوقتي."

- الـ AI يفهم أمر: "خلي المشروع ده كله parallel، كل الأعضاء assignees على كل milestone."
- يطبق الوضع `parallel` تلقائياً.

#### (د) ملخص أسبوعي تلقائي

- كل يوم أحد 9ص (قابل للضبط)، الـ AI يولد ملخص للقائد:
  - **"هذا الأسبوع:"**
    - "تم إنجاز X من أصل Y مهمة."
    - "أحمد أنجز 8 مهام (الأعلى). محمد أنجز 2 (متأخر عن المتوسط)."
    - "مشروع Z متقدم 12% جديد، مشروع W متأخر."
  - **"الأسبوع القادم:"**
    - "3 milestones تحتاج انتباه."
    - "تاريخ تسليم مشروع Z مقدر: 25 مايو (كان 20 مايو)."
- يُرسل كإشعار + إيميل اختياري.

#### (ه) مراجعة الـ Audit Log

- القائد يقدر يسأل:
  - "إيه أكتر تغيير حصل في المشروع ده الأسبوع اللي فات؟"
  - "مين عدّل على milestone X؟"
  - "كم ساعة شغل سجلها محمد الشهر ده؟"
- الـ AI يجاوب من بيانات الـ Audit Log و Time Tracking.

#### (و) توقع تاريخ الانتهاء

- بناءً على:
  - سرعة إنجاز الـ checklist items تاريخياً.
  - المتبقي من المهام.
  - عدد الأعضاء الفعالين.
- النتيجة: "بالسرعة الحالية، المشروع سينتهي في 28 مايو (5 أيام قبل الموعد)."

#### (ز) توليد Changelog من الـ Audit Log

- الـ AI يقترح مسودة Changelog أسبوعي للعميل:
  - بلغة مبسطة (بدون تفاصيل تقنية).
  - بالعربي أو الإنجليزي حسب لغة العميل.
  - القائد يراجع ويعدل وينشر.

#### (ح) مراجعة تعليقات العميل

- لما العميل يكتب تعليق طويل، الـ AI:
  - يلخصه في نقاط.
  - يصنّفه (طلب تعديل / سؤال / موافقة / اعتراض).
  - يقترح رد مهذب (للمراجعة).

### 11.4 حدود الاستخدام

- **حد يومي:** 100 طلب AI لكل فريق (قابل للتعديل من Site Admin).
- **Logging:** كل استخدام AI يُسجّل في `ai_usage` جدول (الطلب، التكلفة، النتيجة).

### 11.5 بنية تقنية

- Route Handler: `/api/ai/chat` (streaming عبر `streamText`).
- كل ميزة ذكية = tool منفصل في الـ AI SDK:
  - `generateMilestones(projectDescription, members)`.
  - `assignTasks(projectId, rule)`.
  - `summarizeWeek(teamId, weekStart)`.
  - `predictEndDate(projectId)`.
  - `draftChangelog(projectId, sinceDate)`.
  - `analyzeClientComment(commentId)`.

---

## 12. سجل التدقيق / Audit Log

### 12.1 ما يُسجَّل

كل عملية حساسة:

| الحدث / Event | من / By | على / On |
|---|---|---|
| user.login | user | - |
| user.invite_sent | lead | email |
| user.joined_team | member | team |
| project.created | user | project |
| project.updated | user | project |
| milestone.created | user | milestone |
| milestone.status_changed | user | milestone (from → to) |
| milestone.progress_changed | user | milestone (from → to) |
| milestone.approved | client | milestone |
| milestone.rejected | client | milestone (+ reason) |
| file.uploaded | user | file |
| file.auto_pruned | system | file |
| file.downloaded | user or client | file |
| client.link_generated | lead | project |
| client.link_revoked | lead | project |
| client.page_visited | client (ip + token) | project |
| comment.posted | user or client | milestone |
| doc.edited | user | doc_page |
| ai.used | user | prompt_type |

### 12.2 الاحتفاظ / Retention

- 6 شهور افتراضياً (قابل للضبط).
- تصدير CSV/JSON للأدمنز.

### 12.3 الواجهة

- صفحة `/projects/{id}/audit` للقائد: فلاتر بالحدث والمستخدم والتاريخ.
- Site Admin له Audit Log شامل لكل المنصة.

---

## 13. التعريب والثيم / Localization & Theming

### 13.1 اللغات

- **ar** (عربي — افتراضي) + **en** (إنجليزي).
- التبديل من زر في الهيدر (زي: 🌐 AR/EN).
- مخزن في: `localStorage` + user preference في DB.

### 13.2 RTL

- Tailwind RTL-aware (`dir="rtl"` على `<html>` في الوضع العربي).
- استخدام الـ logical properties (`ms-*`, `me-*`, `start-*`, `end-*`) في كل الاستايلات.

### 13.3 الثيم

- **light / dark / system** (افتراضي).
- عبر `next-themes`.
- كل الألوان عبر design tokens في `globals.css` (لا ألوان مباشرة).

### 13.4 الخطوط

- **عربي:** Tajawal أو IBM Plex Sans Arabic.
- **إنجليزي:** Geist Sans (الافتراضي).
- التبديل تلقائي حسب لغة المستخدم.

### 13.5 مكتبة الترجمة

- `next-intl` أو JSON بسيط في `/messages/ar.json` و `/messages/en.json`.
- كل النصوص في الواجهة عبر مفاتيح ترجمة.

---

## 14. المكدس التقني / Tech Stack

| الطبقة / Layer | الأداة / Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, shadcn/ui, Tailwind CSS v4 |
| Auth | Supabase Auth |
| Database | Supabase Postgres + Row Level Security (RLS) |
| Realtime | Supabase Realtime (for chat + notifications) |
| File Storage | Vercel Blob |
| Email | Resend (أو Supabase SMTP) |
| AI | AI SDK v6 + Vercel AI Gateway |
| i18n | next-intl |
| Theme | next-themes |
| Icons | lucide-react |
| Forms | react-hook-form + zod |
| Charts | Recharts (للإحصائيات) |
| Gantt | `frappe-gantt` أو مخصص بـ Framer Motion |
| Markdown editor | `@tiptap/react` (للـ wiki) |
| Date library | `date-fns` (مع locale العربي) |

---

## 15. مخطط قاعدة البيانات / Database Schema

### الجداول الرئيسية (مختصر)

```sql
-- 1. Users (Supabase auth.users + profile)
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  full_name text,
  role enum('site_admin','team_lead','member'),
  team_id uuid REFERENCES teams,
  language enum('ar','en') DEFAULT 'ar',
  theme enum('light','dark','system') DEFAULT 'system',
  created_at timestamptz
)

-- 2. Teams
teams (
  id uuid PRIMARY KEY,
  name text,
  lead_id uuid REFERENCES profiles,
  join_code text UNIQUE,       -- e.g. TEAM-8F2A-91X
  max_files int DEFAULT 5,
  created_at timestamptz
)

-- 3. Team Invitations
team_invitations (
  id uuid PRIMARY KEY,
  team_id uuid REFERENCES teams,
  email text,
  token text UNIQUE,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_by uuid
)

-- 4. Projects
projects (
  id uuid PRIMARY KEY,
  team_id uuid REFERENCES teams,
  name text,
  client_name text,
  client_email text,
  description text,
  status enum('active','paused','completed','archived'),
  work_mode enum('parallel','assigned','mixed') DEFAULT 'mixed',
  share_token text UNIQUE,
  share_expires_at timestamptz NULL,
  share_password_hash text NULL,
  show_team_to_client bool DEFAULT true,
  start_date date,
  expected_end_date date,
  created_at timestamptz
)

-- 5. Milestones
milestones (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  title text,
  description text,
  status enum('pending','working','review','approved','rejected'),
  start_date date,
  due_date date,
  progress int CHECK (progress BETWEEN 0 AND 100),
  order_index int,
  work_mode enum('parallel','assigned') NULL,  -- overrides project's
  needs_client_approval bool DEFAULT false,
  client_approved_at timestamptz NULL,
  client_rejection_reason text NULL,
  created_by uuid,
  created_at timestamptz
)

-- 6. Milestone assignees (many-to-many)
milestone_assignees (
  milestone_id uuid REFERENCES milestones,
  user_id uuid REFERENCES profiles,
  PRIMARY KEY (milestone_id, user_id)
)

-- 7. Checklist items
checklist_items (
  id uuid PRIMARY KEY,
  milestone_id uuid REFERENCES milestones,
  text text,
  is_done bool DEFAULT false,
  order_index int,
  done_by uuid NULL,
  done_at timestamptz NULL
)

-- 8. Files
files (
  id uuid PRIMARY KEY,
  team_id uuid REFERENCES teams,
  project_id uuid REFERENCES projects,
  milestone_id uuid REFERENCES milestones NULL,
  filename text,
  size_bytes bigint,
  blob_url text,
  uploaded_by uuid REFERENCES profiles,
  uploaded_at timestamptz,
  pinned bool DEFAULT false,
  is_deleted bool DEFAULT false,
  deleted_reason text NULL,
  deleted_at timestamptz NULL
)

-- 9. Comments (on milestones)
comments (
  id uuid PRIMARY KEY,
  milestone_id uuid REFERENCES milestones,
  author_type enum('team_member','client'),
  author_id uuid NULL,           -- team member id
  author_name text,              -- client name or member name
  content text,
  is_internal bool DEFAULT false, -- true = team-only, false = visible to client
  created_at timestamptz
)

-- 10. Internal Chat (per project)
internal_messages (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  author_id uuid REFERENCES profiles,
  content text,
  created_at timestamptz
)

-- 11. Documentation pages (wiki)
doc_pages (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  parent_id uuid REFERENCES doc_pages NULL,
  title text,
  content_markdown text,
  last_edited_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)

-- 12. Goals
goals (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  title text,
  description text,
  kpi text NULL,
  progress int,
  created_at timestamptz
)

-- 13. Announcements (internal, per project)
announcements (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  author_id uuid REFERENCES profiles,
  title text,
  content text,
  pinned bool DEFAULT false,
  created_at timestamptz
)

-- 14. Changelog entries (client-visible, per project)
changelog_entries (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  author_id uuid REFERENCES profiles,
  title text,
  content text,
  ai_generated bool DEFAULT false,
  published_at timestamptz
)

-- 15. Resources
resources (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  type enum('brand_asset','guide','credential','other'),
  title text,
  content text NULL,      -- for text resources
  blob_url text NULL,     -- for file resources
  is_public bool DEFAULT false, -- visible to client
  encrypted bool DEFAULT false, -- for credentials
  created_at timestamptz
)

-- 16. Internal Notes
internal_notes (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  author_id uuid REFERENCES profiles,
  content_markdown text,
  created_at timestamptz,
  updated_at timestamptz
)

-- 17. Time Tracking
time_entries (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles,
  project_id uuid REFERENCES projects,
  milestone_id uuid REFERENCES milestones NULL,
  started_at timestamptz,
  ended_at timestamptz NULL,
  duration_seconds int,
  description text
)

-- 18. Notifications
notifications (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles,
  type text,            -- e.g. 'client_comment', 'milestone_approved'
  title text,
  body text,
  link text,            -- URL in app
  read_at timestamptz NULL,
  created_at timestamptz
)

-- 19. Audit Log
audit_log (
  id bigserial PRIMARY KEY,
  team_id uuid,
  actor_type enum('user','client','system'),
  actor_id uuid NULL,
  actor_name text,
  event text,
  entity_type text,
  entity_id uuid NULL,
  metadata jsonb,
  ip_address text NULL,
  created_at timestamptz
)

-- 20. AI Usage
ai_usage (
  id uuid PRIMARY KEY,
  team_id uuid,
  user_id uuid,
  feature text,         -- e.g. 'generate_milestones'
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10,6),
  created_at timestamptz
)

-- 21. Milestone Templates
milestone_templates (
  id uuid PRIMARY KEY,
  team_id uuid REFERENCES teams,
  name text,
  description text,
  template_data jsonb,  -- milestones + checklists
  created_at timestamptz
)

-- 22. Site Settings (single row)
site_settings (
  id int PRIMARY KEY DEFAULT 1,
  logo_url text,
  brand_name text,
  default_language enum('ar','en'),
  default_theme enum('light','dark','system'),
  default_max_files int DEFAULT 5,
  max_file_size_mb int DEFAULT 500,
  invitation_ttl_days int DEFAULT 7,
  ai_enabled bool DEFAULT true,
  ai_daily_limit_per_team int DEFAULT 100
)
```

### Row Level Security (RLS)

**كل جدول يفعّل RLS** مع سياسات:
- `site_admin` → وصول كامل.
- `team_lead` / `member` → فقط data فريقه.
- `client` (عبر share token) → فقط البيانات العامة للمشروع (غير الـ internal).

---

## 16. هيكل الصفحات / Pages & Routes

```
/                              → Landing page (public)
/login                         → Admin login
/signup                        → Team Lead / Member signup
/invite/{token}                → Accept invitation

/dashboard                     → Admin dashboard
/my-tasks                      → Personal task list
/projects                      → All projects list
/projects/new                  → Create project
/projects/{id}                 → Project overview (tabs)
/projects/{id}/milestones      → Milestones tab
/projects/{id}/timeline        → Gantt view
/projects/{id}/docs            → Wiki pages
/projects/{id}/docs/{pageId}   → Individual page
/projects/{id}/goals           → Goals tab
/projects/{id}/announcements   → Internal announcements
/projects/{id}/changelog       → Client-facing changelog (editable)
/projects/{id}/resources       → Resources library
/projects/{id}/notes           → Internal notes
/projects/{id}/chat            → Internal team chat
/projects/{id}/files           → All files
/projects/{id}/audit           → Audit log
/projects/{id}/settings        → Project settings (+ client link)

/team                          → Team members page (for lead)
/team/invite                   → Invite new member

/ai                            → AI Assistant chat (lead only)
/ai/upload-brief               → Upload .md to generate project

/settings                      → User personal settings
/notifications                 → Notifications center

/admin                         → Site admin panel (owner only)
/admin/settings                → Platform-wide settings
/admin/teams                   → All teams
/admin/audit                   → Platform-wide audit log

/c/{projectId}/{token}         → CLIENT shared view (public via token)
```

---

## 17. خطة التنفيذ / Implementation Roadmap

### Phase 1: Foundation
- [ ] Setup Next.js 16 + Supabase + Vercel Blob.
- [ ] Database schema + RLS policies.
- [ ] Auth flows (signup, login, invite via link + email + team code).
- [ ] Site settings page (Owner only).
- [ ] Landing page.

### Phase 2: Core Project Management
- [ ] Teams & team members management.
- [ ] Create/edit/delete projects.
- [ ] Milestones CRUD + checklist.
- [ ] File upload to Vercel Blob + 5-file retention rule.
- [ ] Client share link generation + public viewer.

### Phase 3: Collaboration
- [ ] Comments (internal + client).
- [ ] Documentation (wiki) with Tiptap.
- [ ] Goals, Announcements, Changelog, Resources, Internal Notes.
- [ ] Internal Chat (Realtime).
- [ ] Notifications center.

### Phase 4: Views & UX
- [ ] Dashboard with stats.
- [ ] Timeline/Gantt view.
- [ ] Kanban board.
- [ ] My Tasks page.
- [ ] Time tracking.
- [ ] Arabic RTL + dark theme polish.

### Phase 5: AI Integration
- [ ] AI chat interface.
- [ ] Upload .md brief → generate project.
- [ ] Natural language task assignment.
- [ ] Weekly summary cron.
- [ ] Changelog auto-draft.
- [ ] On-Track/At-Risk/Delayed auto-status.
- [ ] End date prediction.

### Phase 6: Polish
- [ ] Audit log UI + export.
- [ ] Email notifications.
- [ ] Milestone templates.
- [ ] Testing + bug fixes.

---

## 18. خارج النطاق / Out of Scope

**مش هنعملهم في النسخة الأولى:**

- ❌ تسجيل عام للعملاء (signup form) — العملاء لا يملكون حسابات.
- ❌ نظام فواتير ومدفوعات (اتفقنا: لا جزء مالي في المنصة).
- ❌ تعدد الفرق الحقيقي (multi-tenant SaaS) — المنصة خاصة بفريقك.
- ❌ تطبيق موبايل native.
- ❌ تكامل مع Slack / Discord / WhatsApp (ممكن في v2).
- ❌ فيديو كول / شات صوتي.
- ❌ تعديل الملفات داخل المنصة (الملفات .zip تُرفع وتُحمّل فقط).
- ❌ توقيع رقمي قانوني (legal e-signature).
- ❌ Portfolio عام بالمشاريع السابقة.
- ❌ صفحة أسعار / باقات.
- ❌ حجز مواعيد (calendar booking).

---

## ✅ الاعتماد / Sign-off

| | Name | Date | Signature |
|---|---|---|---|
| Site Admin (Owner) | | | |
| Team Lead | | | |

**الخطوة التالية:** بمجرد اعتماد هذا المستند، نبدأ في Phase 1 (الأساسات: Next.js + Supabase + Auth + Landing Page).

---

*هذا المستند هو المرجع الوحيد للمشروع. أي تغيير لاحق يجب أن يُضاف كملحق مع تاريخ ورقم نسخة جديد.*
*This document is the single source of truth. Any future change must be added as an appendix with date and new version number.*
