const fs = require('fs')
const path = require('path')
const PptxGenJS = require('pptxgenjs')

const assetsDir = '/Users/sakonhiroki/fujimak-maintenance/docs/ppt-assets-mobile'
const outputPath = '/Users/sakonhiroki/fujimak-maintenance/docs/MainTAI_Mechanic_Operations_Guide_Mobile_A4L_20260331_v2.pptx'

const assets = {
  stores: path.join(assetsDir, 'stores.png'),
  dashboard: path.join(assetsDir, 'dashboard.png'),
  maintenance: path.join(assetsDir, 'maintenance.png'),
  support: path.join(assetsDir, 'support.png'),
  mechanic: path.join(assetsDir, 'mechanic.png'),
  history: path.join(assetsDir, 'history.png'),
  management: path.join(assetsDir, 'management.png'),
  settings: path.join(assetsDir, 'settings.png'),
  poPreview: '/Users/sakonhiroki/fujimak-maintenance/docs/ppt-assets/po-preview.png',
  iphone:
    '/Users/sakonhiroki/Library/CloudStorage/GoogleDrive-bestinksalesman@gmail.com/マイドライブ/KIRII/吉沢さん案件/fujimak/iphone.png',
  pc: '/Users/sakonhiroki/Library/CloudStorage/GoogleDrive-bestinksalesman@gmail.com/マイドライブ/KIRII/吉沢さん案件/fujimak/PC.png',
  cloud:
    '/Users/sakonhiroki/Library/CloudStorage/GoogleDrive-bestinksalesman@gmail.com/マイドライブ/KIRII/吉沢さん案件/fujimak/cloud.png',
}

Object.entries(assets).forEach(([name, filePath]) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing asset "${name}": ${filePath}`)
  }
})

const pptx = new PptxGenJS()
pptx.defineLayout({ name: 'A4_LANDSCAPE', width: 11.69, height: 8.27 })
pptx.layout = 'A4_LANDSCAPE'
pptx.author = 'FUJIMAK MainT-AI'
pptx.company = 'FUJIMAK'
pptx.subject = 'Mobile-first system introduction'
pptx.title = 'FUJIMAK MainT-AI モバイル版紹介'
pptx.lang = 'ja-JP'

const COLORS = {
  title: '0F172A',
  subtitle: '475569',
  accent: '2563EB',
  panel: 'F8FAFC',
  border: 'CBD5E1',
}

const addHeader = (slide, title, subtitle) => {
  slide.background = { color: 'FFFFFF' }
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 11.69,
    h: 0.15,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent },
  })
  slide.addText(title, {
    x: 0.5,
    y: 0.24,
    w: 10.5,
    h: 0.5,
    fontFace: 'Meiryo',
    fontSize: 23,
    bold: true,
    color: COLORS.title,
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 0.76,
      w: 10.8,
      h: 0.35,
      fontFace: 'Meiryo',
      fontSize: 12,
      color: COLORS.subtitle,
    })
  }
}

const addMobileScreenSlide = ({ title, subtitle, imagePath, bullets }) => {
  const slide = pptx.addSlide()
  addHeader(slide, title, subtitle)

  // Left: mobile screenshot panel
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.65,
    y: 1.2,
    w: 4.1,
    h: 6.7,
    rectRadius: 0.1,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, pt: 1.2 },
  })
  slide.addImage({
    path: imagePath,
    x: 1.08,
    y: 1.45,
    w: 3.25,
    h: 6.15,
  })
  slide.addText('iPhone表示イメージ', {
    x: 1.08,
    y: 7.66,
    w: 3.25,
    h: 0.2,
    fontFace: 'Meiryo',
    fontSize: 9,
    color: '64748B',
    align: 'center',
  })

  // Right: explanation
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 5.0,
    y: 1.2,
    w: 6.0,
    h: 6.7,
    rectRadius: 0.1,
    fill: { color: 'FFFFFF' },
    line: { color: COLORS.border, pt: 1.2 },
  })

  slide.addText('この画面で行うこと', {
    x: 5.25,
    y: 1.45,
    w: 5.4,
    h: 0.4,
    fontFace: 'Meiryo',
    fontSize: 17,
    bold: true,
    color: COLORS.accent,
  })

  slide.addText(
    bullets.map((b) => `• ${b}`).join('\n'),
    {
      x: 5.28,
      y: 1.95,
      w: 5.35,
      h: 5.7,
      fontFace: 'Meiryo',
      fontSize: 14,
      color: '1F2937',
      breakLine: true,
      valign: 'top',
    }
  )
}

const addMechanicOperationSlide = () => {
  const slide = pptx.addSlide()
  addHeader(slide, '画面5: Mechanic作業記録（新機能）', '訪問作業の証跡化と受領サイン取得をモバイルで完結')

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.65,
    y: 1.2,
    w: 4.1,
    h: 6.7,
    rectRadius: 0.1,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, pt: 1.2 },
  })
  slide.addImage({
    path: assets.mechanic,
    x: 1.08,
    y: 1.45,
    w: 3.25,
    h: 6.15,
  })
  slide.addText('iPhone表示イメージ（Mechanic）', {
    x: 1.08,
    y: 7.66,
    w: 3.25,
    h: 0.2,
    fontFace: 'Meiryo',
    fontSize: 9,
    color: '64748B',
    align: 'center',
  })

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 5.0,
    y: 1.2,
    w: 6.0,
    h: 6.7,
    rectRadius: 0.1,
    fill: { color: 'FFFFFF' },
    line: { color: COLORS.border, pt: 1.2 },
  })
  slide.addText('この画面で行うこと', {
    x: 5.25,
    y: 1.45,
    w: 5.4,
    h: 0.35,
    fontFace: 'Meiryo',
    fontSize: 17,
    bold: true,
    color: COLORS.accent,
  })
  slide.addText(
    [
      '• 作業予定を選択し Start Work を押す',
      '• Before写真を保存して開始時刻を記録',
      '• After写真/動画と作業コメントを入力',
      '• Save and Get the Sign で受領画面へ遷移',
      '• 顧客サイン後に Save PDF / Send to Customer',
      '• Demo/Production を地球儀3回タップで切替',
    ].join('\n'),
    {
      x: 5.28,
      y: 1.95,
      w: 5.35,
      h: 5.7,
      fontFace: 'Meiryo',
      fontSize: 14,
      color: '1F2937',
      breakLine: true,
      valign: 'top',
    }
  )
}

// 1) Cover
{
  const slide = pptx.addSlide()
  slide.background = { color: 'FFFFFF' }
  slide.addText('MainT-AI fujimak ver', {
    x: 0.6,
    y: 1.2,
    w: 6.2,
    h: 0.8,
    fontFace: 'Meiryo',
    fontSize: 38,
    bold: true,
    color: COLORS.title,
  })
  slide.addText('初心者向けシステム紹介（iPhone操作前提 / A4横）', {
    x: 0.62,
    y: 2.15,
    w: 6.6,
    h: 0.4,
    fontFace: 'Meiryo',
    fontSize: 16,
    color: COLORS.subtitle,
  })
  slide.addText('この資料は、現場スタッフがスマホで操作する流れに合わせて作成しています。', {
    x: 0.62,
    y: 2.65,
    w: 6.6,
    h: 0.3,
    fontFace: 'Meiryo',
    fontSize: 12,
    color: '334155',
  })
  slide.addImage({ path: assets.iphone, x: 7.2, y: 1.3, w: 3.6, h: 3.6 })
  slide.addImage({ path: assets.cloud, x: 8.05, y: 4.9, w: 2.1, h: 2.1 })
  slide.addText('作成日: 2026/03/30', {
    x: 0.62,
    y: 7.7,
    w: 3,
    h: 0.2,
    fontFace: 'Meiryo',
    fontSize: 9,
    color: '64748B',
  })
}

// 2) Flow
{
  const slide = pptx.addSlide()
  addHeader(slide, 'モバイル運用フロー', 'iPhoneでの基本操作の全体像')
  slide.addText('店舗選択 → ダッシュボード → メンテ依頼 → Mechanic作業記録 → 履歴確認 → 管理連携', {
    x: 0.7,
    y: 1.5,
    w: 10.3,
    h: 0.5,
    fontFace: 'Meiryo',
    fontSize: 19,
    bold: true,
    color: COLORS.accent,
    align: 'center',
  })
  slide.addImage({ path: assets.iphone, x: 0.95, y: 2.2, w: 2.7, h: 2.7 })
  slide.addImage({ path: assets.cloud, x: 4.75, y: 2.2, w: 2.2, h: 2.2 })
  slide.addImage({ path: assets.pc, x: 7.6, y: 2.4, w: 3.0, h: 2.2 })
  slide.addShape(pptx.ShapeType.line, { x: 3.5, y: 3.55, w: 1.15, h: -0.2, line: { color: COLORS.accent, pt: 2 } })
  slide.addShape(pptx.ShapeType.line, { x: 7.0, y: 3.35, w: 0.75, h: 0.1, line: { color: COLORS.accent, pt: 2 } })
  slide.addText('現場入力', { x: 2.3, y: 3.9, w: 1.2, h: 0.2, fontFace: 'Meiryo', fontSize: 10, color: '334155' })
  slide.addText('クラウド処理', { x: 4.85, y: 4.55, w: 1.9, h: 0.2, fontFace: 'Meiryo', fontSize: 10, color: '334155' })
  slide.addText('管理確認', { x: 8.65, y: 4.7, w: 1.2, h: 0.2, fontFace: 'Meiryo', fontSize: 10, color: '334155' })
}

addMobileScreenSlide({
  title: '画面1: 店舗選択',
  subtitle: '最初に作業対象の店舗を選択',
  imagePath: assets.stores,
  bullets: ['地域フィルタで対象エリアを絞り込み', '店舗名を検索して選択', '選択後、ダッシュボードへ移動'],
})

addMobileScreenSlide({
  title: '画面2: ダッシュボード',
  subtitle: '主要メニューから業務を開始',
  imagePath: assets.dashboard,
  bullets: [
    '「New Maintenance Call」で新規依頼',
    '「View History」で過去ログ確認',
    '「Notifications」で進捗通知を確認',
    '画面下ナビでいつでも主要画面へ移動',
  ],
})

addMobileScreenSlide({
  title: '画面3: メンテナンス依頼',
  subtitle: '機器・症状・緊急度をステップ入力',
  imagePath: assets.maintenance,
  bullets: ['機器/シリアルを選択', '故障箇所・症状を入力', '緊急度と希望日時を設定', '送信して管理側に連携'],
})

addMobileScreenSlide({
  title: '画面4: AIサポートチャット',
  subtitle: '対話で必要情報を補完し、写真/動画も送信',
  imagePath: assets.support,
  bullets: [
    '苗字・連絡先・症状を順番に案内',
    '写真/動画を添付して状況共有',
    '不足情報をAIが聞き返して品質向上',
    '会話ログは履歴・管理画面に保存',
  ],
})

addMechanicOperationSlide()

addMobileScreenSlide({
  title: '画面6: Request History',
  subtitle: '過去依頼とAIサポート履歴を確認',
  imagePath: assets.history,
  bullets: [
    '依頼履歴をステータス別に確認',
    'Support Request HistoryでAI会話ログを確認',
    '画像・動画添付も履歴から再確認可能',
  ],
})

addMobileScreenSlide({
  title: '画面7: Store Management（管理者）',
  subtitle: '全案件の進捗と内容を一元管理',
  imagePath: assets.management,
  bullets: ['店舗横断で依頼一覧を確認', 'チャットログ・添付を確認', '優先度とステータスで対応を管理'],
})

{
  const slide = pptx.addSlide()
  addHeader(slide, '管理画面アップデート紹介', 'Managementで追加した運用機能（新規）')

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.65,
    y: 1.2,
    w: 4.1,
    h: 6.7,
    rectRadius: 0.1,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, pt: 1.2 },
  })
  slide.addImage({
    path: assets.management,
    x: 1.08,
    y: 1.45,
    w: 3.25,
    h: 6.15,
  })
  slide.addText('管理画面 最新UI', {
    x: 1.08,
    y: 7.66,
    w: 3.25,
    h: 0.2,
    fontFace: 'Meiryo',
    fontSize: 9,
    color: '64748B',
    align: 'center',
  })

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 5.0,
    y: 1.2,
    w: 6.0,
    h: 6.7,
    rectRadius: 0.1,
    fill: { color: 'FFFFFF' },
    line: { color: COLORS.border, pt: 1.2 },
  })

  slide.addText('追加ポイント', {
    x: 5.25,
    y: 1.45,
    w: 5.4,
    h: 0.4,
    fontFace: 'Meiryo',
    fontSize: 17,
    bold: true,
    color: COLORS.accent,
  })
  slide.addText(
    [
      '• Pending / In Progress / Paperwork / Completed の運用に対応',
      '• Support Chat Logsと案件行を統合し、処理導線を明確化',
      '• Dashboardに Docs Folder ボタンを追加',
      '• /management/docs で請求書/作業報告PDFを一元管理',
      '• PDFサムネイル表示 + Downloadで再配布を効率化',
      '• Archive Missing で未保存PDFをバックフィル',
      '• Docs Folder件数は実ファイル数ベースで管理',
    ].join('\n'),
    {
      x: 5.28,
      y: 1.95,
      w: 5.35,
      h: 5.9,
      fontFace: 'Meiryo',
      fontSize: 12.5,
      color: '1F2937',
      breakLine: true,
      valign: 'top',
    }
  )
}

addMobileScreenSlide({
  title: '画面8: Settings',
  subtitle: '通知先や運用設定を管理',
  imagePath: assets.settings,
  bullets: [
    '通知ベンダー情報を管理',
    '部品発注メール送信先を設定',
    '運用開始前に連絡先を整備',
  ],
})

// Auto document page
{
  const slide = pptx.addSlide()
  addHeader(slide, '業務用文書の自動作成機能', '部品注文データから帳票PDFを自動生成')
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.55,
    y: 1.2,
    w: 7.15,
    h: 6.65,
    rectRadius: 0.1,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, pt: 1.2 },
  })
  slide.addImage({ path: assets.poPreview, x: 0.7, y: 1.38, w: 6.85, h: 6.28 })
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.0,
    y: 1.2,
    w: 3.1,
    h: 6.65,
    rectRadius: 0.1,
    fill: { color: 'FFFFFF' },
    line: { color: COLORS.border, pt: 1.2 },
  })
  slide.addText('自動作成される内容', {
    x: 8.2,
    y: 1.5,
    w: 2.7,
    h: 0.35,
    fontFace: 'Meiryo',
    fontSize: 14,
    bold: true,
    color: COLORS.accent,
  })
  slide.addText('• 注文番号\n• 店舗/機器情報\n• 部品明細\n• 数量/単価/合計\n• 備考欄', {
    x: 8.2,
    y: 2.0,
    w: 2.6,
    h: 2.2,
    fontFace: 'Meiryo',
    fontSize: 13,
    color: '334155',
    breakLine: true,
  })
  slide.addText('メリット\n• 手入力ミス削減\n• 報告を標準化\n• 文書作成時間短縮', {
    x: 8.2,
    y: 4.5,
    w: 2.6,
    h: 2.1,
    fontFace: 'Meiryo',
    fontSize: 13,
    color: '334155',
    breakLine: true,
  })
}

// Hardware map page
{
  const slide = pptx.addSlide()
  addHeader(slide, 'ハードウェア接続マップ', 'iPhone・管理PC・クラウドの連携構成')
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: 1.3,
    w: 10.7,
    h: 6.3,
    rectRadius: 0.1,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, pt: 1.2 },
  })

  slide.addImage({ path: assets.cloud, x: 4.45, y: 1.65, w: 2.75, h: 2.75 })
  slide.addText('クラウドシステム\n[MainT-AI fujimak ver]', {
    x: 4.25,
    y: 4.35,
    w: 3.15,
    h: 0.7,
    fontFace: 'Meiryo',
    fontSize: 12,
    bold: true,
    align: 'center',
    breakLine: true,
    color: '0F172A',
  })

  slide.addImage({ path: assets.iphone, x: 1.05, y: 5.0, w: 3.2, h: 2.0 })
  slide.addText('顧客 1名\niPhone', {
    x: 1.15,
    y: 7.0,
    w: 3.0,
    h: 0.45,
    align: 'center',
    fontFace: 'Meiryo',
    fontSize: 12,
    bold: true,
    breakLine: true,
    color: '0F172A',
  })

  slide.addImage({ path: assets.pc, x: 7.4, y: 4.95, w: 3.3, h: 2.05 })
  slide.addText('カウンターメイン管理PC 1台', {
    x: 7.35,
    y: 7.0,
    w: 3.35,
    h: 0.35,
    align: 'center',
    fontFace: 'Meiryo',
    fontSize: 12,
    bold: true,
    color: '0F172A',
  })

  slide.addShape(pptx.ShapeType.line, { x: 3.45, y: 5.15, w: 1.35, h: -1.6, line: { color: COLORS.accent, pt: 2 } })
  slide.addShape(pptx.ShapeType.line, { x: 8.0, y: 5.1, w: -1.4, h: -1.55, line: { color: COLORS.accent, pt: 2 } })
  slide.addText('依頼データ送信', { x: 2.95, y: 4.95, w: 1.6, h: 0.25, fontFace: 'Meiryo', fontSize: 10, color: COLORS.accent })
  slide.addText('管理/確認データ', { x: 7.15, y: 4.95, w: 1.9, h: 0.25, fontFace: 'Meiryo', fontSize: 10, color: COLORS.accent })
}

// Closing
{
  const slide = pptx.addSlide()
  addHeader(slide, 'まとめ', 'モバイル中心で現場対応を効率化')
  slide.addText(
    '• 現場スタッフはiPhoneだけで依頼～添付～送信まで完結\n• 管理側はPCで全店舗の状況を一元把握\n• AIチャットと自動文書化により、伝達品質と業務効率を向上',
    {
      x: 0.9,
      y: 2.0,
      w: 9.8,
      h: 2.0,
      fontFace: 'Meiryo',
      fontSize: 19,
      color: '0F172A',
      breakLine: true,
    }
  )
  slide.addImage({ path: assets.cloud, x: 4.65, y: 4.4, w: 2.4, h: 2.4 })
  slide.addText('ありがとうございました', {
    x: 0.5,
    y: 7.35,
    w: 10.7,
    h: 0.4,
    fontFace: 'Meiryo',
    fontSize: 24,
    bold: true,
    align: 'center',
    color: COLORS.accent,
  })
}

pptx.writeFile({ fileName: outputPath }).then(() => {
  // eslint-disable-next-line no-console
  console.log(`PPT generated: ${outputPath}`)
})
