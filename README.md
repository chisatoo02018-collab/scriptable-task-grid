# Task Grid Widget for Scriptable

iOS Scriptableアプリ用のリマインダーダッシュボードウィジェットです。

## 概要

このウィジェットは、iOSのリマインダーアプリのタスク状況をダッシュボード形式で表示します。今日、今月、今年のタスク数と、前の期間との比較を一目で確認できます。

## 機能

- **タスクドーナツ（左上）** - 今日の完了/未完了タスクをドーナツチャートで表示。時刻指定・終日指定の内訳、完了率、前日比も確認できる
- **月次タスク折れ線グラフ（右上）** - 今年と前年の月別完了タスク数を折れ線で比較表示
- **消費時間ゲージ（左下）** - 今月の残り時間と寿命換算の消費割合をリングゲージで表示
- **日次タスクバーグラフ（右下）** - 直近7日間の日別タスク完了数をバーグラフで表示

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
const COLOR_DUE = new Color("#007AFF");      // 残りタスク・ゲージトラックの色
```

## 必要な権限

- リマインダーへのアクセス権限

## ライセンス

MIT License
