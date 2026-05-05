import Link from "next/link";
import { getLocale } from "next-intl/server";
import { signIn, signInWithTestCode } from "@/app/auth/actions";

type Props = {
  searchParams?: Promise<{ error?: string; errorCode?: string; success?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const sp = searchParams != null ? (await searchParams) ?? {} : {};
  const locale = await getLocale();
  const lang = locale === "ja" || locale === "zh" || locale === "tl" ? locale : "en";

  const text = {
    en: {
      title: "FUJIMAK Portal Sign in",
      intro: "Invite-only account access. Sign in to start splash.",
      success: "Account created. Please sign in.",
      email: "Email",
      password: "Password",
      signIn: "Sign in",
      quickTest: "Quick test login (no password)",
      testCode: "Test code",
      signInWithCode: "Sign in with test code",
      needAccess: "Need access?",
      requestAccess: "Request access",
      errorFallback: "Sign-in could not complete. Please try again.",
      errors: {
        sign_in_failed: "Sign-in failed.",
        invalid_credentials: "Invalid email or password.",
        email_not_confirmed: "Please verify your email before signing in.",
        supabase_unreachable: "Cannot connect to Supabase. Please check network and project status.",
        test_code_required: "Test code is required.",
        access_not_found: "Your account is not allowed.",
        access_inactive: "Your account is not allowed.",
        access_not_started: "Your account is not activated yet.",
        access_expired: "Your test period has expired. Contact administrator.",
        access_invalid_window: "Access policy error. Contact administrator.",
        access_denied:
          "The sign-in link was interrupted or access was denied. Close this message and sign in with email and password.",
        supabase_env_missing: "Supabase environment variables are missing.",
        email_confirmation_failed: "Email confirmation link was invalid or expired. Try signing up again or contact support.",
      } as Record<string, string>,
    },
    ja: {
      title: "FUJIMAK Portal ログイン",
      intro: "招待制アカウントのみ利用できます。ログインしてスプラッシュを開始してください。",
      success: "アカウントを作成しました。ログインしてください。",
      email: "メールアドレス",
      password: "パスワード",
      signIn: "ログイン",
      quickTest: "クイックテストログイン（パスワード不要）",
      testCode: "テストコード",
      signInWithCode: "テストコードでログイン",
      needAccess: "アクセスが必要ですか？",
      requestAccess: "アクセス申請",
      errorFallback: "ログイン処理を完了できませんでした。もう一度お試しください。",
      errors: {
        sign_in_failed: "ログインに失敗しました。",
        invalid_credentials: "メールアドレスまたはパスワードが正しくありません。",
        email_not_confirmed: "ログイン前にメール認証を完了してください。",
        supabase_unreachable: "Supabase に接続できません。ネットワークとプロジェクト状態を確認してください。",
        test_code_required: "テストコードを入力してください。",
        access_not_found: "このアカウントは利用できません。",
        access_inactive: "このアカウントは利用できません。",
        access_not_started: "このアカウントはまだ有効化されていません。",
        access_expired: "テスト期間が終了しました。管理者に連絡してください。",
        access_invalid_window: "アクセス設定エラーです。管理者に連絡してください。",
        access_denied:
          "ログインリンクが中断されたか、アクセスが拒否されました。この表示を閉じて、メールとパスワードでログインしてください。",
        supabase_env_missing: "Supabase の環境変数が不足しています。",
        email_confirmation_failed:
          "メール確認リンクが無効か期限切れです。再度登録するか管理者に連絡してください。",
      } as Record<string, string>,
    },
    zh: {
      title: "FUJIMAK Portal 登入",
      intro: "僅限邀請帳號使用。請先登入再進入啟動畫面。",
      success: "帳號已建立，請登入。",
      email: "電郵",
      password: "密碼",
      signIn: "登入",
      quickTest: "快速測試登入（無需密碼）",
      testCode: "測試代碼",
      signInWithCode: "使用測試代碼登入",
      needAccess: "需要存取權限？",
      requestAccess: "申請權限",
      errorFallback: "無法完成登入，請再試一次。",
      errors: {
        sign_in_failed: "登入失敗。",
        invalid_credentials: "電郵或密碼不正確。",
        email_not_confirmed: "登入前請先完成電郵驗證。",
        supabase_unreachable: "無法連線至 Supabase。請檢查網路與專案狀態。",
        test_code_required: "請輸入測試代碼。",
        access_not_found: "你的帳號未被允許使用。",
        access_inactive: "你的帳號未被允許使用。",
        access_not_started: "你的帳號尚未啟用。",
        access_expired: "你的測試期限已到，請聯絡管理員。",
        access_invalid_window: "存取設定錯誤，請聯絡管理員。",
        access_denied: "登入連結已中斷或遭拒絕。請略過此訊息後，使用電郵與密碼登入。",
        supabase_env_missing: "Supabase 環境變數未設定完整。",
        email_confirmation_failed: "確認信連結無效或已過期。請重新註冊或聯絡管理員。",
      } as Record<string, string>,
    },
    tl: {
      title: "FUJIMAK Portal Sign in",
      intro: "Invite-only ang account access. Mag-sign in para simulan ang splash.",
      success: "Nagawa na ang account. Mag-sign in na.",
      email: "Email",
      password: "Password",
      signIn: "Mag-sign in",
      quickTest: "Mabilisang test login (walang password)",
      testCode: "Test code",
      signInWithCode: "Mag-sign in gamit ang test code",
      needAccess: "Kailangan ng access?",
      requestAccess: "Humiling ng access",
      errorFallback: "Hindi natapos ang pag-sign in. Pakisubukan ulit.",
      errors: {
        sign_in_failed: "Nabigo ang pag-sign in.",
        invalid_credentials: "Maling email o password.",
        email_not_confirmed: "Pakiberipika muna ang email bago mag-sign in.",
        supabase_unreachable: "Hindi makakonekta sa Supabase. Paki-check ang network at project status.",
        test_code_required: "Kailangan ang test code.",
        access_not_found: "Hindi pinapayagan ang account mo.",
        access_inactive: "Hindi pinapayagan ang account mo.",
        access_not_started: "Hindi pa aktibo ang account mo.",
        access_expired: "Expired na ang test period mo. Makipag-ugnayan sa admin.",
        access_invalid_window: "May error sa access policy. Makipag-ugnayan sa admin.",
        access_denied:
          "Na-interrupt ang link o tinanggihan ang access. Isara ang mensahe at mag-sign in gamit ang email at password.",
        supabase_env_missing: "Kulang ang Supabase environment variables.",
        email_confirmation_failed:
          "Invalid o expired ang confirmation link. Subukan mag-sign up ulit o kontakin ang admin.",
      } as Record<string, string>,
    },
  }[lang];
  const localeOptions = [
    { code: "ja", label: "日本語" },
    { code: "en", label: "English" },
    { code: "zh", label: "繁體中文" },
    { code: "tl", label: "Tagalog" },
  ] as const;

  const rawAuthError =
    [sp.errorCode, sp.error].find((v) => typeof v === "string" && v.trim().length > 0)?.trim() ?? "";
  const normalizedAuthError = rawAuthError.toLowerCase();
  const errorText = rawAuthError
    ? text.errors[rawAuthError] ??
      text.errors[normalizedAuthError] ??
      text.errorFallback
    : null;

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
              href={`/api/locale?locale=${option.code}&redirect=/auth/sign-in`}
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

        {sp.success ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {text.success}
          </div>
        ) : null}

        <form action={signIn} className="mt-6 space-y-4">
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
              autoComplete="current-password"
              className="h-11 w-full rounded-xl border border-zinc-300 px-3 outline-none focus:border-zinc-900"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {text.signIn}
          </button>
        </form>

        <div className="mt-5 border-t border-zinc-200 pt-5">
          <p className="text-xs text-zinc-500">{text.quickTest}</p>
          <form action={signInWithTestCode} className="mt-3 space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">{text.testCode}</span>
              <input
                name="testCode"
                type="password"
                required
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-zinc-300 px-3 outline-none focus:border-zinc-900"
              />
            </label>
            <button
              type="submit"
              className="h-11 w-full rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              {text.signInWithCode}
            </button>
          </form>
        </div>

        <div className="mt-6 text-sm text-zinc-600">
          {text.needAccess}{" "}
          <Link className="font-medium text-zinc-950 underline" href="/auth/sign-up">
            {text.requestAccess}
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">
          © 2024 LIFESUPPORT(HK)  All Right Reserved.
        </p>
      </div>
    </div>
  );
}
