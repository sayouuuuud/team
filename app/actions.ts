"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import type { ItemStatus } from "@/lib/types"

const EDITOR_COOKIE = "editor_unlocked"

function validatePassword(input: string) {
  const expected = process.env.EDITOR_PASSWORD
  if (!expected) return false
  return input === expected
}

export async function unlockEditor(password: string): Promise<{ ok: boolean; error?: string }> {
  if (!validatePassword(password)) {
    return { ok: false, error: "كلمة المرور غير صحيحة" }
  }

  const cookieStore = await cookies()
  cookieStore.set(EDITOR_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  })

  return { ok: true }
}

export async function lockEditor(): Promise<{ ok: boolean }> {
  const cookieStore = await cookies()
  cookieStore.delete(EDITOR_COOKIE)
  return { ok: true }
}

export async function isEditorUnlocked(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(EDITOR_COOKIE)?.value === "1"
}

async function assertUnlocked() {
  const unlocked = await isEditorUnlocked()
  if (!unlocked) {
    throw new Error("التعديل مقفول — الرجاء إدخال كلمة المرور أولاً")
  }
}

export async function updateItemStatus(
  itemId: number,
  status: ItemStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertUnlocked()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("test_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", itemId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function updateItemFields(
  itemId: number,
  fields: {
    notes?: string | null
    tester_name?: string | null
    error_description?: string | null
    error_code?: string | null
    screenshot_url?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertUnlocked()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("test_items")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", itemId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function uploadScreenshot(
  itemId: number,
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    await assertUnlocked()
    const file = formData.get("file") as File | null
    if (!file) return { ok: false, error: "لم يتم اختيار ملف" }

    const supabase = createServiceClient()
    const ext = file.name.split(".").pop() || "png"
    const path = `item-${itemId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("test-screenshots")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) return { ok: false, error: uploadError.message }

    const { data: publicUrl } = supabase.storage
      .from("test-screenshots")
      .getPublicUrl(path)

    const url = publicUrl.publicUrl

    const { error: updateError } = await supabase
      .from("test_items")
      .update({ screenshot_url: url, updated_at: new Date().toISOString() })
      .eq("id", itemId)

    if (updateError) return { ok: false, error: updateError.message }

    return { ok: true, url }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}
