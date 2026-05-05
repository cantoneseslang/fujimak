# FUJIMAK メンテナンスポータル

フィリピン **Angel's Pizza** 各店向けの Web アプリです。**Fujimak（フジマック）** が担当する厨房機器メンテナンスの依頼・進捗・連絡・部品・請求関連ワークフローを、店舗スタッフ・管理者・協力メカニックが同じシステム上で扱えるようにします。

- **本番（例）**: [fujimak-maintenance.vercel.app](https://fujimak-maintenance.vercel.app)
- **ソース**: [github.com/cantoneseslang/fujimak](https://github.com/cantoneseslang/fujimak)

---

## プロジェクト概要

### ブランド・対象

- 画面上は **Fujimak × Angel's Pizza** のジョイント表記（ヘッダーロゴなど）。
- 店舗マスタは Angel's Pizza 公式サイト由来のロケーション API から同期したデータを `src/lib/angelStores.ts` に保持（リポジトリ時点で **約 108 店舗分**のエントリ。運用時は実データに合わせて更新）。

### コンセプト

店舗からの修理依頼をフォームで統一し、管理者がガント状カレンダーで俯瞰しつつ、サポートチャット・メカニック派遣・部品発注・インボイスまでを DB 上のワークフローで追えるようにする「メンテナンス業務のハブ」です。

---

## 主な機能

### 店舗・スタッフ向け

| 領域 | 内容 |
|------|------|
| メンテナンス依頼 | エリア／項目／緊急度／詳細・写真／希望日程などのステップ入力（`maintenance`）。機種優先フローなどは `FUJIMAK_MAINTENANCE_FLOW` で切替可能。 |
| ダッシュボード・履歴・通知 | 店舗ホーム、過去依頼一覧、通知一覧。 |
| サポート AI チャット | `support`：Gemini を用いた対話・スレッド管理（`src/app/api/chat`）。 |
| 部品発注 | `parts`／`parts/confirm`：カタログ選択・PDF・ワークフロー連携。 |
| その他 | `troubleshooting`（トラブルシュート）、`manual`（マニュアル）、`customer-call`（クレーム窓口）、店舗選択 `stores` など。 |

### 管理者・オペレーション向け

| 領域 | 内容 |
|------|------|
| 管理画面 | `management`：全店メンテナンスの一覧・ガント風カレンダー・ステータス集計。 |
| サポートスレッド | スレッド閲覧、派遣（dispatch）、ワークフロー状態（進行中／書類／インボイス待ちなど）。 |
| 部品ワークフロー | 部品オーダー系ワークフローの確認とインボイス起点の処理。 |
| 書類・アーカイブ | `management/docs`、完了ドキュメント API（`api/completed-documents`）など。 |
| 請求・インボイス | `management/invoice` および関連 API（メカニック／パーツの invoice・再発行）。 |

### メカニック・協力会社向け

| 領域 | 内容 |
|------|------|
| メカニック画面 | `mechanic`：案件対応、作業報告・請求連携。 |
| ボード | `mechanic/board`：アサイン案件の俯瞰。 |
| 報告確認 | `mechanic/report-confirm`：提出内容の確認フロー。 |

### 認証・アクセス

- **Supabase Auth**（メール等）に加え、`access_policies` テーブルによる **試用期間（30 日）／恒久**などのアクセス制御（`src/lib/accessPolicy.ts`、`middleware.ts`）。
- 開発時は `localhost` で認証バイパス可能。本番同等で試す場合は `.env.local` に `DEV_REQUIRE_AUTH=1`。

### 多言語（next-intl）

- 日本語（`ja`）、英語（`en`）、繁体字中国語（`zh`）、タガログ語（`tl`）。文言は `messages/*.json`。デフォルトロケールは `src/i18n/config.ts` で `en`。

---

## 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 16（App Router） |
| UI | React 19、Tailwind CSS 4 |
| i18n | next-intl |
| DB / Auth | Supabase（PostgreSQL、SSR クッキーは `@supabase/ssr`） |
| メール | nodemailer（通知・派遣メール等） |
| PDF | pdfkit（サーバ側、External package 設定済み） |
| AI | Google Generative AI（Gemini、`GEMINI_API_KEY`） |
| 動画制作 | Remotion 4（プロモ動画コンポジション） |
| ホスティング | Vercel（Analytics 利用可） |

---

## ディレクトリ構成（抜粋）

```
fujimak-maintenance/
├── src/app/                 # App Router（ページ・Route Handlers）
│   ├── api/                 # REST API（メンテナンス、チャット、部品、請求、設定など）
│   ├── auth/                # サインイン・確認メール（confirm）
│   ├── management/          # 管理・書類・インボイス
│   ├── mechanic/            # メカニック・ボード・報告確認
│   ├── parts/               # 部品発注フロー
│   └── support/             # サポートチャット UI
├── src/components/          # Header、BottomNav、ChatbotWidget 等
├── src/lib/                 # Supabase クライアント、ドメインロジック、店舗データ
├── messages/                # 翻訳 JSON
├── public/
│   ├── data/                # メンテ CSV（カテゴリ・項目・緊急度）
│   └── images/              # Fujimak / Angel's ロゴ等
├── supabase/migrations/     # DB マイグレーション（ポータルコア、ワークフロー等）
├── remotion/                # プロモーション動画シーン
└── scripts/                 # PPTX 生成・検証スクリプト等
```

ローカル開発用にクローンした Cursor skill リポジトリは `.gitignore` で `skill-repos/` を除外しています（本体アプリとは別管理）。

---

## 環境変数（概要）

値はコミットしないでください。`.env.example` が無い場合は、以下を `.env.local` などに設定します。

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_FUJIMAK_SUPABASE_URL` / `NEXT_PUBLIC_FUJIMAK_SUPABASE_ANON_KEY` | ブラウザ・サーバ用 Supabase（旧名 `NEXT_PUBLIC_SUPABASE_*` でも可） |
| `FUJIMAK_SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | サーバ限定・管理者 API |
| `NEXT_PUBLIC_SITE_URL` | メール確認リンク等の公開オリジン（未設定時は `VERCEL_URL`） |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | サポートチャット AI |
| `SMTP_*`（`SMTP_HOST`、`SMTP_USER`、`SMTP_PASS` 等） | メール送信 |
| `FUJIMAK_MAINTENANCE_TO` | メンテナンス通知の宛先など |
| `FUJIMAK_MAINTENANCE_FLOW` | メンテナンスフォームのフロー（例: `machine_first`） |
| `DEV_REQUIRE_AUTH` / `DEV_SKIP_AUTH` | 開発時の認証挙動 |

---

## 開発コマンド

```bash
npm install
npm run dev          # Next.js（webpack モード指定済み）
npm run build
npm run start        # 本番ビルド後のローカル起動
npm run lint
```

### Remotion（プロモ動画）

コンポジションは `PromoZh`（繁体中文コピー前提）。出力はリポジトリルートの `out/`。

```bash
npm run remotion:preview   # プレビュー
npm run remotion:short     # 短いサンプル MP4
npm run remotion:render    # フル尺 MP4
```

### DB

マイグレーションは `supabase/migrations/`。本番 DB への適用は Supabase CLI またはダッシュボードの運用に従ってください。

---

## デプロイ

- **Vercel**: プロジェクト連携後、`main` への push で自動ビルドする運用が可能。手動ならリポジトリルートで `npx vercel deploy --prod`（`.vercel` は個人環境用のため Git には含めません）。
- **GitHub**: [cantoneseslang/fujimak](https://github.com/cantoneseslang/fujimak)

---

## 関連ドキュメント

- `docs/` … スキーマ SQL、運用メモ、資料類（社内向け）
- `.cursor/rules/mobile-footer-overlap.mdc` … モバイル固定フッターとコンテンツの重なり対策（実装時の注意）

---

## ライセンス・権利表示

ロゴ・商標は各権利者に帰属します。本 README はリポジトリの技術説明用です。契約・保守・問い合わせ窓口についてはプロジェクト当事者に従ってください。
