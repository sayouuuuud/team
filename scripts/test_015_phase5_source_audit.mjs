// =====================================================================
// test_015_phase5_source_audit.mjs
// Pure source-audit checks for Phase 5 TypeScript code. No DB, no deps.
//   1. Proposal/Apply schemas use the new work_mode values and rejected
//      'sequential' (regression for the Phase 5 flow bug).
//   2. Weekly-summary tool selects audit_log.event (not .action).
//   3. Autopilot reads projects.expected_end_date (not due_date).
//   4. Brief composer dropdown uses 'assigned'.
//   5. AI guard checks site toggle + role + rate limit before using AI.
//   6. Chat API route persists every call via logAiUsage().
// Run: node scripts/test_015_phase5_source_audit.mjs
// =====================================================================
import { readFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const read = (p) => readFileSync(path.resolve(ROOT, p), "utf8")

let failed = 0
function check(name, cond, detail = "") {
  if (cond) {
    console.log(`[PASS] ${name}`)
  } else {
    console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ""}`)
    failed++
  }
}

// --- 1. Brief flow schemas ------------------------------------------------
const briefSrc = read("app/(app)/ai/brief/actions.ts")
check(
  "brief actions ProposalSchema enum = parallel|assigned|mixed",
  /ProposalSchema[\s\S]*?work_mode:\s*z\.enum\(\[\s*"parallel"\s*,\s*"assigned"\s*,\s*"mixed"\s*\]\)/.test(
    briefSrc,
  ),
)
check(
  "brief actions ApplySchema enum = parallel|assigned|mixed",
  /ApplySchema[\s\S]*?work_mode:\s*z\.enum\(\[\s*"parallel"\s*,\s*"assigned"\s*,\s*"mixed"\s*\]\)/.test(
    briefSrc,
  ),
)
check(
  "brief actions no 'sequential' literal anywhere",
  !/"sequential"/.test(briefSrc),
)

// --- 2. AI tools select correct audit_log column --------------------------
const toolsSrc = read("lib/ai/tools.ts")
check(
  "weekly-summary tool selects audit_log.event",
  /from\("audit_log"\)[\s\S]{0,300}?"event,/.test(toolsSrc),
)
check(
  "weekly-summary tool does NOT select audit_log.action",
  !/from\("audit_log"\)[\s\S]{0,300}?"action,/.test(toolsSrc),
)

// --- 3. Autopilot engine uses expected_end_date ---------------------------
const autopilotSrc = read("lib/ai/autopilot.ts")
check(
  "autopilot selects projects.expected_end_date",
  /from\("projects"\)[\s\S]{0,300}?expected_end_date/.test(autopilotSrc),
)
check(
  "autopilot has no stale projects.due_date select",
  !/from\("projects"\)[\s\S]{0,200}?\bdue_date\b/.test(autopilotSrc),
)
check(
  "autopilot clamps activity score 0..100",
  /Math\.min\(100,\s*Math\.round/.test(autopilotSrc),
)

// --- 4. Brief composer uses new value ------------------------------------
const composerSrc = read("components/ai/brief-composer.tsx")
check(
  "brief composer dropdown option 'assigned'",
  /value="assigned"/.test(composerSrc),
)
check(
  "brief composer has no 'sequential' option",
  !/value="sequential"/.test(composerSrc),
)
check(
  "brief composer type union excludes 'sequential'",
  !/work_mode:\s*"parallel"\s*\|\s*"sequential"/.test(composerSrc),
)

// --- 5. AI guard layer ---------------------------------------------------
const guardSrc = read("lib/ai/guard.ts")
check(
  "AI guard checks site toggle ai_enabled",
  /ai_enabled/.test(guardSrc),
)
check(
  "AI guard checks daily limit",
  /ai_daily_limit/.test(guardSrc),
)
check(
  "AI guard checks team_lead role",
  /team_lead/.test(guardSrc),
)
check(
  "AI guard exports logAiUsage",
  /export\s+(async\s+)?function\s+logAiUsage/.test(guardSrc),
)

// --- 6. Chat route wires guard + logging ---------------------------------
const chatRouteSrc = read("app/api/ai/chat/route.ts")
check(
  "chat route calls assertAiAllowed",
  /assertAiAllowed/.test(chatRouteSrc),
)
check(
  "chat route calls logAiUsage",
  /logAiUsage/.test(chatRouteSrc),
)
check(
  "chat route does not run on edge runtime",
  !/export\s+const\s+runtime\s*=\s*['"]edge['"]/.test(chatRouteSrc),
)

// --- 7. Brief composer posts to server actions (not client SDK) ----------
check(
  "brief composer calls generateProposalAction",
  /generateProposalAction/.test(composerSrc),
)
check(
  "brief composer calls applyProposalAction",
  /applyProposalAction/.test(composerSrc),
)

// --- 8. No AI SDK imports in client components ---------------------------
const clientAiSrc = read("components/ai/ai-chat.tsx")
check(
  "ai-chat client does NOT import from 'ai' directly",
  !/from\s+['"]ai['"]/.test(clientAiSrc),
)
check(
  "ai-chat client uses useChat from @ai-sdk/react",
  /@ai-sdk\/react/.test(clientAiSrc),
)

if (failed > 0) {
  console.error(`\n${failed} Phase 5 source audit check(s) failed.`)
  process.exit(1)
}
console.log(`\nAll Phase 5 source audit checks passed.`)
