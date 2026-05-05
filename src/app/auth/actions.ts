"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  ensureAccessForIdentifier,
  normalizeIdentifier,
} from "@/lib/accessPolicy";
import { getPublicSiteUrl } from "@/lib/siteUrl";

const TEST_CODE_COOKIE = "fujimak_test_code";

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

function mapAuthErrorCode(message: string): string | null {
  const m = message.trim();
  if (!m) return "sign_in_failed";
  if (m === "fetch failed" || /fetch failed/i.test(m)) return "supabase_unreachable";
  if (/invalid login credentials/i.test(m)) return "invalid_credentials";
  if (/email not confirmed/i.test(m)) return "email_not_confirmed";
  if (/Missing NEXT_PUBLIC.*SUPABASE|NEXT_PUBLIC_FUJIMAK_SUPABASE_URL|NEXT_PUBLIC_FUJIMAK_SUPABASE_ANON_KEY/i.test(m)) {
    return "supabase_env_missing";
  }
  return null;
}

/** Supabase URL/キー不正やプロキシが HTML を返したときなど（クライアントが JSON ではなく HTML をパースしようとして失敗） */
function mapInfrastructureAuthError(message: string): string | null {
  const m = message.trim();
  if (/unexpected token.*<!doctype|not valid json|<!doctype/i.test(m)) return "supabase_unreachable";
  if (/unexpected token/i.test(m) && /doctype/i.test(m)) return "supabase_unreachable";
  return null;
}

async function isAllowedToSignUp(email: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("signup_allowlist")
    .select("email")
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      errorCode = mapAuthErrorCode(error.message);
      if (!errorCode) errorMessage = error.message.trim() || "Sign-in failed.";
    } else {
      const access = await ensureAccessForIdentifier(
        getSupabaseAdmin(),
        normalizeIdentifier(email),
        "email_password",
        { autoStartTrial: true },
      );

      if (!access.allowed) {
        await supabase.auth.signOut();
        errorCode = `access_${access.reason}`;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    errorCode = mapInfrastructureAuthError(msg) ?? mapAuthErrorCode(msg);
    if (!errorCode) errorMessage = msg;
  }

  if (errorCode) {
    redirect(`/auth/sign-in?errorCode=${encodeURIComponent(errorCode)}`);
  }
  if (errorMessage) {
    redirect(`/auth/sign-in?error=${encodeURIComponent(errorMessage)}`);
  }

  const cookieStore = await cookies();
  cookieStore.delete(TEST_CODE_COOKIE);
  redirect("/stores");
}

export async function signInWithTestCode(formData: FormData) {
  const testCode = normalizeIdentifier(String(formData.get("testCode") || ""));
  if (!testCode) {
    redirect(`/auth/sign-in?errorCode=${encodeURIComponent("test_code_required")}`);
  }
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    const access = await ensureAccessForIdentifier(getSupabaseAdmin(), testCode, "test_code");
    if (!access.allowed) {
      errorCode = `access_${access.reason}`;
    } else {
      const cookieStore = await cookies();
      cookieStore.set(TEST_CODE_COOKIE, testCode, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });

      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    errorCode = mapInfrastructureAuthError(msg) ?? mapAuthErrorCode(msg);
    if (!errorCode) errorMessage = msg;
  }

  if (errorCode) {
    redirect(`/auth/sign-in?errorCode=${encodeURIComponent(errorCode)}`);
  }
  if (errorMessage) {
    redirect(`/auth/sign-in?error=${encodeURIComponent(errorMessage)}`);
  }

  redirect("/stores");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  let signupErrorCode: string | null = null;
  let signupError: string | null = null;

  try {
    const ok = await isAllowedToSignUp(email);
    if (!ok) {
      signupErrorCode = "signup_not_allowed";
    }
  } catch {
    signupErrorCode = "server_error";
  }

  if (signupErrorCode) {
    redirect(`/auth/sign-up?errorCode=${encodeURIComponent(signupErrorCode)}`);
  }
  if (signupError) {
    redirect(`/auth/sign-up?error=${encodeURIComponent(signupError)}`);
  }

  const supabase = await createSupabaseServerClient();
  const siteUrl = getPublicSiteUrl();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  });

  if (error) {
    const mapped = mapAuthErrorCode(error.message);
    if (mapped) {
      redirect(`/auth/sign-up?errorCode=${encodeURIComponent(mapped)}`);
    }
    redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/auth/sign-in?success=1");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(TEST_CODE_COOKIE);

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}
