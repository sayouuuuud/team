import type { ItemStatus } from "./types"

type StatusCfg = {
  label: string
  code: string
  color: string          // solid color (CSS var)
  softBg: string         // light tint background
  dotStyle: React.CSSProperties
  badgeStyle: React.CSSProperties
  textStyle: React.CSSProperties
}

export const STATUS_CONFIG: Record<ItemStatus, StatusCfg> = {
  pending: {
    label: "منتظر",
    code: "PEND",
    color: "var(--status-pending)",
    softBg: "var(--status-pending-soft)",
    dotStyle: { backgroundColor: "var(--status-pending)" },
    badgeStyle: {
      color: "var(--status-pending)",
      borderColor: "color-mix(in oklch, var(--status-pending) 35%, transparent)",
      backgroundColor: "var(--status-pending-soft)",
    },
    textStyle: { color: "var(--status-pending)" },
  },
  pass: {
    label: "نجح",
    code: "PASS",
    color: "var(--status-pass)",
    softBg: "var(--status-pass-soft)",
    dotStyle: { backgroundColor: "var(--status-pass)" },
    badgeStyle: {
      color: "var(--status-pass)",
      borderColor: "color-mix(in oklch, var(--status-pass) 40%, transparent)",
      backgroundColor: "var(--status-pass-soft)",
    },
    textStyle: { color: "var(--status-pass)" },
  },
  fail: {
    label: "فشل",
    code: "FAIL",
    color: "var(--status-fail)",
    softBg: "var(--status-fail-soft)",
    dotStyle: { backgroundColor: "var(--status-fail)" },
    badgeStyle: {
      color: "var(--status-fail)",
      borderColor: "color-mix(in oklch, var(--status-fail) 45%, transparent)",
      backgroundColor: "var(--status-fail-soft)",
    },
    textStyle: { color: "var(--status-fail)" },
  },
  blocked: {
    label: "متوقف",
    code: "BLKD",
    color: "var(--status-blocked)",
    softBg: "var(--status-blocked-soft)",
    dotStyle: { backgroundColor: "var(--status-blocked)" },
    badgeStyle: {
      color: "var(--status-blocked)",
      borderColor: "color-mix(in oklch, var(--status-blocked) 40%, transparent)",
      backgroundColor: "var(--status-blocked-soft)",
    },
    textStyle: { color: "var(--status-blocked)" },
  },
  skip: {
    label: "تخطي",
    code: "SKIP",
    color: "var(--status-skip)",
    softBg: "var(--status-skip-soft)",
    dotStyle: { backgroundColor: "var(--status-skip)" },
    badgeStyle: {
      color: "var(--status-skip)",
      borderColor: "color-mix(in oklch, var(--status-skip) 35%, transparent)",
      backgroundColor: "var(--status-skip-soft)",
    },
    textStyle: { color: "var(--status-skip)" },
  },
}

export const STATUS_ORDER: ItemStatus[] = ["pending", "pass", "fail", "blocked", "skip"]

export const PHASE_LABELS: Record<string, { kicker: string }> = {
  blue:   { kicker: "FOUNDATION" },
  green:  { kicker: "RECITATION" },
  sky:    { kicker: "ACADEMY" },
  amber:  { kicker: "PARENT" },
  orange: { kicker: "SUPERVISION" },
  purple: { kicker: "END-TO-END" },
  pink:   { kicker: "DESIGN / UX" },
  slate:  { kicker: "MODULE" },
}
