import { createUploadthing, type FileRouter } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"

const f = createUploadthing()

export const ourFileRouter = {
  projectFile: f({
    blob: { maxFileSize: "16MB", maxFileCount: 10 },
    image: { maxFileSize: "16MB", maxFileCount: 10 },
    pdf: { maxFileSize: "16MB", maxFileCount: 10 },
  })
    .input(
      z.object({
        projectId: z.string().uuid(),
        milestoneId: z.string().uuid().optional(),
      }),
    )
    .middleware(async ({ input }) => {
      const me = await getCurrentUser()
      if (!me) throw new UploadThingError("Unauthorized")
      if (!me.team_id) throw new UploadThingError("No team")

      const supabase = await createClient()
      const { data: project } = await supabase
        .from("projects")
        .select("id, team_id")
        .eq("id", input.projectId)
        .maybeSingle()

      if (!project || project.team_id !== me.team_id) {
        throw new UploadThingError("Project not found or forbidden")
      }

      return {
        userId: me.id,
        teamId: me.team_id,
        projectId: input.projectId,
        milestoneId: input.milestoneId ?? null,
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const supabase = await createClient()
      // UploadThing v7 returns `ufsUrl`; older responses may still expose `url`.
      const blobUrl =
        (file as unknown as { ufsUrl?: string; url?: string }).ufsUrl ??
        (file as unknown as { url: string }).url
      await supabase.from("files").insert({
        team_id: metadata.teamId,
        project_id: metadata.projectId,
        milestone_id: metadata.milestoneId,
        uploaded_by: metadata.userId,
        filename: file.name,
        blob_url: blobUrl,
        storage_key: file.key,
        size_bytes: file.size,
        mime_type: file.type,
      })
      return { uploadedBy: metadata.userId }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
