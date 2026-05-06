export type SmtpLocale = 'ja' | 'en' | 'zh' | 'tl'

function pick<T extends string>(locale: SmtpLocale, ja: string, en: string, zh?: string, tl?: string): string {
  if (locale === 'ja') return ja
  if (locale === 'zh') return zh ?? en
  if (locale === 'tl') return tl ?? en
  return en
}

export type SmtpExplanation = {
  title: string
  summary: string
  actions: string[]
  technical: string
}

/** Turn nodemailer / SMTP raw errors into actionable explanations (not only RFC codes). */
export function explainSmtpFailure(raw: string, locale: SmtpLocale = 'ja'): SmtpExplanation {
  const m = raw.toLowerCase()
  const technical = raw.trim() || 'Unknown error'
  const L = (ja: string, en: string, zh?: string, tl?: string) => pick(locale, ja, en, zh, tl)

  if (!raw.trim()) {
    return {
      title: L('原因不明のエラー', 'Unknown error'),
      summary: L('詳細メッセージがありません。もう一度お試しください。', 'No detailed message was returned.'),
      actions: [L('入力内容を確認して再テストしてください。', 'Check your inputs and run the test again.')],
      technical,
    }
  }

  if (m.includes('missing smtp host')) {
    return {
      title: L('SMTP ホストが空です', 'SMTP host is empty'),
      summary: L('メールサーバーのアドレス（例: smtp.gmail.com）を入力してください。', 'Enter your SMTP server hostname (e.g. smtp.gmail.com).'),
      actions: [L('画面上の SMTP Host を埋めてから送信テストを実行してください。', 'Fill in SMTP Host, then run Send test.')],
      technical,
    }
  }

  if (m.includes('missing smtp user')) {
    return {
      title: L('SMTP ユーザーが空です', 'SMTP user is empty'),
      summary: L('送信に使うメールアドレス（ログイン名）を入力してください。', 'Enter the email address used to sign in to SMTP.'),
      actions: [L('SMTP User に Gmail のフルアドレスを入力してください。', 'Enter your full Gmail address in SMTP User.')],
      technical,
    }
  }

  if (m.includes('missing smtp password')) {
    return {
      title: L('SMTP パスワードが空です', 'SMTP password is empty'),
      summary: L(
        'パスワード欄が空で、保存済みのパスワードも読み込めませんでした。新しいアプリパスワードを入力するか、先に保存してください。',
        'Password is empty and no saved password was found. Enter an App Password or Save settings first.'
      ),
      actions: [
        L('Google のアプリパスワードを SMTP Password に入力してください。', 'Paste your App Password into SMTP Password.'),
        L('既に保存している場合は「保存」を一度実行してから、空欄のままテスト（保存済み利用）を試してください。', 'If already saved, click Save once, then test with merge-saved password.'),
      ],
      technical,
    }
  }

  if (m.includes('econnrefused') || m.includes('connection refused')) {
    return {
      title: L('メールサーバーに接続できません', 'Cannot connect to the mail server'),
      summary: L(
        'このアプリから SMTP サーバーへ TCP 接続できませんでした。ホスト名・ポートが間違っているか、ネットワーク／ファイアウォールでブロックされている可能性があります。',
        'The app could not open a TCP connection to the SMTP server. The host or port may be wrong, or a firewall may be blocking outbound SMTP.'
      ),
      actions: [
        L(
          'SMTP Host（例: smtp.gmail.com）と Port（465 SSL または 587 STARTTLS）がサーバー案内どおりか確認してください。',
          'Confirm SMTP Host (e.g. smtp.gmail.com) and Port (465 for SSL or 587 for STARTTLS) match your provider.'
        ),
        L(
          '「SSL/TLS を使う」のオンオフとポートの組み合わせが一致しているか確認してください（465 は通常オン）。',
          'Match “Use SSL/TLS” with the port (465 is usually SSL on).'
        ),
        L(
          '会社・店舗のネットワークでは SMTP 送信が禁止されていることがあります。別回線やモバイルテザリングで試してください。',
          'Corporate Wi‑Fi often blocks SMTP. Try another network or mobile hotspot.'
        ),
      ],
      technical,
    }
  }

  if (m.includes('enotfound') || m.includes('getaddrinfo')) {
    return {
      title: L('SMTP のホスト名が解決できません', 'SMTP host name could not be resolved'),
      summary: L(
        'DNS でホスト名を調べられませんでした。タイプミスか、オフラインです。',
        'DNS lookup failed. Check for typos in the host or your network connection.'
      ),
      actions: [L('SMTP Host の綴りを確認してください（例: smtp.gmail.com）。', 'Verify the SMTP Host spelling (e.g. smtp.gmail.com).')],
      technical,
    }
  }

  if (m.includes('timeout') || m.includes('etimedout')) {
    return {
      title: L('接続がタイムアウトしました', 'Connection timed out'),
      summary: L(
        'サーバーから応答がありません。ポートや SSL 設定が合っていない場合や、通信が遮断されている場合に起きます。',
        'The server did not respond in time. Wrong port/SSL or blocked traffic often causes this.'
      ),
      actions: [
        L('ポート 465（SSL）か 587（STARTTLS）を切り替えて試してください。', 'Try port 465 with SSL, or 587 with STARTTLS.'),
        L('ファイアウォールで SMTP が許可されているか確認してください。', 'Ensure outbound SMTP is allowed on your network.'),
      ],
      technical,
    }
  }

  if (
    m.includes('certificate') ||
    (m.includes('ssl') && m.includes('wrong')) ||
    m.includes('unable_to_verify_leaving_certificate') ||
    m.includes('self signed certificate')
  ) {
    return {
      title: L('SSL/TLS の証明書エラー', 'SSL/TLS certificate problem'),
      summary: L(
        '暗号化通信の検証に失敗しました。ポートと「SSL/TLS」の組み合わせが不適切なことが多いです。',
        'TLS handshake failed. Often the port does not match SSL/TLS settings.'
      ),
      actions: [
        L('Gmail なら通常は Host smtp.gmail.com / Port 465 / SSL オン。', 'For Gmail: host smtp.gmail.com, port 465, SSL on.'),
        L('不正なプロキシやセキュリティ機器が証明書を差し替えていないか確認してください。', 'Check for proxies or security appliances intercepting TLS.'),
      ],
      technical,
    }
  }

  if (
    m.includes('535') ||
    m.includes('authentication failed') ||
    m.includes('invalid login') ||
    (m.includes('badcredentials') && m.includes('535'))
  ) {
    return {
      title: L('SMTP のユーザー名またはパスワードが拒否されました', 'SMTP username or password was rejected'),
      summary: L(
        'メールサーバーがログイン情報を認めませんでした。Gmail では「通常のログインパスワード」やパスキーだけでは SMTP にログインできません。Google が発行する「アプリパスワード」（16文字）が必要です。また Vercel に古い SMTP_PASS が残っていると、画面の設定より環境変数が優先されます。',
        'The mail server rejected your credentials. Gmail requires a Google App Password (16 characters), not your normal login password or Passkey only. If SMTP_PASS is set on Vercel, it overrides these Settings until removed or updated.'
      ),
      actions: [
        L(
          'Google アカウントで二段階認証を有効にし、アプリパスワードを作成して SMTP Password に貼り付けてください。',
          'Enable 2‑step verification on Google, create an App Password, and paste it into SMTP Password.'
        ),
        L(
          'SMTP User は送信に使う Gmail アドレスと完全に一致させてください。',
          'SMTP User must exactly match the Gmail address used for sending.'
        ),
        L(
          '本番では Vercel の環境変数 SMTP_PASS / SMTP_USER を確認してください（設定済みなら DB の値より優先）。',
          'In production, check Vercel env SMTP_PASS / SMTP_USER—they override saved Settings when set.'
        ),
      ],
      technical,
    }
  }

  if (
    m.includes('534') ||
    m.includes('application-specific password') ||
    m.includes('invalidsecondfactor')
  ) {
    return {
      title: L('Google がアプリパスワードを要求しています', 'Google requires an App Password'),
      summary: L(
        'このアカウントでは SMTP にアプリパスワードが必要です。ブラウザログイン用パスワードは使えません。',
        'This account requires an App Password for SMTP; your browser login password will not work.'
      ),
      actions: [
        L('Google アカウントの「アプリパスワード」を発行し、SMTP Password に設定してください。', 'Generate an App Password and set SMTP Password to that value.'),
      ],
      technical,
    }
  }

  if (m.includes('webloginrequired') || (m.includes('534') && m.includes('web'))) {
    return {
      title: L('Google がブラウザでの確認を求めています', 'Google wants a browser sign‑in check'),
      summary: L(
        '異常なログインとして扱われ、ブラウザでの確認が必要な状態です。',
        'Google may require you to unlock the account from a browser.'
      ),
      actions: [
        L('ブラウザで該当 Gmail にログインし、セキュリティ確認を完了してから再試行してください。', 'Sign in to that Gmail in a browser, complete security checks, then retry.'),
      ],
      technical,
    }
  }

  if (m.includes('too many') || m.includes('rate limit')) {
    return {
      title: L('送信が一時的に制限されています', 'Sending is temporarily rate‑limited'),
      summary: L(
        '短時間に試行が多すぎると SMTP 側がブロックすることがあります。',
        'Providers may throttle too many attempts in a short period.'
      ),
      actions: [L('数分待ってから再度テストしてください。', 'Wait several minutes and try again.')],
      technical,
    }
  }

  return {
    title: L('メール送信でエラーが発生しました', 'An email error occurred'),
    summary: L(
      'サーバーから返された内容を解析しましたが、個別の定型パターンには当てはまりませんでした。下の「技術的な詳細」を確認してください。',
      'We could not match this error to a known pattern. Check the technical detail below.'
    ),
    actions: [L('設定を見直し、もう一度送信テストを実行してください。', 'Review settings and run Send test again.')],
    technical,
  }
}
