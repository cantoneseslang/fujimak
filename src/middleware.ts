import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  ensureAccessForIdentifier,
  normalizeIdentifier,
} from "@/lib/accessPolicy";

const TEST_CODE_COOKIE = "fujimak_test_code";
const env = (value: string | undefined) => (typeof value === "string" ? value.trim() : "");
const AUTH_CHECK_TIMEOUT_MS = 2500;

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/maintenance",
  "/management",
  "/notifications",
  "/history",
  "/settings",
  "/stores",
  "/vendor",
  "/admin",
  "/customer-call",
  "/manual",
  "/troubleshooting",
  "/parts",
];

function isProtectedPath(pathname: string) {
  if (pathname === "/") return true;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * ローカル開発向け: ログインなしで保護ページを見られるようにする。
 * - 通常: `localhost` / `127.0.0.1` ではバイパス（.env 不要）
 * - 本番同様にローカルでログインを試したい: `.env.local` に `DEV_REQUIRE_AUTH=1`
 * - LAN の IP で開いていてもバイパスしたい: `DEV_SKIP_AUTH=1`
 */
function shouldBypassAuthInDev(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.DEV_REQUIRE_AUTH === "1") return false;
  if (process.env.DEV_SKIP_AUTH === "1") return true;
  const host = request.headers.get("host") ?? "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

function isBackgroundNavigationRequest(request: NextRequest) {
  const purpose = (request.headers.get("purpose") ?? "").toLowerCase();
  const nextRouterPrefetch = request.headers.get("next-router-prefetch");
  const rsc = request.headers.get("rsc");
  return purpose === "prefetch" || nextRouterPrefetch !== null || rsc === "1";
}

async function withTimeout<T>(task: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race<T>([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("auth_check_timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (isBackgroundNavigationRequest(request)) {
    return NextResponse.next();
  }

  if (shouldBypassAuthInDev(request)) {
    return NextResponse.next();
  }

  const url = env(process.env.NEXT_PUBLIC_FUJIMAK_SUPABASE_URL) || env(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey =
    env(process.env.NEXT_PUBLIC_FUJIMAK_SUPABASE_ANON_KEY) || env(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceRoleKey =
    env(process.env.FUJIMAK_SUPABASE_SERVICE_ROLE_KEY) || env(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !anonKey || !serviceRoleKey) {
    const u = request.nextUrl.clone();
    u.pathname = "/auth/sign-in";
    u.searchParams.set("errorCode", "supabase_env_missing");
    return NextResponse.redirect(u);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[],
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const testCode = request.cookies.get(TEST_CODE_COOKIE)?.value;
  if (testCode) {
    try {
      const testAccess = await withTimeout(
        ensureAccessForIdentifier(admin, testCode, "test_code"),
        AUTH_CHECK_TIMEOUT_MS,
      );
      if (testAccess.allowed) {
        return response;
      }
      response.cookies.delete(TEST_CODE_COOKIE);
    } catch {
      return response;
    }
  }

  let user: { email?: string | null } | null = null;
  try {
    const authResult = await withTimeout(supabase.auth.getUser(), AUTH_CHECK_TIMEOUT_MS);
    user = authResult.data.user;
  } catch {
    return response;
  }

  if (!user || !user.email) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/auth/sign-in";
    return NextResponse.redirect(signIn);
  }

  let emailAccess:
    | Awaited<ReturnType<typeof ensureAccessForIdentifier>>
    | null = null;
  try {
    emailAccess = await withTimeout(
      ensureAccessForIdentifier(
        admin,
        normalizeIdentifier(user.email),
        "email_password",
        { autoStartTrial: true },
      ),
      AUTH_CHECK_TIMEOUT_MS,
    );
  } catch {
    return response;
  }

  if (!emailAccess || !emailAccess.allowed) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/auth/sign-in";
    signIn.searchParams.set("errorCode", `access_${emailAccess?.reason ?? "unknown"}`);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|images|public).*)"],
};
