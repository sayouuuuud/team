import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refresh the Supabase session cookie on every request and
 * protect the app routes. Called from /proxy.ts (Next 16).
 *
 * Public routes: /, /login, /signup, /invite/*, /auth/*, /testing*, and Next internals.
 * Everything else requires an authenticated user.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: do not run any code between createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublic =
    pathname === "/" ||
    pathname === "/testing" ||
    pathname.startsWith("/testing/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/public") ||
    pathname === "/favicon.ico"

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
