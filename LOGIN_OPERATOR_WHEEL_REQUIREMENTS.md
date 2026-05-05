# ログイン画面「操作者ホイール」仕様・要件定義（再実装用）

本書は `login.html` / `login.css` / `login.js` にある **操作者選択ホイール**（iOS 風ピッカー）を別実装で再現するための要件定義である。DOM 例: `#loginOperatorWheel` → `#loginOperatorWheelTrack` 内の `login-operator-wheel-item`。

---

## 1. 目的・利用シーン

- 店舗 POS ログインで **操作者（剪台1〜3・開票機1・顯示機2・店長等）** を選ぶ。
- **見た目は縦スクロールのホイール**、**値の正本は非表示の `<select>`**（フォーム・保存・解決ロジック用）。
- タッチ操作（慣性スクロール）と **キーボード（↑↓）**、**項目クリック**に対応する。

---

## 2. 情報アーキテクチャ

### 2.1 オプション一覧（論理）

固定順の配列（実装では `LOGIN_OPERATOR_OPTIONS`）。各要素は少なくとも:

| フィールド | 説明 |
|------------|------|
| `id` | アプリ全体で使う ID（例: `stylist-a`, `monitor-1`, `manager`）。`select` の `value` と一致させる。 |
| 表示名解決 | スタイリスト系はサーバー由来の表示名があれば優先、なければ i18n キーから文言取得。モニター・店長は i18n のみでも可。 |

### 2.2 データバインディング

- **表示**: トラック内の子要素（`role="option"`）がラベルを表示し、`data-id` / `data-index` を持つ。
- **正本（提出値）**: 非表示の `<select id="loginOperatorSelect">` の `value`。ホイール操作のたびに **`select` と同期**する。
- **永続化**: 選択確定時に `localStorage` 等へ保存（キーは POS 本体と揃える）。

---

## 3. DOM 構造（必須の役割）

```
.login-operator-field
  #loginOperatorWheel.login-operator-wheel [role=listbox] [tabindex=0]
    .login-operator-wheel-viewport
      .login-operator-wheel-fade--top      （装飾・クリック無効）
      .login-operator-wheel-fade--bottom
      .login-operator-wheel-slot           （中央の「枠」演出・クリック無効）
      #loginOperatorWheelTrack.login-operator-wheel-track （縦スクロール領域）
        .login-operator-wheel-item × N     （role=option）
  #loginOperatorSelect                     （sr-only / 画面外。aria-hidden）
```

- **フォーカス**: キーボード操作用に外枠 `#loginOperatorWheel` に `tabindex="0"`。
- **スクロール**: **トラックのみ** `overflow-y: auto`。ビューポートは `overflow: hidden`。

---

## 4. ビジュアル・レイアウト（CSS 要件）

| 項目 | 要件 |
|------|------|
| ビューポート高さ | 固定（実装では **144px**）。 |
| 1 行の高さ | 各 **item は 48px**（中央スロットと整合）。 |
| 上下パディング | トラックに **上下 48px**（padding）を入れ、**中央にスナップしたとき 1 項目がスロット中央に来る**ようにする。 |
| 中央スロット | ビューポート高さの **中央**に、高さ 48px・角丸の枠（装飾）。`pointer-events: none`。 |
| 端フェード | 上下 **40px** のグラデーションオーバーレイ。`pointer-events: none`。 |
| スクロールバー | **非表示**（`scrollbar-width: none` / `::-webkit-scrollbar { display: none }`）。 |
| タッチ | `-webkit-overflow-scrolling: touch`。 |
| スナップ | `scroll-snap-type: y mandatory`（トラック）、各 item に `scroll-snap-align: center`。 |
| scroll-behavior | CSS で `smooth` が付いていても、**プログラムによる初期位置同期は `scrollTop` 直代入が必須**（後述）。 |
| アクティブ見た目 | `.is-active` で色・軽い `scale(1.02)`・テキストシャドウ等（非アクティブは低コントラスト）。 |

---

## 5. 選択の決め方（ロジック要件）

### 5.1 幾何学ベースの「中央の行」

- トラックの **スクロール位置**から、**ビューポート縦中央に最も近い item の index** を選ぶ。
- 実装方針: `midViewport = scrollTop + clientHeight/2` と各 item の縦中心 `offsetTop + offsetHeight/2` の距離が最小のもの。

### 5.2 `select` との同期ポリシー

- **スクロール終了後**（デバウンス **100ms**）に、幾何学ベースで `select.value` を更新し、全 item の `is-active` / `aria-selected` を更新。
- **慣性スクロール直後に誤った値へ同期しない**ための **ロック**:
  - 初期表示〜慣性終了まで **`_qbhouseWheelLockSelect === true`** の間、スクロールでは `select.value` を**幾何からは更新しない**（ハイライトは `fromGeometry: false` で `select` に合わせるのみ）。
  - ロック解除: **約 700ms 後**、または **`scrollend` イベント**（対応ブラウザ）で解除。
- **クリックで項目選択**: 該当 index へ **スムーズスクロール**し、一定時間後にロック解除＋同期。

### 5.3 初期位置

- 優先順位（実装と同等にするなら）: **localStorage の保存 ID** → **`next` URL から来店用 `view` 推定**（`arrival` / `arrival-display` → `monitor-1` / `monitor-2`）→ 先頭。
- 初期スクロール: **複数回** `requestAnimationFrame` / **短い timeout（0, 80, 240ms）** で同じ index へ寄せる（レイアウト未確定・iPad の描画ずれ対策）。
- **プログラムで即時寄せるときは `scrollTop` 代入**（`scrollTo(smooth)` だけにしない）。

### 5.4 保存・解決（POS 連携）

- PIN 検証や遷移で使う ID は **`is-active` の `data-id` を正**とし、なければ幾何学 index → `LOGIN_OPERATOR_OPTIONS[idx].id`、最後に `select.value`（実装: `getLoginResolvedOperatorId()`）。

---

## 6. 入力・演出

| 操作 | 要件 |
|------|------|
| 縦ドラッグ / ホイール | トラックがスクロール。終了後に選択同期。 |
| 項目タップ | その index へスムーズスクロール＋`select` 更新。 |
| ↑ / ↓ | `#loginOperatorWheel` フォーカス時、**隣接 index** へスムーズスクロールし、遅延後に同期。 |
| フォーカスリング | `:focus-visible` で外枠にリング（キーボード利用者向け）。 |

---

## 7. アクセシビリティ

- 外枠: `role="listbox"`、各項目: `role="option"`、`aria-selected` を選択に合わせて更新。
- `aria-label` は操作者ラベル用 i18nと一致させる。
- ネイティブ `select` は **視覚的に隠すが**、可能なら SR 向けに `aria-hidden` の扱いを設計（実装では画面外＋非表示）。

---

## 8. 多言語・動的ラベル

- 項目表示文字列は **ログイン用 i18n**（`login.json` / 埋め込み）のキーから取得。
- 剪台（スタイリスト枠）は **`/api/stylist-names` のカスタム名**があれば優先（`file://` では fetch しない想定）。

---

## 9. 非機能・互換性メモ

- **iPad / WebKit**: 初期 `scroll` や `smooth` との競合で **モニター等に誤スナップ**しやすい → ロック＋即時 `scrollTop` が必須。
- 再描画（言語切替）時は、既存の scroll リスナ・タイマーを **解除してから** トラックを再生成する。

---

## 10. 参照実装パス

| ファイル | 内容 |
|----------|------|
| `login.html` | マークアップ、`loginOperatorSelect` 初期 option |
| `login.css` | `.login-operator-wheel-*` スタイル |
| `login.js` | `renderLoginOperatorSelect`, `syncLoginOperatorWheelActive`, `scrollLoginOperatorToIndex`, `getLoginResolvedOperatorId` 等 |
| `ios-printer-app/QBPrinter/WebContent/login.*` | iOS バンドル用コピー（同一仕様） |

---

## 変更履歴

- 2026-05-05: 初版（DOM / CSS / JS から要件を抽出）。
