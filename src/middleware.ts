import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Refreshes the Supabase session cookie on every request and guards
// the authenticated routes (/dashboard, /report, /news).
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/report") ||
    path.startsWith("/news") ||
    path.startsWith("/alerts") ||
    path.startsWith("/explain") ||
    path.startsWith("/earnings") ||
    path.startsWith("/settings") ||
    path.startsWith("/compare") ||
    path.startsWith("/timeline") ||
    path.startsWith("/watchlist") ||
    path.startsWith("/profile") ||
    path.startsWith("/portfolio") ||
    path.startsWith("/integrations");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets and the API route
  // (the API route does its own auth check).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};