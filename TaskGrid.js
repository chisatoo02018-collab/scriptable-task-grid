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
const DONUT_SIZE     = 44;                      // ドーナツグラフのサイズ（pt）

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

  // --- 集計ヘルパー ---
  const cntDone = (fn) => completed.filter(r => r.completionDate && fn(r.completionDate)).length;
  const cntDue  = (fn) => incomplete.filter(r => r.dueDate       && fn(r.dueDate)).length;

  // 今日
  const doneToday  = cntDone(d => isSameDay(d, now));
  const dueToday   = cntDue (d => isSameDay(d, now));
  const doneYest   = cntDone(d => isSameDay(d, yesterday));
  const diffDay    = (doneToday + dueToday) - doneYest;

  // 1〜12月の月別データ（今年 vs 前年、折れ線グラフ用）
  const prevYear   = curYear - 1;
  const monthlyData = [];
  for (let m = 0; m < 12; m++) {
    monthlyData.push({
      monthLabel: `${m + 1}月`,
      doneThis: cntDone(cd => isSameMonth(cd, curYear, m)),
      donePrev: cntDone(cd => isSameMonth(cd, prevYear, m))
    });
  }

  // 過去7日の完了数（バーチャート用）
  const DAYS = 7;
  const dailyCounts = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dailyCounts.push({ date: d, count: cntDone(cd => isSameDay(cd, d)) });
  }

  // ==================== 描画 ====================

  widget.addSpacer(2);

  // ── 統計行：今日ドーナツ | 折れ線グラフ（6ヶ月） ──
  const statsRow = widget.addStack();
  statsRow.layoutHorizontally();
  statsRow.centerAlignContent();

  addDonutColumn(statsRow, "今日", doneToday, dueToday, diffDay, "昨日比");
  statsRow.addSpacer(6);
  const statDiv = statsRow.addStack();
  statDiv.size = new Size(1, 62);
  statDiv.backgroundColor = COLOR_DIVIDER;
  statsRow.addSpacer(8);

  // 折れ線グラフ（月別）
  const lineCol = statsRow.addStack();
  lineCol.layoutVertically();

  const lineHeader = lineCol.addStack();
  lineHeader.layoutHorizontally();
  lineHeader.centerAlignContent();
  const lhLabel = lineHeader.addText("完了タスク（月別）");
  lhLabel.font = Font.systemFont(8);
  lhLabel.textColor = COLOR_SUB_TEXT;
  lineHeader.addSpacer(6);
  addLegendDot(lineHeader, COLOR_ACCENT, `${curYear}年`);
  lineHeader.addSpacer(4);
  addLegendDot(lineHeader, new Color("#636366"), `${prevYear}年`);
  lineHeader.addSpacer();

  lineCol.addSpacer(2);
  const lineImg = lineCol.addImage(drawLineChart(monthlyData, 185, 65, curMonth));
  lineImg.resizable = false;
  lineImg.imageSize = new Size(185, 65);

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
      fillArcSegment(ctx, center, outerR, startAngle, doneEndAngle, COLOR_ACCENT);
    }

    // 残りタスク（青）
    if (due > 0) {
      const dueStartAngle = startAngle + (done / total) * 2 * Math.PI;
      fillArcSegment(ctx, center, outerR, dueStartAngle, startAngle + 2 * Math.PI, COLOR_DUE);
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

// Path.addArc が使えないため、多角形で弧を近似して塗り潰す
function fillArcSegment(ctx, center, outerR, startAngle, endAngle, color) {
  const STEPS = 60;
  const step  = (endAngle - startAngle) / STEPS;
  const p = new Path();
  p.move(center);
  for (let i = 0; i <= STEPS; i++) {
    const a = startAngle + i * step;
    p.addLine(new Point(
      center.x + outerR * Math.cos(a),
      center.y + outerR * Math.sin(a)
    ));
  }
  p.closeSubpath();
  ctx.addPath(p);
  ctx.setFillColor(color);
  ctx.fillPath();
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
// 折れ線グラフ描画（DrawContext）
// --------------------------------------------------
// data: [{ monthLabel, doneThis, donePrev }] × 12
// curMonthIdx: 現在月（0-11）— 今年ラインはここで止める
function drawLineChart(data, width, height, curMonthIdx) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const n       = data.length;           // 12
  const LABEL_H = 12;
  const TOP_PAD = 4;
  const chartH  = height - LABEL_H - TOP_PAD;
  const maxVal  = Math.max(...data.map(d => Math.max(d.doneThis, d.donePrev)), 1);

  const xPos = (i) => (width - 12) * i / (n - 1) + 6;
  const yPos = (v) => TOP_PAD + (1 - v / maxVal) * (chartH - 2);

  const COLOR_PREV = new Color("#636366");

  // 薄いグリッド線（中央）
  const midY = TOP_PAD + (chartH - 2) / 2;
  const grid = new Path();
  grid.move(new Point(6, midY));
  grid.addLine(new Point(width - 6, midY));
  ctx.addPath(grid);
  ctx.setStrokeColor(new Color("#3a3a3c", 0.5));
  ctx.setLineWidth(0.5);
  ctx.strokePath();

  // 前年ライン（グレー、全12ヶ月）
  const prevPath = new Path();
  prevPath.move(new Point(xPos(0), yPos(data[0].donePrev)));
  for (let i = 1; i < n; i++) prevPath.addLine(new Point(xPos(i), yPos(data[i].donePrev)));
  ctx.addPath(prevPath);
  ctx.setStrokeColor(COLOR_PREV);
  ctx.setLineWidth(1.5);
  ctx.strokePath();

  // 今年ライン（緑、curMonthIdx まで）
  const thisPath = new Path();
  thisPath.move(new Point(xPos(0), yPos(data[0].doneThis)));
  for (let i = 1; i <= curMonthIdx; i++) thisPath.addLine(new Point(xPos(i), yPos(data[i].doneThis)));
  ctx.addPath(thisPath);
  ctx.setStrokeColor(COLOR_ACCENT);
  ctx.setLineWidth(1.5);
  ctx.strokePath();

  // ドット（前年）
  for (let i = 0; i < n; i++) {
    const x = xPos(i), y = yPos(data[i].donePrev), r = 1.5;
    const p = new Path();
    p.addEllipse(new Rect(x - r, y - r, r * 2, r * 2));
    ctx.addPath(p);
    ctx.setFillColor(COLOR_PREV);
    ctx.fillPath();
  }

  // ドット（今年、今月のみ強調）
  for (let i = 0; i <= curMonthIdx; i++) {
    const x = xPos(i), y = yPos(data[i].doneThis);
    const r = i === curMonthIdx ? 2.5 : 1.5;
    const p = new Path();
    p.addEllipse(new Rect(x - r, y - r, r * 2, r * 2));
    ctx.addPath(p);
    ctx.setFillColor(i === curMonthIdx ? COLOR_ACCENT : new Color("#30d158", 0.7));
    ctx.fillPath();
  }

  // X 軸ラベル（月）— 今月は白、他はグレー
  const labelW = width / n;
  for (let i = 0; i < n; i++) {
    ctx.setFont(Font.systemFont(7));
    ctx.setTextColor(i === curMonthIdx ? COLOR_MAIN_VAL : COLOR_SUB_TEXT);
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect(data[i].monthLabel,
      new Rect(xPos(i) - labelW / 2, height - LABEL_H, labelW, LABEL_H));
  }

  return ctx.getImage();
}

function addLegendDot(container, color, label) {
  const dot = container.addStack();
  dot.size = new Size(6, 6);
  dot.backgroundColor = color;
  dot.cornerRadius = 3;
  container.addSpacer(2);
  const t = container.addText(label);
  t.font = Font.systemFont(7);
  t.textColor = COLOR_SUB_TEXT;
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
