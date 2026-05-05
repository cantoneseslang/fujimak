#!/bin/bash
# ロゴファイル検証スクリプト
# 正規のスシローロゴかどうかをチェックサムで検証します

set -e

LOGO_PATH="public/images/logo.png"
EXPECTED_HASH="756edf01dde89bc21f7daef59b012c17272c8dc6c73ccf0cd5fc7ab4f041bff0"

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

if [ ! -f "$LOGO_PATH" ]; then
    echo "❌ エラー: ロゴファイルが見つかりません: $LOGO_PATH"
    exit 1
fi

# チェックサム計算
ACTUAL_HASH=$(shasum -a 256 "$LOGO_PATH" | awk '{print $1}')

if [ "$ACTUAL_HASH" = "$EXPECTED_HASH" ]; then
    echo "✅ ロゴファイル検証成功: 正規のスシローロゴです"
    exit 0
else
    echo ""
    echo "🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
    echo ""
    echo "❌ 重大エラー: ロゴファイルが正規のものではありません！"
    echo ""
    echo "期待されるハッシュ: $EXPECTED_HASH"
    echo "実際のハッシュ:     $ACTUAL_HASH"
    echo ""
    echo "⚠️  これは重大問題です！"
    echo "⚠️  正規のスシローロゴ以外のファイルが検出されました。"
    echo ""
    echo "正規のロゴファイルの場所:"
    echo "/Users/sakonhiroki/Library/CloudStorage/GoogleDrive-bestinksalesman@gmail.com/マイドライブ/KIRII/吉沢さん案件/スシロー/ロゴ・写真/Sushiro.png"
    echo ""
    echo "🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
    echo ""
    exit 1
fi
