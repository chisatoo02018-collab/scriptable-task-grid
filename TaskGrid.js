// ==========================================
// 設定・カラーパレット
// ==========================================
const TARGET_LIST_NAME = "";

// カラー設定
const COLOR_ACCENT   = new Color("#30d158");   // 緑（プラス）
const COLOR_MINUS    = new Color("#ff453a");    // 赤（マイナス）
const COLOR_MAIN_VAL = new Color("#ffffff");    // メイン数字
const COLOR_SUB_TEXT = new Color("#8e8e93");    // サブテキスト
const COLOR_BG       = new Color("#1c1c1e");    // 背景
const COLOR_DUE      = new Color("#0a84ff");    // 残りタスク（青）
const COLOR_DIVIDER  = new Color("#3a3a3c");    // 区切り線

// ==========================================

if (config.runsInWidget) {
  let widget = await createWidget();
  Script.setWidget(widget);
} else {
  let widget = await createWidget();
  widget.presentMedium();
}
Script.complete();

// --------------------------------------------------
// 日付ヘルパー（グローバルスコープ）
// --------------------------------------------------
function isSameDay(d, t) {
  return d.getDate()     === t.getDate()
      && d.getMonth()    === t.getMonth()
      && d.getFullYear() === t.getFullYear();
}
function isSameMonth(d, y, m) { return d.getMonth() === m && d.getFullYear() === y; }
function isSameYear(d, y)     { return d.getFullYear() === y; }

// --------------------------------------------------
// メインウィジェット
// --------------------------------------------------
async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = COLOR_BG;
  widget.setPadding(10, 20, 8, 20);

  // --- データ取得 ---
  let calendars;
  if (TARGET_LIST_NAME) {
    calendars = [await Calendar.findList(TARGET_LIST_NAME)];
  }
  const incomplete = await Reminder.allIncomplete(calendars);
  const completed  = await Reminder.allCompleted(calendars);

  // --- 日付 ---
  const now        = new Date();
  const curYear    = now.getFullYear();
  const curMonth   = now.getMonth();
  const yesterday  = new Date(now); yesterday.setDate(now.getDate() - 1);
  const lastMonthD = new Date(curYear, curMonth - 1, 1);
  const lastYear   = curYear - 1;

  // --- 集計ヘルパー ---
  const cntDone = (fn) => completed.filter(r => r.completionDate && fn(r.completionDate)).length;
  const cntDue  = (fn) => incomplete.filter(r => r.dueDate       && fn(r.dueDate)).length;

  // 今日
  const doneToday  = cntDone(d => isSameDay(d, now));
  const dueToday   = cntDue (d => isSameDay(d, now));
  const totalToday = doneToday + dueToday;
  const doneYest   = cntDone(d => isSameDay(d, yesterday));
  const diffDay    = totalToday - doneYest;

  // 今月
  const doneMonth  = cntDone(d => isSameMonth(d, curYear, curMonth));
  const dueMonth   = cntDue (d => isSameMonth(d, curYear, curMonth));
  const totalMonth = doneMonth + dueMonth;
  const lmY = lastMonthD.getFullYear(), lmM = lastMonthD.getMonth();
  const doneLM     = cntDone(d => isSameMonth(d, lmY, lmM));
  const dueLM      = cntDue (d => isSameMonth(d, lmY, lmM));
  const diffMonth  = totalMonth - (doneLM + dueLM);

  // 今年
  const doneYear  = cntDone(d => isSameYear(d, curYear));
  const dueYear   = cntDue (d => isSameYear(d, curYear));
  const totalYear = doneYear + dueYear;
  const doneLY    = cntDone(d => isSameYear(d, lastYear));
  const dueLY     = cntDue (d => isSameYear(d, lastYear));
  const diffYear  = totalYear - (doneLY + dueLY);

  // 過去7日の完了数（グラフ用）
  const DAYS = 7;
  const dailyCounts = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dailyCounts.push({ date: d, count: cntDone(cd => isSameDay(cd, d)) });
  }

  // ==================== 描画 ====================

  // ヘッダー
  const headerStack = widget.addStack();
  headerStack.centerAlignContent();
  const icon = headerStack.addImage(SFSymbol.named("square.grid.2x2.fill").image);
  icon.tintColor    = COLOR_DUE;
  icon.imageSize    = new Size(14, 14);
  headerStack.addSpacer(5);
  const titleText   = headerStack.addText("Task Grid");
  titleText.font    = Font.semiboldSystemFont(13);
  titleText.textColor = COLOR_MAIN_VAL;
  headerStack.addSpacer();

  widget.addSpacer(6);

  // ── 統計行：今日 | 今月 | 今年 ──
  const statsRow = widget.addStack();
  statsRow.layoutHorizontally();
  statsRow.centerAlignContent();

  addStatColumn(statsRow, "今日", dueToday,  totalToday, diffDay,   "昨日比");
  addColumnDivider(statsRow);
  addStatColumn(statsRow, "今月", dueMonth,  totalMonth, diffMonth, "先月比");
  addColumnDivider(statsRow);
  addStatColumn(statsRow, "今年", dueYear,   totalYear,  diffYear,  "昨年比");

  widget.addSpacer(6);
  addHorizontalLine(widget);
  widget.addSpacer(4);

  // ── 棒グラフ：過去7日の完了タスク ──
  const chartHeader = widget.addStack();
  chartHeader.centerAlignContent();
  const chartLabel  = chartHeader.addText("完了タスク（過去7日）");
  chartLabel.font   = Font.systemFont(8);
  chartLabel.textColor = COLOR_SUB_TEXT;
  chartHeader.addSpacer();

  widget.addSpacer(3);

  const chartImage = drawBarChart(dailyCounts, 286, 44);
  const chartView  = widget.addImage(chartImage);
  chartView.resizable = false;

  return widget;
}

// --------------------------------------------------
// 統計カラム（期間ラベル / 残り大 / 総数+差分）
// --------------------------------------------------
function addStatColumn(container, period, remaining, total, diff, diffLabel) {
  const wrapper = container.addStack();
  wrapper.layoutVertically();
  wrapper.size = new Size(86, 0);

  // 期間ラベル
  addCentered(wrapper, period, Font.semiboldSystemFont(9), COLOR_SUB_TEXT);
  wrapper.addSpacer(1);

  // 残り（大きく）
  addCentered(wrapper, `${remaining}`, Font.boldSystemFont(20), COLOR_DUE);

  // 総数 + 差分
  const subStack = wrapper.addStack();
  subStack.layoutHorizontally();
  subStack.addSpacer();

  const sign      = diff > 0 ? "+" : "";
  const diffColor = diff > 0 ? COLOR_ACCENT : diff < 0 ? COLOR_MINUS : COLOR_SUB_TEXT;

  const tTotal = subStack.addText(`${total}`);
  tTotal.font       = Font.systemFont(10);
  tTotal.textColor  = COLOR_MAIN_VAL;

  const tSep = subStack.addText("  ");
  tSep.font      = Font.systemFont(10);
  tSep.textColor = COLOR_SUB_TEXT;

  const tDiff = subStack.addText(`${sign}${diff}`);
  tDiff.font      = Font.systemFont(10);
  tDiff.textColor = diffColor;

  subStack.addSpacer();

  // 凡例ラベル
  wrapper.addSpacer(1);
  addCentered(wrapper, `総数  ${diffLabel}`, Font.systemFont(7), new Color("#8e8e93", 0.55));
}

function addCentered(container, text, font, color) {
  const s = container.addStack();
  s.addSpacer();
  const t = s.addText(text);
  t.font      = font;
  t.textColor = color;
  s.addSpacer();
}

// --------------------------------------------------
// バーチャート描画（DrawContext）
// --------------------------------------------------
function drawBarChart(data, width, height) {
  const ctx = new DrawContext();
  ctx.size              = new Size(width, height);
  ctx.opaque            = false;
  ctx.respectScreenScale = true;

  const n        = data.length;
  const LABEL_H  = 12;
  const NUM_H    = 10;
  const chartH   = height - LABEL_H;           // ラベル領域を除いた描画高さ
  const maxVal   = Math.max(...data.map(d => d.count), 1);
  const slotW    = width / n;
  const barW     = Math.floor(slotW * 0.55);
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  for (let i = 0; i < n; i++) {
    const { date, count } = data[i];
    const isToday = i === n - 1;

    // バー X 座標（スロット中央に配置）
    const bx = Math.floor(i * slotW + (slotW - barW) / 2);

    // バーの高さ（数字ラベル分の余白を確保）
    const maxBarH = chartH - NUM_H - 2;
    const barH    = count > 0 ? Math.max(Math.round((count / maxVal) * maxBarH), 2) : 0;
    const by      = chartH - barH;

    // バーを描画
    ctx.setFillColor(isToday ? COLOR_ACCENT : new Color("#30d158", 0.30));
    ctx.fillRect(new Rect(bx, by, barW, barH));

    // カウントラベル（バー上部）
    if (count > 0) {
      ctx.setFont(Font.systemFont(7));
      ctx.setTextColor(isToday ? COLOR_MAIN_VAL : new Color("#8e8e93", 0.75));
      ctx.setTextAlignedCenter();
      ctx.drawTextInRect(`${count}`, new Rect(i * slotW, Math.max(by - NUM_H, 0), slotW, NUM_H));
    }

    // 曜日ラベル（下端）
    ctx.setFont(Font.systemFont(8));
    ctx.setTextColor(isToday ? COLOR_MAIN_VAL : COLOR_SUB_TEXT);
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect(dayNames[date.getDay()], new Rect(i * slotW, chartH + 1, slotW, LABEL_H));
  }

  return ctx.getImage();
}

// --------------------------------------------------
// 区切り線
// --------------------------------------------------
function addColumnDivider(container) {
  container.addSpacer();
  const d = container.addStack();
  d.size            = new Size(1, 34);
  d.backgroundColor = COLOR_DIVIDER;
  container.addSpacer();
}

function addHorizontalLine(widget) {
  const s = widget.addStack();
  s.layoutHorizontally();
  s.addSpacer();
  const d = s.addStack();
  d.size            = new Size(280, 0.5);
  d.backgroundColor = COLOR_DIVIDER;
  d.alpha           = 0.5;
  s.addSpacer();
}
