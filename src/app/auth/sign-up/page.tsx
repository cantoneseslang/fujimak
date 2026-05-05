import Link from "next/link";
import { getLocale } from "next-intl/server";
import { signUp } from "@/app/auth/actions";

type Props = {
  searchParams?: Promise<{ error?: string; errorCode?: string }>;
};

export default async function SignUpPage({ searchParams }: Props) {
  const sp = searchParams != null ? (await searchParams) ?? {} : {};
  const locale = await getLocale();
  const lang = locale === "ja" || locale === "zh" || locale === "tl" ? locale : "en";

  const text = {
    en: {
      title: "Create FUJIMAK account",
      intro: "Invite-only. If your email is not allowed, signup will be rejected.",
      email: "Email",
      password: "Password",
      passwordPlaceholder: "At least 8 characters",
      createAccount: "Create account",
      alreadyHaveAccount: "Already have an account?",
      signIn: "Sign in",
      errors: {
        signup_not_allowed: "Invite-only. This email is not allowed.",
        server_error: "Server error. Try again.",
        invalid_credentials: "Invalid email or password.",
        email_not_confirmed: "Please verify your email before signing in.",
        supabase_unreachable: "Cannot connect to Supabase. Please check network and project status.",
        sign_in_failed: "Sign-in failed.",
      } as Record<string, string>,
    },
    ja: {
      title: "FUJIMAK アカウント作成",
      intro: "招待制です。許可されていないメールアドレスは登録できません。",
      email: "メールアドレス",
      password: "パスワード",
      passwordPlaceholder: "8文字以上",
      createAccount: "アカウント作成",
      alreadyHaveAccount: "すでにアカウントをお持ちですか？",
      signIn: "ログイン",
      errors: {
        signup_not_allowed: "招待制です。このメールアドレスは許可されていません。",
        server_error: "サーバーエラーです。もう一度お試しください。",
        invalid_credentials: "メールアドレスまたはパスワードが正しくありません。",
        email_not_confirmed: "ログイン前にメール認証を完了してください。",
        supabase_unreachable: "Supabase に接続できません。ネットワークとプロジェクト状態を確認してください。",
        sign_in_failed: "ログインに失敗しました。",
      } as Record<string, string>,
    },
    zh: {
      title: "建立 FUJIMAK 帳號",
      intro: "僅限邀請制。如你的電郵未被允許，註冊會被拒絕。",
      email: "電郵",
      password: "密碼",
      passwordPlaceholder: "至少 8 個字元",
      createAccount: "建立帳號",
      alreadyHaveAccount: "已有帳號？",
      signIn: "登入",
      errors: {
        signup_not_allowed: "僅限邀請制，此電郵未被允許。",
        server_error: "伺服器錯誤，請稍後再試。",
        invalid_credentials: "電郵或密碼不正確。",
        email_not_confirmed: "登入前請先完成電郵驗證。",
        supabase_unreachable: "無法連線至 Supabase。請檢查網路與專案狀態。",
        sign_in_failed: "登入失敗。",
      } as Record<string, string>,
    },
    tl: {
      title: "Gumawa ng FUJIMAK account",
      intro: "Invite-only ito. Kung hindi pinapayagan ang email mo, mare-reject ang signup.",
      email: "Email",
      password: "Password",
      passwordPlaceholder: "Hindi bababa sa 8 characters",
      createAccount: "Gumawa ng account",
      alreadyHaveAccount: "May account ka na?",
      signIn: "Mag-sign in",
      errors: {
        signup_not_allowed: "Invite-only ito. Hindi pinapayagan ang email na ito.",
        server_error: "May error sa server. Pakisubukan muli.",
        invalid_credentials: "Maling email o password.",
        email_not_confirmed: "Pakiberipika muna ang email bago mag-sign in.",
        supabase_unreachable: "Hindi makakonekta sa Supabase. Paki-check ang network at project status.",
        sign_in_failed: "Nabigo ang pag-sign in.",
      } as Record<string, string>,
    },
  }[lang];
  const localeOptions = [
    { code: "ja", label: "日本語" },
    { code: "en", label: "English" },
    { code: "zh", label: "繁體中文" },
    { code: "tl", label: "Tagalog" },
  ] as const;

  const errorText = sp.errorCode ? (text.errors[sp.errorCode] ?? sp.errorCode) : sp.error;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{text.title}</h1>
          <p className="text-sm text-zinc-600">{text.intro}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {localeOptions.map((option) => (
            <Link
              key={option.code}
              href={`/api/locale?locale=${option.code}&redirect=/auth/sign-up`}
              className={`rounded-lg border px-3 py-1 text-xs ${
                lang === option.code ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        {errorText ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorText}
          </div>
        ) : null}

        <form action={signUp} className="mt-6 space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">{text.email}</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 w-full rounded-xl border border-zinc-300 px-3 outline-none focus:border-zinc-900"
              placeholder="you@example.com"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">{text.password}</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-zinc-300 px-3 outline-none focus:border-zinc-900"
              placeholder={text.passwordPlaceholder}
            />
          </label>

          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {text.createAccount}
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-600">
          {text.alreadyHaveAccount}{" "}
          <Link className="font-medium text-zinc-950 underline" href="/auth/sign-in">
            {text.signIn}
          </Link>
        </div>
      </div>
    </div>
  );
}
