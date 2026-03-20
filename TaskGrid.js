// ==========================================
// 設定・カラーパレット
// ==========================================
const TARGET_LIST_NAME = "";

const COLOR_ACCENT   = new Color("#30d158");   // 緑（完了）
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
  widget.setPadding(8, 20, 8, 20);

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
  const doneYest   = cntDone(d => isSameDay(d, yesterday));
  const diffDay    = (doneToday + dueToday) - doneYest;

  // 今月
  const doneMonth  = cntDone(d => isSameMonth(d, curYear, curMonth));
  const dueMonth   = cntDue (d => isSameMonth(d, curYear, curMonth));
  const lmY = lastMonthD.getFullYear(), lmM = lastMonthD.getMonth();
  const doneLM     = cntDone(d => isSameMonth(d, lmY, lmM));
  const dueLM      = cntDue (d => isSameMonth(d, lmY, lmM));
  const diffMonth  = (doneMonth + dueMonth) - (doneLM + dueLM);

  // 今年
  const doneYear   = cntDone(d => isSameYear(d, curYear));
  const dueYear    = cntDue (d => isSameYear(d, curYear));
  const doneLY     = cntDone(d => isSameYear(d, lastYear));
  const dueLY      = cntDue (d => isSameYear(d, lastYear));
  const diffYear   = (doneYear + dueYear) - (doneLY + dueLY);

  // 過去7日の完了数（バーチャート用）
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

  widget.addSpacer(3);

  // ── ドーナツ統計行：今日 | 今月 | 今年 ──
  const statsRow = widget.addStack();
  statsRow.layoutHorizontally();
  statsRow.centerAlignContent();

  addDonutColumn(statsRow, "今日", doneToday, dueToday, diffDay,   "昨日比");
  addColumnDivider(statsRow);
  addDonutColumn(statsRow, "今月", doneMonth, dueMonth, diffMonth, "先月比");
  addColumnDivider(statsRow);
  addDonutColumn(statsRow, "今年", doneYear,  dueYear,  diffYear,  "昨年比");

  widget.addSpacer(4);
  addHorizontalLine(widget);
  widget.addSpacer(3);

  // ── バーチャート：過去7日の完了タスク ──
  const chartHeader = widget.addStack();
  const chartLabel  = chartHeader.addText("完了タスク（過去7日）");
  chartLabel.font   = Font.systemFont(8);
  chartLabel.textColor = COLOR_SUB_TEXT;
  chartHeader.addSpacer();
  widget.addSpacer(3);

  const chartImage = drawBarChart(dailyCounts, 286, 36);
  const chartView  = widget.addImage(chartImage);
  chartView.resizable = false;

  return widget;
}

// --------------------------------------------------
// ドーナツカラム
// --------------------------------------------------
const DONUT_SIZE = 44;

function addDonutColumn(container, period, done, due, diff, diffLabel) {
  const wrapper = container.addStack();
  wrapper.layoutVertically();
  wrapper.size = new Size(86, 0);

  // 期間ラベル（上部）
  addCentered(wrapper, period, Font.semiboldSystemFont(9), COLOR_SUB_TEXT);
  wrapper.addSpacer(2);

  // ドーナツグラフ（中央）
  const donutRow = wrapper.addStack();
  donutRow.addSpacer();
  const imgView   = donutRow.addImage(drawDonutChart(done, due, DONUT_SIZE));
  imgView.imageSize = new Size(DONUT_SIZE, DONUT_SIZE);
  imgView.resizable = false;
  donutRow.addSpacer();

  wrapper.addSpacer(3);

  // 総数 + 差分（下部）
  const subStack = wrapper.addStack();
  subStack.layoutHorizontally();
  subStack.addSpacer();

  const total  = done + due;
  const sign   = diff > 0 ? "+" : "";
  const dColor = diff > 0 ? COLOR_ACCENT : diff < 0 ? COLOR_MINUS : COLOR_SUB_TEXT;

  const tTotal = subStack.addText(`${total}`);
  tTotal.font      = Font.systemFont(9);
  tTotal.textColor = COLOR_MAIN_VAL;

  const tSep = subStack.addText("  ");
  tSep.font      = Font.systemFont(9);
  tSep.textColor = COLOR_SUB_TEXT;

  const tDiff = subStack.addText(`${sign}${diff}`);
  tDiff.font      = Font.systemFont(9);
  tDiff.textColor = dColor;

  subStack.addSpacer();
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
// ドーナツグラフ描画（DrawContext）
// --------------------------------------------------
function drawDonutChart(done, due, size) {
  const ctx = new DrawContext();
  ctx.size               = new Size(size, size);
  ctx.opaque             = false;
  ctx.respectScreenScale = true;

  const center = new Point(size / 2, size / 2);
  const outerR = size / 2 - 0.5;
  const innerR = outerR * 0.60;   // ドーナツの穴の割合
  const total  = done + due;

  if (total === 0) {
    // タスクなし：グレーの輪のみ
    const p = new Path();
    p.addEllipse(new Rect(0.5, 0.5, size - 1, size - 1));
    ctx.addPath(p);
    ctx.setFillColor(new Color("#2c2c2e"));
    ctx.fillPath();
  } else {
    const startAngle = -(Math.PI / 2); // 12時の位置から開始（時計回り）

    // 完了タスク（緑）
    if (done > 0) {
      const doneEndAngle = startAngle + (done / total) * 2 * Math.PI;
      const p = new Path();
      p.move(center);
      p.addArc(center, outerR, startAngle, doneEndAngle, true);
      p.closeSubpath();
      ctx.addPath(p);
      ctx.setFillColor(COLOR_ACCENT);
      ctx.fillPath();
    }

    // 残りタスク（青）
    if (due > 0) {
      const dueStartAngle = startAngle + (done / total) * 2 * Math.PI;
      const p = new Path();
      p.move(center);
      p.addArc(center, outerR, dueStartAngle, startAngle + 2 * Math.PI, true);
      p.closeSubpath();
      ctx.addPath(p);
      ctx.setFillColor(COLOR_DUE);
      ctx.fillPath();
    }
  }

  // 中心をくり抜いてドーナツ形状に
  const hole = new Path();
  hole.addEllipse(new Rect(
    size / 2 - innerR, size / 2 - innerR,
    innerR * 2, innerR * 2
  ));
  ctx.addPath(hole);
  ctx.setFillColor(COLOR_BG);
  ctx.fillPath();

  // 中央テキスト：残りタスク数
  const label    = `${due}`;
  const fontSize = label.length >= 4 ? 9 : label.length === 3 ? 11 : label.length === 2 ? 13 : 15;
  ctx.setFont(Font.boldSystemFont(fontSize));
  ctx.setTextColor(due > 0 ? COLOR_DUE : new Color("#8e8e93", 0.6));
  ctx.setTextAlignedCenter();
  const tH = fontSize + 3;
  ctx.drawTextInRect(label, new Rect(0, size / 2 - tH / 2, size, tH));

  return ctx.getImage();
}

// --------------------------------------------------
// バーチャート描画（DrawContext）
// --------------------------------------------------
function drawBarChart(data, width, height) {
  const ctx = new DrawContext();
  ctx.size               = new Size(width, height);
  ctx.opaque             = false;
  ctx.respectScreenScale = true;

  const n        = data.length;
  const LABEL_H  = 11;
  const NUM_H    = 9;
  const chartH   = height - LABEL_H;
  const maxVal   = Math.max(...data.map(d => d.count), 1);
  const slotW    = width / n;
  const barW     = Math.floor(slotW * 0.55);
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  for (let i = 0; i < n; i++) {
    const { date, count } = data[i];
    const isToday = i === n - 1;
    const bx      = Math.floor(i * slotW + (slotW - barW) / 2);

    const maxBarH = chartH - NUM_H - 2;
    const barH    = count > 0 ? Math.max(Math.round((count / maxVal) * maxBarH), 2) : 0;
    const by      = chartH - barH;

    // バー
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
  d.size            = new Size(1, 58);
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
