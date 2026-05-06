import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  ensureAccessForIdentifier,
  normalizeIdentifier,
} from "@/lib/accessPolicy";
import { locales, FUJIMAK_REQUEST_LOCALE_HEADER, type Locale } from "@/i18n/config";
import { negotiateLocaleFromAcceptLanguage } from "@/i18n/negotiateLocale";

const TEST_CODE_COOKIE = "fujimak_test_code";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
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

function resolveLocaleFromRequest(request: NextRequest): Locale {
  const raw = request.cookies.get("locale")?.value;
  if (raw && locales.includes(raw as Locale)) return raw as Locale;
  return negotiateLocaleFromAcceptLanguage(request.headers.get("accept-language"));
}

/** Same locale the middleware will persist on Set-Cookie — forwarded so RSC/next-intl agree on the same request. */
function stampIncomingLocale(request: NextRequest): Headers {
  const h = new Headers(request.headers);
  h.set(FUJIMAK_REQUEST_LOCALE_HEADER, resolveLocaleFromRequest(request));
  return h;
}

/** Persist locale cookie only when the browser did not send a valid one yet. */
function ensureLocaleCookie(request: NextRequest, response: NextResponse) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api")) return response;

  const raw = request.cookies.get("locale")?.value;
  if (raw && locales.includes(raw as Locale)) return response;

  const resolved = resolveLocaleFromRequest(request);
  response.cookies.set("locale", resolved, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: "lax",
  });
  return response;
}

function nextWithLocale(request: NextRequest): NextResponse {
  return NextResponse.next({
    request: {
      headers: stampIncomingLocale(request),
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/auth")) {
    return ensureLocaleCookie(request, nextWithLocale(request));
  }

  if (!isProtectedPath(pathname)) {
    return ensureLocaleCookie(request, nextWithLocale(request));
  }

  if (isBackgroundNavigationRequest(request)) {
    return ensureLocaleCookie(request, nextWithLocale(request));
  }

  if (shouldBypassAuthInDev(request)) {
    return ensureLocaleCookie(request, nextWithLocale(request));
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
    return ensureLocaleCookie(request, NextResponse.redirect(u));
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const response = NextResponse.next({
    request: {
      headers: stampIncomingLocale(request),
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
        return ensureLocaleCookie(request, response);
      }
      response.cookies.delete(TEST_CODE_COOKIE);
    } catch {
      return ensureLocaleCookie(request, response);
    }
  }

  let user: { email?: string | null } | null = null;
  try {
    const authResult = await withTimeout(supabase.auth.getUser(), AUTH_CHECK_TIMEOUT_MS);
    user = authResult.data.user;
  } catch {
    return ensureLocaleCookie(request, response);
  }

  if (!user || !user.email) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/auth/sign-in";
    return ensureLocaleCookie(request, NextResponse.redirect(signIn));
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
    return ensureLocaleCookie(request, response);
  }

  if (!emailAccess || !emailAccess.allowed) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/auth/sign-in";
    signIn.searchParams.set("errorCode", `access_${emailAccess?.reason ?? "unknown"}`);
    return ensureLocaleCookie(request, NextResponse.redirect(signIn));
  }

  return ensureLocaleCookie(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|images|public).*)"],
};
