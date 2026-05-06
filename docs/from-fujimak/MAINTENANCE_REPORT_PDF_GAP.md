# Maintenance Report PDF — 参照フォーマット vs 現行実装（追記・事前入力リスト）

参照: `docs/from-fujimak/オンコール.pdf`（desknet's NEO 系「Maintenance Report」）および共有イメージ「写真1」。  
現行: `src/lib/mechanicWorkReportPdf.ts` が出力する「ACCEPTANCE REPORT / INVOICE」（共有イメージ「写真2」）。

---

## 1. レイアウト方針の違い（ざっくり）

| 観点 | 参照（写真1・オンコール.pdf） | 現行（写真2） |
|------|------------------------------|---------------|
| タイトル | **Maintenance Report**（中央）、様式コード **FPC011** 等 | **ACCEPTANCE REPORT** / **INVOICE** |
| ヘッダー | 左上 **fujimak ロゴ**、右上 **Operation Date・様式番号** | 会社名のみ中央、右上は mechanician 名・発行日時 |
| 情報ブロック | **表形式**（Client / PIC / Location / Equipment / Brand / Model・Serial / Start・Finish / FOR 等） | **ラベル列挙**（Request ID, Store, Machine…） |
| 記述欄 | **Concern / Action Taken / Recommendation** の大きな横長ボックス | 同等の独立セクションなし（Symptom のみ簡易） |
| 技術チェック | **1〜10 の検査項目**＋各 **Comments**（例: NA） | **なし** |
| 評価 | **Rank（A〜E）**、**Conditions 凡例（〇△×）** | **なし** |
| 写真 | **Overview / Before / After** の縦並び（右カラム）＋ Status(F) | **Before / After** のみ（左グリッド＋右メタ） |
| 署名 | **Technician / Supervisor**（氏名＋署名画像）、別途 **Client** | **Customer Signature** のみ |
| フッター | **発行元 URL**、**ページ番号（1/2）** 等 | **なし** |
| 2ページ目 | **Remarks1〜10** のような続き欄 | **なし**（単ページ想定） |

---

## 2. PDF に「追記・新設」するセクション一覧（実装タスクの粒度）

以下は `mechanicWorkReportPdf.ts`（および必要なら API・DB・メカニック画面）への **追記対象**として整理したチェックリストです。

### 2.1 ヘッダー・書誌情報

- [ ] **左上**: Fujimak ロゴ画像の埋め込み（`public/images/` の PNG を `doc.image` で配置、アスペクト維持）。
- [ ] **中央タイトル**: モード見出しを **`Maintenance Report`** に統一するか、受領書／インボイス別に **サブタイトル行**を追加するかを決める。
- [ ] **右上**: **様式コード**（例: `FPC011`）— 固定値か DB／環境変数か。
- [ ] **右上**: **Operation Date** — 現状の「発行日時」と別に「作業日」を明示するか（タイムゾーン・フォーマット統一）。
- [ ] **`reportNo`** を PDF **本文**に表示（現状は引数にあるが未描画）。

### 2.2 メタデータ表（写真1の左側グリッド相当）

- [ ] **Client** — 店舗運営会社名／ブランドと区別する場合は別フィールドが必要。
- [ ] **PIC**（Person In Charge）— 現状 DB に無い場合は **事前入力 or メカニック画面で入力**。
- [ ] **Location** — `store_name` または住所テキストとの対応を決める。
- [ ] **Equipment** — `machine_name` または故障部位ラベルとの対応。
- [ ] **Brand** — **新規フィールド**の可能性大（機種マスタからコピーでも可）。
- [ ] **Model / Serial** — 既存 `machine_model` / `machine_serial` を表形式に埋める。
- [ ] **Start Time / Finish Time** — 現状は remarks 内 `WorkStartedAt` 等と **RecordedAt** を部分的に利用。**整形**と **欠損時の扱い**を仕様化。
- [ ] **FOR: Warranty / Billing** — ラジオ相当。**インボイス PDF と連動**させるなら `INVOICE` 時は Billing 既定などルール化。
- [ ] **If For Billing:** — 参照PDFでは空欄。請求条件メモ用なら任意テキスト。

### 2.3 ナラティブ（自由記述ボックス）

- [ ] **Concern** — 依頼時の懸念。**`symptom`** および **`troubleshooting_summary`** のマッピング、またはメカニック追記フィールド。
- [ ] **Action Taken** — **現状ほぼ無い**。remarks の `Comment` または **新規「作業内容」フィールド**が必要。
- [ ] **Recommendation** — **新規**。任意入力。

### 2.4 技術チェックリスト（10行）

- [ ] 項目文言を参照PDFと **完全一致**させる（誤記も踏襲するか修正するか要確認 — PDF抽出では `Power suply` など綴りずれあり）。
- [ ] 各行 **Comments**（初期値 `NA`、編集可能にするか）。
- [ ] PDF上は **2カラム配置**（1–5 / 6–10）— PDFKit で表または絶対座標レイアウト。

### 2.5 Rank・Conditions

- [ ] **Ranking 凡例**（A〜E）を PDF に印刷。
- [ ] **Rank** の選択値（例: `A`）。
- [ ] **Conditions 凡例**（〇△×）を印刷。
- [ ] 実データは **メカニック送信フォーム or remarks の構造化 JSON** など保存方式を決める。

### 2.6 写真ブロック

- [ ] **Overview** — 現状の attachments に **`overview`** などの `source` を追加するか、最初の店舗投稿写真を流用するか。
- [ ] **Before / After** — 既存 `mechanic_before` / `mechanic_after` を **右カラム縦積み**レイアウトに変更（レイアウトは写真1寄せ）。
- [ ] **Status(F)** — 例: `1: Completed`。ステータスコード表とマッピング。

### 2.7 署名・スタッフ

- [ ] **Technician** — 氏名（**ハードコード削除**）、プロフィールまたは送信ボディから。
- [ ] **Technician signature** — 既存の mechanic 署名データ URL の再利用可否。
- [ ] **Supervisor** — 氏名＋署名。**新規入力またはマスタ**。
- [ ] **Client** — 氏名＋署名。**現状 Customer Signature のみ** → ラベル・配置を写真1に合わせる。

### 2.8 フッター・複ページ

- [ ] **発行元 URL**（参照では `fujimak.dneoph.com/...`）— 本システムでは **ポータルURL** または省略。
- [ ] **ページ x / y** — PDFKit のドキュメントイベントで描画。
- [ ] **2ページ目 Remarks1〜10** — 長文・追加写真用。**継続ページテンプレ**が必要。

### 2.9 INVOICE（既存）との関係

- [ ] **Maintenance Report** を本体にし、請求情報は **別セクション**または **別PDF** のどちらにするか。
- [ ] 参照様式に **金額・税率・内訳**が無い場合、現行 `invoiceAmount` / `invoiceWorkDescription` を **どこに載せるか**（Maintenance Report 末尾 vs 従来 INVOICE テンプレ維持）。

---

## 3. 「事前に入力が必要」になるデータ（マッピング案）

### 3.1 既存 `maintenance_requests`（または同等レコード）から自動反映できそうなもの

| 参照フィールド | 候補となる既存プロパティ | 備考 |
|----------------|-------------------------|------|
| Location | `store_name`, `store_id` | 住所が必要なら店舗マスタ拡張 |
| Equipment | `machine_name`, `item` 関連 | `machine_name` 空のケースが多いならフロー改善 |
| Model / Serial | `machine_model`, `machine_serial` | |
| Concern（一部） | `symptom`, `troubleshooting_summary` | 文言の役割分担を決める |
| Before / After 写真 | `attachments`（source 別） | Overview は未定義 |

### 3.2 メカニック作業完了時に **新たに入力・送信**が必要になりそうなもの

| データ | 用途 |
|--------|------|
| PIC（現場責任者名） | 表「PIC」 |
| Client 表示名 | 本部名と店舗ブランドが異なる場合 |
| Brand | 機器ブランド |
| Start / End 時刻（現場実績） | 表「Start Time」「Finish Time」（remarks 依存をやめるなら **正規カラム化**推奨） |
| Warranty / Billing | FOR ラジオ |
| Action Taken | 作業内容本文 |
| Recommendation | 推奨事項 |
| チェックリスト 10 行 × Comments | 技術表 |
| Rank（A–E） | 評価 |
| Conditions（〇△×） | 機器状態サマリ（Rank と役割分担） |
| Overview 写真 | 追加アップロードまたは自動選択ルール |
| Technician 署名・氏名 | API で明示（プロフィール連携） |
| Supervisor 氏名・署名 | マスタ or 都度入力 |
| Client 署名・氏名 | 現場サイン（既存 customer signature をラベル含め整理） |

### 3.3 マスタ・設定側（システムが持つべきもの）

| データ | 用途 |
|--------|------|
| 様式コード（FPC011 等） | ヘッダー右上 |
| 会社住所・電話・TIN（将来） | インボイス要件次第でフッター／ヘッダー |
| チェックリスト項目文言の公式版 | PDF と入力画面の単一ソース化 |

---

## 4. 実装上のメモ（HTML ではない）

- 現行どおり **PDFKit のプログラム描画**で写真1に寄せる場合、**表・2カラム・続きページ**のコード量が増える。
- HTML テンプレートへ切り替える選択肢は別議論（依存追加・フォント・印刷の再検証が必要）。

---

## 5. 参照PDFから抽出したチェックリスト項目（維持用）

1. Power supply, voltage（※参照PDF表記は `Power suply`）  
2. Amps  
3. Filter, Condenser  
4. Compressor  
5. Refrigeration leak  
6. Wiring, Piping  
7. Fire condition  
8. Gas Leak  
9. Sound  
10. Screw, Bolt  

---

## 6. Rank / Conditions 凡例（参照より）

**Ranking**

- A: Unit Operational  
- B: For Replacement part(s)  
- C: For Observation  
- D: For pull out-shop evaluation and repair  
- E: For Unit Replacement  

**Conditions**

- 〇: Perfect Condition  
- △: Not Good Condition (Need replace parts maintenance)  
- ×: DANGEROUS STOP TO USING  

**Status(F)（例）**

- 1: Completed  

---

更新日: 対話時点のリポジトリ状態に基づく。PDFレイアウト確定後は本ファイルと `mechanicWorkReportPdf.ts` を同期すること。
