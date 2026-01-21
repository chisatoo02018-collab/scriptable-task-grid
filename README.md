# Task Grid Widget for Scriptable

iOS Scriptableアプリ用のリマインダーダッシュボードウィジェットです。

## 概要

このウィジェットは、iOSのリマインダーアプリのタスク状況をダッシュボード形式で表示します。今日、今月、今年のタスク数と、前の期間との比較を一目で確認できます。

## 機能

- **今日の残りタスク数** - 今日期限のタスクを表示
- **今日の総タスク数** - 今日完了したタスクと残りタスクの合計
- **昨日比** - 昨日との差分を表示
- **今月の残りタスク数** - 今月期限のタスクを表示
- **今月の総タスク数** - 今月のタスク総数
- **先月比** - 先月との差分を表示
- **今年の残りタスク数** - 今年期限のタスクを表示
- **今年の総タスク数** - 今年のタスク総数
- **昨年比** - 昨年との差分を表示

## セットアップ

1. iOSデバイスに[Scriptable](https://scriptable.app/)アプリをインストール
2. `TaskGrid.js`の内容をScriptableアプリにコピー
3. ホーム画面でウィジェット追加 > Scriptable > Mediumサイズを選択
4. ウィジェットをタップして設定 > 作成したスクリプトを選択

## カスタマイズ

`TaskGrid.js`の先頭部分で以下の設定が可能です:

```javascript
const TARGET_LIST_NAME = ""; // 特定のリマインダーリストを指定（空白の場合は全てのリスト）
```

カラーテーマも変更可能です:

```javascript
const COLOR_ACCENT = new Color("#30d158");   // プラス値の色
const COLOR_MINUS = new Color("#ff453a");    // マイナス値の色
const COLOR_MAIN_VAL = new Color("#ffffff"); // メイン数字の色
const COLOR_SUB_TEXT = new Color("#8e8e93"); // サブテキストの色
const COLOR_BG = new Color("#1c1c1e");       // 背景色
const COLOR_DUE = new Color("#0a84ff");      // 残りタスクの色
```

## 必要な権限

- リマインダーへのアクセス権限

## ライセンス

MIT License
