"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import type { FileRow } from "@/lib/data/projects"
import { UploadDropzone } from "@/lib/uploadthing"
import {
  deleteFileAction,
  togglePinFileAction,
} from "@/app/(app)/projects/[id]/actions"

export function FilesPanel({
  projectId,
  files,
  isLead,
}: {
  projectId: string
  files: FileRow[]
  isLead: boolean
}) {
  const router = useRouter()
  const [uploadError, setUploadError] = useState<string | null>(null)

  return (
    <section>
      <div className="flex items-center gap-4 mb-5">
        <span className="eyebrow">Files</span>
        <span className="flex-1 hairline" />
        <span className="tag-mono text-muted-foreground num-latin">
          {files.length} files
        </span>
      </div>

      <div className="card-paper p-5 mb-4">
        <UploadDropzone
          endpoint="projectFile"
          input={{ projectId }}
          onClientUploadComplete={() => {
            setUploadError(null)
            router.refresh()
          }}
          onUploadError={(err) => {
            setUploadError(err.message)
          }}
          appearance={{
            container:
              "rounded-md border border-dashed border-border bg-background/50 p-5",
            label: "font-display text-foreground",
            allowedContent: "tag-mono text-muted-foreground",
            button:
              "tag-mono rounded-md px-4 py-2 ut-ready:bg-[var(--primary)] ut-ready:text-[var(--primary-foreground)] ut-uploading:bg-muted ut-uploading:text-muted-foreground",
          }}
          config={{ mode: "auto" }}
        />
        {uploadError ? (
          <p className="text-xs text-destructive leading-relaxed mt-2">
            {uploadError}
          </p>
        ) : null}
      </div>

      {files.length === 0 ? (
        <div className="card-paper p-8 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            لا توجد ملفات بعد. ارفع أول ملف.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((f) => (
            <FileRowItem key={f.id} projectId={projectId} file={f} isLead={isLead} />
          ))}
        </div>
      )}
    </section>
  )
}

function FileRowItem({
  projectId,
  file,
  isLead,
}: {
  projectId: string
  file: FileRow
  isLead: boolean
}) {
  const [pending, startTransition] = useTransition()

  const togglePin = () => {
    startTransition(async () => {
      await togglePinFileAction(projectId, file.id, !file.pinned)
    })
  }

  const remove = () => {
    if (!confirm(`حذف الملف "${file.filename}"?`)) return
    startTransition(async () => {
      await deleteFileAction(projectId, file.id)
    })
  }

  const sizeKb = Math.max(1, Math.round(file.size_bytes / 1024))
  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`

  return (
    <div className="card-paper p-4 flex items-center gap-4">
      <div
        className="size-10 rounded-md grid place-items-center shrink-0"
        style={{
          background: file.pinned
            ? "color-mix(in oklch, var(--gold) 15%, var(--card))"
            : "color-mix(in oklch, var(--primary) 10%, var(--card))",
        }}
      >
        <span
          className="tag-mono"
          style={{ color: file.pinned ? "var(--gold)" : "var(--primary)" }}
        >
          {(file.mime_type ?? "").split("/")[1]?.slice(0, 3) || "file"}
        </span>
      </div>

      <a
        href={file.blob_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 hover:underline"
      >
        <div className="text-sm font-medium text-foreground truncate">
          {file.filename}
        </div>
        <div className="tag-mono text-muted-foreground num-latin">
          {sizeLabel} · {new Date(file.uploaded_at).toLocaleDateString("ar")}
        </div>
      </a>

      {file.pinned ? (
        <span
          className="tag-mono rounded-full px-2.5 py-0.5 shrink-0"
          style={{
            background: "color-mix(in oklch, var(--gold) 12%, transparent)",
            color: "var(--gold)",
          }}
        >
          pinned
        </span>
      ) : null}

      {isLead ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={togglePin}
            disabled={pending}
            type="button"
            className="tag-mono text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {file.pinned ? "unpin" : "pin"}
          </button>
          <button
            onClick={remove}
            disabled={pending}
            type="button"
            className="tag-mono text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            delete
          </button>
        </div>
      ) : null}
    </div>
  )
}
