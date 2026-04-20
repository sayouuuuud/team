import type { ProjectAutoStatus } from "@/lib/data/projects"

const STATUS_CONFIG: Record<
  ProjectAutoStatus,
  { label: string; tone: string; color: string }
> = {
  on_track: {
    label: "On Track",
    tone: "color-mix(in oklch, var(--status-pass) 14%, transparent)",
    color: "var(--status-pass)",
  },
  at_risk: {
    label: "At Risk",
    tone: "color-mix(in oklch, var(--gold) 18%, transparent)",
    color: "var(--gold)",
  },
  late: {
    label: "Delayed",
    tone: "color-mix(in oklch, var(--status-fail) 14%, transparent)",
    color: "var(--status-fail)",
  },
  completed: {
    label: "Completed",
    tone: "color-mix(in oklch, var(--primary) 14%, transparent)",
    color: "var(--primary)",
  },
  paused: {
    label: "Paused",
    tone: "color-mix(in oklch, var(--status-skip) 14%, transparent)",
    color: "var(--status-skip)",
  },
}

export function AutopilotBadge({
  status,
  size = "sm",
}: {
  status: ProjectAutoStatus
  size?: "sm" | "md"
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.on_track
  return (
    <span
      className={`tag-mono rounded-full inline-flex items-center gap-2 ${
        size === "md" ? "px-3 py-1.5" : "px-2.5 py-1"
      }`}
      style={{ background: cfg.tone, color: cfg.color }}
      title="AI Autopilot status"
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  )
}
