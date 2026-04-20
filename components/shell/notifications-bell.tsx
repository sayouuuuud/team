"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Props = {
  userId: string
  initialUnread: number
}

export function NotificationsBell({ userId, initialUnread }: Props) {
  const [unread, setUnread] = useState<number>(initialUnread)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setUnread((c) => c + 1)
          // Refresh server components (any /notifications page rendered, layout counts)
          router.refresh()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldRead = (payload.old as { read_at: string | null })?.read_at
          const newRead = (payload.new as { read_at: string | null })?.read_at
          if (!oldRead && newRead) {
            setUnread((c) => Math.max(0, c - 1))
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const wasUnread = !(payload.old as { read_at: string | null })?.read_at
          if (wasUnread) setUnread((c) => Math.max(0, c - 1))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, router])

  const label =
    unread > 0 ? `${unread} إشعار غير مقروء` : "لا إشعارات جديدة"

  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 ? (
        <span
          className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full grid place-items-center text-[10px] font-medium num-latin"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  )
}
