import pptxgen from 'pptxgenjs';
import fs from 'fs';
import path from 'path';

// Create presentation
const pptx = new pptxgen();

// Set presentation properties
pptx.author = 'LIFESUPPORT (HK) LIMITED';
pptx.title = '壽司郎香港 店舗メンテナンス管理システム';
pptx.subject = '提案書';
pptx.company = 'LIFESUPPORT (HK) LIMITED';

// Define font
const FONT = 'Meiryo';

// Define colors - Clean & Simple
const SUSHIRO_RED = 'C41E3A';
const WHITE = 'FFFFFF';
const BLACK = '333333';
const GRAY = '666666';
const LIGHT_GRAY = 'F5F5F5';
const GREEN = '4CAF50';

// Slide 1: Title
let slide1 = pptx.addSlide();
slide1.background = { color: WHITE };
// Red header bar
slide1.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: 1.2, fill: { color: SUSHIRO_RED }
});
slide1.addText('店舗メンテナンス管理システム', {
  x: 0.5, y: 2.2, w: '95%', h: 1,
  fontSize: 40, bold: true, color: BLACK,
  align: 'center', fontFace: FONT
});
slide1.addText('Store Maintenance Management Platform', {
  x: 0.5, y: 3.2, w: '95%', h: 0.6,
  fontSize: 20, color: GRAY,
  align: 'center', fontFace: FONT
});
slide1.addText('壽司郎香港 全40店舗 一元管理プラットフォーム構築のご提案', {
  x: 0.5, y: 4.3, w: '95%', h: 0.5,
  fontSize: 16, color: BLACK,
  align: 'center', fontFace: FONT
});
slide1.addText('LIFESUPPORT (HK) LIMITED', {
  x: 0.5, y: 6.5, w: '95%', h: 0.3,
  fontSize: 12, color: GRAY,
  align: 'center', fontFace: FONT
});

// Slide 2: DX Vision
let slide2 = pptx.addSlide();
slide2.background = { color: WHITE };
slide2.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: 1.0, fill: { color: SUSHIRO_RED }
});
slide2.addText('FOOD & LIFE COMPANIES DX戦略との整合', {
  x: 0.3, y: 0.25, w: '95%', h: 0.5,
  fontSize: 24, bold: true, color: WHITE, fontFace: FONT
});

slide2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.3, w: 9, h: 1.2, fill: { color: LIGHT_GRAY }, line: { color: 'DDDDDD', width: 1 }
});
slide2.addText('「デジタルを活用し、社内のシステムユーザーや消費者が認識していない課題解決を行い、新規ビジネスモデルの構築を進める」', {
  x: 0.7, y: 1.4, w: 8.6, h: 0.7,
  fontSize: 13, color: BLACK, italic: true, fontFace: FONT
});
slide2.addText('— FOOD & LIFE COMPANIES DX方針より', {
  x: 0.7, y: 2.1, w: 8.6, h: 0.3,
  fontSize: 10, color: GRAY, fontFace: FONT
});

// DX Keywords
const keywords = [
  { title: '社外パートナー連携', desc: '設備業者とのリアルタイムな\n情報共有プラットフォーム構築' },
  { title: '業務効率化', desc: 'メンテナンス依頼から完了まで\n全プロセスのデジタル化' },
  { title: '店舗オペレーション最適化', desc: '全店舗の設備状況を\n一元管理・可視化' }
];

keywords.forEach((kw, i) => {
  slide2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5 + i * 3.2, y: 2.8, w: 3, h: 2.5, fill: { color: WHITE }, line: { color: SUSHIRO_RED, width: 2 }
  });
  slide2.addText(kw.title, { x: 0.5 + i * 3.2, y: 3.0, w: 3, h: 0.5, fontSize: 13, bold: true, align: 'center', color: SUSHIRO_RED, fontFace: FONT });
  slide2.addText(kw.desc, { x: 0.6 + i * 3.2, y: 3.6, w: 2.8, h: 1.5, fontSize: 11, align: 'center', color: BLACK, fontFace: FONT });
});

// Slide 3: Current Issues (Before/After)
let slide3 = pptx.addSlide();
slide3.background = { color: WHITE };
slide3.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: 1.0, fill: { color: SUSHIRO_RED }
});
slide3.addText('現状の課題と解決策', {
  x: 0.3, y: 0.25, w: '95%', h: 0.5,
  fontSize: 24, bold: true, color: WHITE, fontFace: FONT
});

// Before
slide3.addText('Before', {
  x: 0.5, y: 1.2, w: 4.3, h: 0.5,
  fontSize: 18, bold: true, color: 'E53935', fontFace: FONT
});
const beforeItems = [
  '各店舗が個別に業者へ電話連絡',
  'メンテナンス状況が店舗ごとに分散',
  '紙ベースでの記録・報告',
  '日程調整は電話でのやり取り'
];
beforeItems.forEach((item, i) => {
  slide3.addText('✗ ' + item, {
    x: 0.5, y: 1.8 + i * 0.6, w: 4.3, h: 0.5,
    fontSize: 12, color: BLACK, fontFace: FONT
  });
});

// After
slide3.addText('After', {
  x: 5.2, y: 1.2, w: 4.3, h: 0.5,
  fontSize: 18, bold: true, color: GREEN, fontFace: FONT
});
const afterItems = [
  'アプリから統一フォーマットで依頼',
  '管理画面で全40店舗を一元管理',
  'デジタルで履歴管理・検索可能',
  'アプリ内で日程調整・承認'
];
afterItems.forEach((item, i) => {
  slide3.addText('✓ ' + item, {
    x: 5.2, y: 1.8 + i * 0.6, w: 4.3, h: 0.5,
    fontSize: 12, color: BLACK, fontFace: FONT
  });
});

// Arrow
slide3.addText('→', {
  x: 4.5, y: 2.5, w: 0.6, h: 0.8,
  fontSize: 36, color: SUSHIRO_RED, align: 'center', fontFace: FONT
});

// Slide 4: System Overview with Screenshots
let slide4 = pptx.addSlide();
slide4.background = { color: WHITE };
slide4.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: 1.0, fill: { color: SUSHIRO_RED }
});
slide4.addText('システム概要', {
  x: 0.3, y: 0.25, w: '95%', h: 0.5,
  fontSize: 24, bold: true, color: WHITE, fontFace: FONT
});

// Dashboard image
const imgPath = path.join(process.cwd(), 'public', 'presentation');
slide4.addImage({
  path: path.join(imgPath, 'dashboard.png'),
  x: 0.5, y: 1.2, w: 2.5, h: 4.5
});
slide4.addText('ダッシュボード', {
  x: 0.5, y: 5.8, w: 2.5, h: 0.3,
  fontSize: 11, bold: true, color: BLACK, align: 'center', fontFace: FONT
});

// Maintenance image
slide4.addImage({
  path: path.join(imgPath, 'maintenance.png'),
  x: 3.3, y: 1.2, w: 2.5, h: 4.5
});
slide4.addText('メンテナンスコール', {
  x: 3.3, y: 5.8, w: 2.5, h: 0.3,
  fontSize: 11, bold: true, color: BLACK, align: 'center', fontFace: FONT
});

// Management image
slide4.addImage({
  path: path.join(imgPath, 'management.png'),
  x: 6.1, y: 1.2, w: 3.4, h: 2.8
});
slide4.addText('管理者ダッシュボード', {
  x: 6.1, y: 4.1, w: 3.4, h: 0.3,
  fontSize: 11, bold: true, color: BLACK, align: 'center', fontFace: FONT
});

// Stores image
slide4.addImage({
  path: path.join(imgPath, 'stores.png'),
  x: 6.1, y: 4.5, w: 2.2, h: 1.5
});
slide4.addText('店舗選択', {
  x: 6.1, y: 6.05, w: 2.2, h: 0.3,
  fontSize: 10, bold: true, color: BLACK, align: 'center', fontFace: FONT
});

// Slide 5: Features
let slide5 = pptx.addSlide();
slide5.background = { color: WHITE };
slide5.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: 1.0, fill: { color: SUSHIRO_RED }
});
slide5.addText('主要機能', {
  x: 0.3, y: 0.25, w: '95%', h: 0.5,
  fontSize: 24, bold: true, color: WHITE, fontFace: FONT
});

const features = [
  { title: 'メンテナンスコール', items: ['6ステップで簡単依頼', '43種類のメンテナンス項目', '写真添付機能', 'カレンダーで日程指定'] },
  { title: '管理者ダッシュボード', items: ['全40店舗を一覧表示', 'ガントチャートカレンダー', 'ステータス別フィルター', '無限スクロール対応'] },
  { title: '多言語対応', items: ['日本語', '繁體中文', 'English', '言語切替ワンタップ'] }
];

features.forEach((feat, i) => {
  slide5.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5 + i * 3.2, y: 1.2, w: 3, h: 4.5, fill: { color: LIGHT_GRAY }, line: { color: 'DDDDDD', width: 1 }
  });
  slide5.addText(feat.title, { x: 0.5 + i * 3.2, y: 1.4, w: 3, h: 0.5, fontSize: 14, bold: true, align: 'center', color: SUSHIRO_RED, fontFace: FONT });
  feat.items.forEach((item, j) => {
    slide5.addText('• ' + item, { x: 0.7 + i * 3.2, y: 2.0 + j * 0.6, w: 2.6, h: 0.5, fontSize: 11, color: BLACK, fontFace: FONT });
  });
});

// Slide 6: Coverage
let slide6 = pptx.addSlide();
slide6.background = { color: WHITE };
slide6.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: 1.0, fill: { color: SUSHIRO_RED }
});
slide6.addText('対象店舗', {
  x: 0.3, y: 0.25, w: '95%', h: 0.5,
  fontSize: 24, bold: true, color: WHITE, fontFace: FONT
});

// Big numbers
slide6.addText('40', { x: 0.5, y: 1.5, w: 3, h: 1.5, fontSize: 72, bold: true, color: SUSHIRO_RED, fontFace: FONT });
slide6.addText('店舗', { x: 0.5, y: 2.8, w: 3, h: 0.5, fontSize: 24, color: BLACK, fontFace: FONT });
slide6.addText('香港全域', { x: 0.5, y: 3.3, w: 3, h: 0.4, fontSize: 14, color: GRAY, fontFace: FONT });

slide6.addText('43', { x: 0.5, y: 4.2, w: 3, h: 1.5, fontSize: 72, bold: true, color: SUSHIRO_RED, fontFace: FONT });
slide6.addText('種類', { x: 0.5, y: 5.5, w: 3, h: 0.5, fontSize: 24, color: BLACK, fontFace: FONT });
slide6.addText('メンテナンス項目', { x: 0.5, y: 6.0, w: 3, h: 0.4, fontSize: 14, color: GRAY, fontFace: FONT });

// Region breakdown
const regions = [
  { name: '新界', count: 20 },
  { name: '九龍', count: 16 },
  { name: '香港島', count: 4 }
];

slide6.addText('地区別内訳', { x: 5, y: 1.5, w: 4.5, h: 0.5, fontSize: 16, bold: true, color: BLACK, fontFace: FONT });

regions.forEach((r, i) => {
  slide6.addText(r.name, { x: 5, y: 2.2 + i * 1.0, w: 1.5, h: 0.5, fontSize: 14, color: BLACK, fontFace: FONT });
  slide6.addShape(pptx.shapes.RECTANGLE, {
    x: 6.5, y: 2.2 + i * 1.0, w: 3, h: 0.5, fill: { color: 'EEEEEE' }
  });
  slide6.addShape(pptx.shapes.RECTANGLE, {
    x: 6.5, y: 2.2 + i * 1.0, w: 3 * (r.count / 20), h: 0.5, fill: { color: SUSHIRO_RED }
  });
  slide6.addText(`${r.count}店舗`, {
    x: 6.5, y: 2.2 + i * 1.0, w: 3 * (r.count / 20), h: 0.5,
    fontSize: 12, bold: true, color: WHITE, align: 'right', valign: 'middle', fontFace: FONT
  });
});

// Slide 7: Partners
let slide7 = pptx.addSlide();
slide7.background = { color: WHITE };
slide7.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: 1.0, fill: { color: SUSHIRO_RED }
});
slide7.addText('連携パートナー', {
  x: 0.3, y: 0.25, w: '95%', h: 0.5,
  fontSize: 24, bold: true, color: WHITE, fontFace: FONT
});

// Partner cards
slide7.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.8, y: 1.5, w: 4, h: 3.5, fill: { color: LIGHT_GRAY }, line: { color: 'DDDDDD', width: 1 }
});
slide7.addText('LIFESUPPORT (HK) LIMITED', {
  x: 0.8, y: 2.0, w: 4, h: 0.6,
  fontSize: 16, bold: true, color: BLACK, align: 'center', fontFace: FONT
});
slide7.addText('総合設備メンテナンス\n電気・空調・給排水・内装など\n幅広い設備に対応', {
  x: 0.8, y: 2.8, w: 4, h: 1.5,
  fontSize: 12, color: GRAY, align: 'center', fontFace: FONT
});

slide7.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 5.2, y: 1.5, w: 4, h: 3.5, fill: { color: LIGHT_GRAY }, line: { color: 'DDDDDD', width: 1 }
});
slide7.addText('Fujimak', {
  x: 5.2, y: 2.0, w: 4, h: 0.6,
  fontSize: 16, bold: true, color: BLACK, align: 'center', fontFace: FONT
});
slide7.addText('厨房機器メンテナンス\n寿司レーン・冷蔵設備など\n専門機器に対応', {
  x: 5.2, y: 2.8, w: 4, h: 1.5,
  fontSize: 12, color: GRAY, align: 'center', fontFace: FONT
});

// Slide 8: Schedule
let slide8 = pptx.addSlide();
slide8.background = { color: WHITE };
slide8.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: 1.0, fill: { color: SUSHIRO_RED }
});
slide8.addText('導入スケジュール（案）', {
  x: 0.3, y: 0.25, w: '95%', h: 0.5,
  fontSize: 24, bold: true, color: WHITE, fontFace: FONT
});

// Phase 1
slide8.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.3, w: 4.2, h: 4.5, fill: { color: WHITE }, line: { color: SUSHIRO_RED, width: 2 }
});
slide8.addText('Phase 1', {
  x: 0.5, y: 1.5, w: 4.2, h: 0.5,
  fontSize: 18, bold: true, color: SUSHIRO_RED, align: 'center', fontFace: FONT
});
slide8.addText('パイロット導入', {
  x: 0.5, y: 2.0, w: 4.2, h: 0.4,
  fontSize: 14, color: BLACK, align: 'center', fontFace: FONT
});
slide8.addText('期間: 1〜2ヶ月', {
  x: 0.5, y: 2.5, w: 4.2, h: 0.3,
  fontSize: 11, color: GRAY, align: 'center', fontFace: FONT
});
slide8.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.7, y: 3.0, w: 3.8, h: 0.5, fill: { color: LIGHT_GRAY }
});
slide8.addText('対象: 5店舗（新界エリア選抜）', {
  x: 0.7, y: 3.0, w: 3.8, h: 0.5,
  fontSize: 11, bold: true, color: BLACK, align: 'center', valign: 'middle', fontFace: FONT
});
slide8.addText('• システム検証\n• フィードバック収集\n• マニュアル作成\n• 業者連携テスト', {
  x: 0.7, y: 3.7, w: 3.8, h: 2,
  fontSize: 11, color: BLACK, fontFace: FONT
});

// Arrow
slide8.addText('→', {
  x: 4.7, y: 3.2, w: 0.6, h: 0.6,
  fontSize: 36, color: SUSHIRO_RED, align: 'center', fontFace: FONT
});

// Phase 2
slide8.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 5.3, y: 1.3, w: 4.2, h: 4.5, fill: { color: WHITE }, line: { color: SUSHIRO_RED, width: 2 }
});
slide8.addText('Phase 2', {
  x: 5.3, y: 1.5, w: 4.2, h: 0.5,
  fontSize: 18, bold: true, color: SUSHIRO_RED, align: 'center', fontFace: FONT
});
slide8.addText('全店展開', {
  x: 5.3, y: 2.0, w: 4.2, h: 0.4,
  fontSize: 14, color: BLACK, align: 'center', fontFace: FONT
});
slide8.addText('期間: 2〜3ヶ月', {
  x: 5.3, y: 2.5, w: 4.2, h: 0.3,
  fontSize: 11, color: GRAY, align: 'center', fontFace: FONT
});
slide8.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 5.5, y: 3.0, w: 3.8, h: 0.5, fill: { color: LIGHT_GRAY }
});
slide8.addText('対象: 全40店舗', {
  x: 5.5, y: 3.0, w: 3.8, h: 0.5,
  fontSize: 11, bold: true, color: BLACK, align: 'center', valign: 'middle', fontFace: FONT
});
slide8.addText('• 全店舗への導入・研修\n• 本格運用開始\n• 効果測定・KPI設定\n• 継続的改善', {
  x: 5.5, y: 3.7, w: 3.8, h: 2,
  fontSize: 11, color: BLACK, fontFace: FONT
});

// Slide 9: Benefits
let slide9 = pptx.addSlide();
slide9.background = { color: WHITE };
slide9.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: 1.0, fill: { color: SUSHIRO_RED }
});
slide9.addText('期待される効果', {
  x: 0.3, y: 0.25, w: '95%', h: 0.5,
  fontSize: 24, bold: true, color: WHITE, fontFace: FONT
});

const benefits = [
  { title: '連絡調整工数削減', desc: '電話・メール不要' },
  { title: '全店舗可視化', desc: 'リアルタイム管理' },
  { title: 'データ活用', desc: '傾向分析・予防保全' },
  { title: '対応スピード向上', desc: '写真付き即時共有' },
  { title: 'コスト最適化', desc: '重複発注防止' },
  { title: '言語バリア解消', desc: '3言語対応' }
];

benefits.forEach((b, i) => {
  const x = (i % 3) * 3.2 + 0.5;
  const y = i < 3 ? 1.3 : 3.8;
  
  slide9.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x, y: y, w: 3, h: 2, fill: { color: LIGHT_GRAY }, line: { color: 'DDDDDD', width: 1 }
  });
  slide9.addText(b.title, { x: x, y: y + 0.4, w: 3, h: 0.5, fontSize: 14, bold: true, align: 'center', color: SUSHIRO_RED, fontFace: FONT });
  slide9.addText(b.desc, { x: x, y: y + 1.0, w: 3, h: 0.5, fontSize: 12, align: 'center', color: BLACK, fontFace: FONT });
});

// Slide 10: Closing
let slide10 = pptx.addSlide();
slide10.background = { color: WHITE };
slide10.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: '100%', fill: { color: SUSHIRO_RED }
});
slide10.addText('ご清聴ありがとうございました', {
  x: 0.5, y: 2.5, w: '95%', h: 1,
  fontSize: 36, bold: true, color: WHITE, align: 'center', fontFace: FONT
});
slide10.addText('FOOD & LIFE COMPANIESのDX戦略に則り\n店舗オペレーションの最適化・自動化を実現する\nメンテナンス管理プラットフォームをご提案いたします', {
  x: 0.5, y: 3.8, w: '95%', h: 1.5,
  fontSize: 16, color: WHITE, align: 'center', fontFace: FONT
});
slide10.addText('LIFESUPPORT (HK) LIMITED', {
  x: 0.5, y: 5.8, w: '95%', h: 0.5,
  fontSize: 18, bold: true, color: WHITE, align: 'center', fontFace: FONT
});

// Save the presentation
const outputPath = path.join(process.cwd(), 'public', 'presentation', 'sushiro_maintenance_proposal.pptx');
pptx.writeFile({ fileName: outputPath })
  .then(() => {
    console.log(`✅ PPTX file created: ${outputPath}`);
  })
  .catch(err => {
    console.error('Error creating PPTX:', err);
  });
