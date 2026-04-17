/**
 * Seed the Site Admin (Owner) user.
 *
 * Idempotent: if the user already exists we just make sure the profile row
 * has role=site_admin and a confirmed email.
 *
 * Env required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const EMAIL = "admin@test.com"
const PASSWORD = "123456"
const FULL_NAME = "Site Admin"

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[seed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const baseHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
}

// ─── Helpers ─────────────────────────────────────────────

async function findUserByEmail(email) {
  // GET /auth/v1/admin/users?email=… (Supabase supports query by email)
  const url = new URL(`${SUPABASE_URL}/auth/v1/admin/users`)
  url.searchParams.set("per_page", "200")
  const res = await fetch(url, { headers: baseHeaders })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`listUsers failed: ${res.status} ${text}`)
  }
  const json = await res.json()
  const users = Array.isArray(json) ? json : json.users ?? []
  return users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase()) ?? null
}

async function createAdminUser() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`createUser failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function updateAdminPassword(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: baseHeaders,
    body: JSON.stringify({
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`updateUser failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function upsertAdminProfile(userId) {
  // PostgREST upsert via resolution=merge-duplicates on primary key
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      ...baseHeaders,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([
      {
        id: userId,
        full_name: FULL_NAME,
        role: "site_admin",
        team_id: null,
        language: "ar",
        theme: "system",
        pending_approval: false,
      },
    ]),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`upsert profile failed: ${res.status} ${text}`)
  }
  return res.json()
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log(`[seed] Looking for existing admin ${EMAIL}…`)
  let user = await findUserByEmail(EMAIL)

  if (user) {
    console.log(`[seed] User exists (${user.id}). Resetting password + confirming email.`)
    await updateAdminPassword(user.id)
  } else {
    console.log(`[seed] Creating new admin user…`)
    user = await createAdminUser()
    console.log(`[seed] Created user ${user.id}.`)
  }

  console.log(`[seed] Upserting profile as site_admin…`)
  await upsertAdminProfile(user.id)

  console.log(`[seed] Done.`)
  console.log(`[seed]   email:    ${EMAIL}`)
  console.log(`[seed]   password: ${PASSWORD}`)
  console.log(`[seed]   role:     site_admin`)
}

main().catch((err) => {
  console.error("[seed] FAILED:", err)
  process.exit(1)
})
