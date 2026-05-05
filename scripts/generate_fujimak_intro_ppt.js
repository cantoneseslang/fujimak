const fs = require('fs')
const path = require('path')
const PptxGenJS = require('pptxgenjs')

const assetsDir = '/Users/sakonhiroki/fujimak-maintenance/docs/ppt-assets'
const outputPath = '/Users/sakonhiroki/fujimak-maintenance/docs/MainTAI_Mechanic_Operations_Guide_A4L_20260331_v2.pptx'

const assets = {
  stores: path.join(assetsDir, 'stores.png'),
  dashboard: path.join(assetsDir, 'dashboard.png'),
  maintenance: path.join(assetsDir, 'maintenance.png'),
  support: path.join(assetsDir, 'support.png'),
  mechanic: path.join(assetsDir, 'mechanic.png'),
  history: path.join(assetsDir, 'history.png'),
  management: path.join(assetsDir, 'management.png'),
  settings: path.join(assetsDir, 'settings.png'),
  poPreview: path.join(assetsDir, 'po-preview.png'),
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
pptx.subject = 'System introduction for beginners'
pptx.title = 'FUJIMAK MainT-AI システム紹介'
pptx.lang = 'ja-JP'

const COLORS = {
  title: '0F172A',
  subtitle: '475569',
  accent: '1D4ED8',
  lightBg: 'F8FAFC',
  border: 'CBD5E1',
}

const addSlideTitle = (slide, title, subtitle) => {
  slide.background = { color: 'FFFFFF' }
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 11.69,
    h: 0.14,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent },
  })
  slide.addText(title, {
    x: 0.5,
    y: 0.25,
    w: 8.8,
    h: 0.5,
    fontFace: 'Meiryo',
    fontSize: 24,
    bold: true,
    color: COLORS.title,
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 0.78,
      w: 10.5,
      h: 0.35,
      fontFace: 'Meiryo',
      fontSize: 12,
      color: COLORS.subtitle,
    })
  }
}

const addScreenshotSlide = ({ title, subtitle, imagePath, note }) => {
  const slide = pptx.addSlide()
  addSlideTitle(slide, title, subtitle)
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.45,
    y: 1.2,
    w: 10.79,
    h: 6.6,
    rectRadius: 0.08,
    fill: { color: COLORS.lightBg },
    line: { color: COLORS.border, pt: 1 },
  })
  slide.addImage({
    path: imagePath,
    x: 0.6,
    y: 1.34,
    w: 10.49,
    h: 6.12,
  })
  if (note) {
    slide.addText(note, {
      x: 0.6,
      y: 7.55,
      w: 10.5,
      h: 0.3,
      fontFace: 'Meiryo',
      fontSize: 10,
      color: '334155',
    })
  }
}

// Slide 1: Cover
{
  const slide = pptx.addSlide()
  slide.background = { color: 'FFFFFF' }
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 11.69,
    h: 8.27,
    fill: { color: 'FFFFFF' },
    line: { color: 'FFFFFF' },
  })
  slide.addText('MainT-AI fujimak ver', {
    x: 0.6,
    y: 1.4,
    w: 6.5,
    h: 0.8,
    fontFace: 'Meiryo',
    fontSize: 38,
    bold: true,
    color: COLORS.title,
  })
  slide.addText('初心者向けシステム紹介資料（A4横）', {
    x: 0.62,
    y: 2.3,
    w: 6.5,
    h: 0.45,
    fontFace: 'Meiryo',
    fontSize: 16,
    color: COLORS.subtitle,
  })
  slide.addText('対象: 店舗スタッフ / 管理者 / 導入担当者', {
    x: 0.62,
    y: 2.85,
    w: 6.5,
    h: 0.32,
    fontFace: 'Meiryo',
    fontSize: 12,
    color: '334155',
  })
  slide.addImage({ path: assets.cloud, x: 7.0, y: 1.05, w: 4.1, h: 4.1 })
  slide.addText('FUJIMAK Maintenance Platform', {
    x: 6.95,
    y: 5.35,
    w: 4.3,
    h: 0.4,
    align: 'center',
    fontFace: 'Meiryo',
    fontSize: 13,
    bold: true,
    color: COLORS.accent,
  })
  slide.addShape(pptx.ShapeType.line, {
    x: 0.6,
    y: 7.6,
    w: 10.5,
    h: 0,
    line: { color: 'E2E8F0', pt: 1 },
  })
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

// Slide 2: Process overview
{
  const slide = pptx.addSlide()
  addSlideTitle(slide, 'システム全体フロー', 'どういう画面で、どういう処理をするか（全体像）')
  slide.addText(
    '店舗選択  →  ダッシュボード  →  新規メンテ依頼  →  Mechanic作業記録  →  履歴確認  →  管理画面で進捗管理',
    {
      x: 0.65,
      y: 1.45,
      w: 10.3,
      h: 0.7,
      fontFace: 'Meiryo',
      fontSize: 16,
      bold: true,
      color: COLORS.accent,
      align: 'center',
    }
  )
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.7,
    y: 2.5,
    w: 5.0,
    h: 4.8,
    rectRadius: 0.08,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addText(
    [
      { text: '店舗スタッフ側\n', options: { bold: true, color: '0F172A' } },
      { text: '1) 店舗を選択\n2) 症状・写真/動画を入力\n3) AIで必要情報を補完\n4) 依頼履歴を確認' },
    ],
    {
      x: 0.95,
      y: 2.75,
      w: 4.5,
      h: 4.2,
      fontFace: 'Meiryo',
      fontSize: 14,
      color: '334155',
      breakLine: true,
    }
  )
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 6.0,
    y: 2.5,
    w: 5.0,
    h: 4.8,
    rectRadius: 0.08,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addText(
    [
      { text: '管理者側\n', options: { bold: true, color: '0F172A' } },
      { text: '1) 依頼一覧を時系列で確認\n2) チャットログ/添付を確認\n3) ステータス更新と対応指示\n4) 帳票(PDF)を業務文書として利用' },
    ],
    {
      x: 6.25,
      y: 2.75,
      w: 4.5,
      h: 4.2,
      fontFace: 'Meiryo',
      fontSize: 14,
      color: '334155',
      breakLine: true,
    }
  )
}

addScreenshotSlide({
  title: '画面1: 店舗選択',
  subtitle: '作業対象店舗を選んで業務を開始',
  imagePath: assets.stores,
  note: 'ポイント: 地域フィルタと検索で対象店舗を素早く選択',
})

addScreenshotSlide({
  title: '画面2: ダッシュボード',
  subtitle: '主要メニューから業務を開始',
  imagePath: assets.dashboard,
  note: 'ポイント: 新規依頼、履歴、通知、マニュアル、Q&A、部品発注へ遷移',
})

addScreenshotSlide({
  title: '画面3: 新規メンテナンス依頼',
  subtitle: '機械・症状・緊急度を入力して依頼',
  imagePath: assets.maintenance,
  note: 'ポイント: ステップ式入力で初心者でも迷いにくい',
})

addScreenshotSlide({
  title: '画面4: AIサポートチャット',
  subtitle: '対話で必要情報を収集し、写真/動画も添付可能',
  imagePath: assets.support,
  note: 'ポイント: 入力不備を減らし、依頼情報の質を向上',
})

// Slide 7: mechanic flow (new)
{
  const slide = pptx.addSlide()
  addSlideTitle(slide, '画面5: Mechanic作業記録（新機能）', '訪問作業の証跡化と受領サイン取得をモバイルで完結')

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.45,
    y: 1.25,
    w: 5.35,
    h: 6.45,
    rectRadius: 0.08,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addImage({ path: assets.mechanic, x: 1.1, y: 1.55, w: 4.05, h: 5.75 })
  slide.addText('iPhone表示イメージ（Mechanic）', {
    x: 1.1,
    y: 7.35,
    w: 4.05,
    h: 0.25,
    fontFace: 'Meiryo',
    fontSize: 10,
    color: '64748B',
    align: 'center',
  })

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 5.9,
    y: 1.25,
    w: 5.35,
    h: 6.45,
    rectRadius: 0.08,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addText('紹介ポイント', {
    x: 6.2,
    y: 1.55,
    w: 4.8,
    h: 0.35,
    fontFace: 'Meiryo',
    fontSize: 16,
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
      '',
      '運用モード:',
      '• Demo: サンプル案件で操作練習',
      '• Production: 実案件のみ表示',
      '• 地球儀3回タップで切替',
    ].join('\n'),
    {
      x: 6.2,
      y: 2.0,
      w: 4.8,
      h: 5.4,
      fontFace: 'Meiryo',
      fontSize: 13,
      color: '334155',
      breakLine: true,
      valign: 'top',
    }
  )
}

// Slide 8: history + management side by side
{
  const slide = pptx.addSlide()
  addSlideTitle(slide, '画面6: 履歴確認 + 管理画面', '依頼履歴と管理者のオペレーション')
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.45,
    y: 1.25,
    w: 5.35,
    h: 6.45,
    rectRadius: 0.08,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 5.9,
    y: 1.25,
    w: 5.35,
    h: 6.45,
    rectRadius: 0.08,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addImage({ path: assets.history, x: 0.55, y: 1.52, w: 5.15, h: 5.5 })
  slide.addImage({ path: assets.management, x: 6.0, y: 1.52, w: 5.15, h: 5.5 })
  slide.addText('依頼履歴（Request History）', {
    x: 0.65,
    y: 7.08,
    w: 4.9,
    h: 0.3,
    fontFace: 'Meiryo',
    fontSize: 11,
    bold: true,
    color: '334155',
    align: 'center',
  })
  slide.addText('管理画面（Store Management）', {
    x: 6.1,
    y: 7.08,
    w: 4.9,
    h: 0.3,
    fontFace: 'Meiryo',
    fontSize: 11,
    bold: true,
    color: '334155',
    align: 'center',
  })
}

// Slide 9: management enhancements
{
  const slide = pptx.addSlide()
  addSlideTitle(slide, '管理画面アップデート紹介', 'Managementで追加した運用機能（新規）')

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.45,
    y: 1.25,
    w: 6.9,
    h: 6.45,
    rectRadius: 0.08,
    fill: { color: 'FFFFFF' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 7.55,
    y: 1.25,
    w: 3.7,
    h: 6.45,
    rectRadius: 0.08,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', pt: 1 },
  })

  slide.addText('追加ポイント', {
    x: 0.75,
    y: 1.55,
    w: 6.2,
    h: 0.35,
    fontFace: 'Meiryo',
    fontSize: 17,
    bold: true,
    color: COLORS.accent,
  })
  slide.addText(
    [
      '• ステータスを Pending / In Progress / Paperwork / Completed で運用',
      '• Support Chat Logs と依頼行を統合し、対象案件の流れを一画面で確認',
      '• In Progress から請求処理へ進む運用（Invoice作成導線を明確化）',
      '• Dashboardから Docs Folder へ直接遷移',
      '• /management/docs を新設し、請求書・作業報告PDFを一元管理',
      '• Archive Missing で過去Completed案件の未保存PDFをバックフィル',
      '• PDFサムネイル表示 + Downloadで再配布を効率化',
      '• Docs Folder件数は実ファイル数ベースで表示',
    ].join('\n'),
    {
      x: 0.75,
      y: 2.05,
      w: 6.2,
      h: 5.5,
      fontFace: 'Meiryo',
      fontSize: 12.5,
      color: '334155',
      breakLine: true,
      valign: 'top',
    }
  )

  slide.addImage({
    path: assets.management,
    x: 7.73,
    y: 1.45,
    w: 3.35,
    h: 5.7,
  })
  slide.addText('管理画面 最新UI', {
    x: 7.73,
    y: 7.2,
    w: 3.35,
    h: 0.3,
    fontFace: 'Meiryo',
    fontSize: 10,
    align: 'center',
    color: '64748B',
  })
}

addScreenshotSlide({
  title: '画面7: 設定画面',
  subtitle: '通知先メールなどの運用設定',
  imagePath: assets.settings,
  note: 'ポイント: 通知ベンダー/部品発注送信先を一元管理',
})

// Slide 9: Auto document generation
{
  const slide = pptx.addSlide()
  addSlideTitle(slide, '業務用文書の自動作成機能', '部品発注データから帳票(PDF)を自動生成')
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.45,
    y: 1.3,
    w: 7.2,
    h: 6.3,
    rectRadius: 0.08,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addImage({
    path: assets.poPreview,
    x: 0.62,
    y: 1.48,
    w: 6.84,
    h: 5.95,
  })
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 7.9,
    y: 1.3,
    w: 3.35,
    h: 6.3,
    rectRadius: 0.08,
    fill: { color: 'FFFFFF' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addText(
    '処理内容\n\n• 部品情報を自動整形\n• 注文番号を自動採番\n• A4帳票(PDF)を自動生成\n• 業務連絡・保存にそのまま利用可能',
    {
      x: 8.15,
      y: 1.7,
      w: 2.9,
      h: 5.5,
      fontFace: 'Meiryo',
      fontSize: 14,
      color: '334155',
      breakLine: true,
    }
  )
}

// Slide 10: Hardware map
{
  const slide = pptx.addSlide()
  addSlideTitle(slide, 'ハードウェア接続マップ', '顧客iPhone・管理PC・クラウド(MainT-AI fujimak ver)の連携')
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.45,
    y: 1.2,
    w: 10.8,
    h: 6.6,
    rectRadius: 0.08,
    fill: { color: 'F8FAFC' },
    line: { color: 'CBD5E1', pt: 1 },
  })
  slide.addImage({ path: assets.cloud, x: 4.43, y: 1.5, w: 2.8, h: 2.8 })
  slide.addText('クラウドシステム\n[MainT-AI fujimak ver]', {
    x: 4.23,
    y: 4.2,
    w: 3.2,
    h: 0.75,
    fontFace: 'Meiryo',
    fontSize: 12,
    bold: true,
    color: '0F172A',
    align: 'center',
    breakLine: true,
  })

  slide.addImage({ path: assets.iphone, x: 1.0, y: 4.9, w: 3.5, h: 2.1 })
  slide.addText('顧客（1名）\niPhone', {
    x: 1.0,
    y: 7.1,
    w: 3.5,
    h: 0.45,
    fontFace: 'Meiryo',
    fontSize: 12,
    bold: true,
    color: '0F172A',
    align: 'center',
    breakLine: true,
  })

  slide.addImage({ path: assets.pc, x: 7.1, y: 4.9, w: 3.6, h: 2.1 })
  slide.addText('カウンターメイン管理PC\n（1台）', {
    x: 7.1,
    y: 7.1,
    w: 3.6,
    h: 0.45,
    fontFace: 'Meiryo',
    fontSize: 12,
    bold: true,
    color: '0F172A',
    align: 'center',
    breakLine: true,
  })

  slide.addText('データ送信 ↑', {
    x: 2.6,
    y: 4.55,
    w: 1.8,
    h: 0.25,
    fontFace: 'Meiryo',
    fontSize: 10,
    color: COLORS.accent,
    bold: true,
  })
  slide.addShape(pptx.ShapeType.line, {
    x: 3.15,
    y: 4.8,
    w: 1.65,
    h: -1.2,
    line: { color: COLORS.accent, pt: 2 },
  })
  slide.addText('情報共有 ↓', {
    x: 7.2,
    y: 4.55,
    w: 1.8,
    h: 0.25,
    fontFace: 'Meiryo',
    fontSize: 10,
    color: COLORS.accent,
    bold: true,
  })
  slide.addShape(pptx.ShapeType.line, {
    x: 7.95,
    y: 4.8,
    w: -1.4,
    h: -1.2,
    line: { color: COLORS.accent, pt: 2 },
  })
}

// Slide 11: Closing
{
  const slide = pptx.addSlide()
  addSlideTitle(slide, '導入メリット（まとめ）', '初心者でも運用しやすい保守管理フロー')
  slide.addText(
    '1. 依頼入力の標準化（AI補助で記載漏れを削減）\n2. 写真/動画付きで状況共有しやすい\n3. 履歴と管理画面で対応漏れを防止\n4. 帳票(PDF)の自動作成で業務を効率化',
    {
      x: 0.9,
      y: 1.9,
      w: 10.0,
      h: 2.2,
      fontFace: 'Meiryo',
      fontSize: 20,
      color: '0F172A',
      breakLine: true,
    }
  )
  slide.addImage({ path: assets.cloud, x: 4.6, y: 4.4, w: 2.5, h: 2.5 })
  slide.addText('ご清聴ありがとうございました', {
    x: 0.5,
    y: 7.25,
    w: 10.69,
    h: 0.5,
    align: 'center',
    fontFace: 'Meiryo',
    fontSize: 24,
    bold: true,
    color: COLORS.accent,
  })
}

pptx.writeFile({ fileName: outputPath }).then(() => {
  // eslint-disable-next-line no-console
  console.log(`PPT generated: ${outputPath}`)
})
