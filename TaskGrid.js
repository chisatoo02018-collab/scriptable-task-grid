// ==========================================
// 設定・カラーパレット
// ==========================================
const TARGET_LIST_NAME = "";

const COLOR_ACCENT   = new Color("#30d158");   // 緑（完了）
const COLOR_MINUS    = new Color("#ff453a");    // 赤（マイナス）
const COLOR_MAIN_VAL = new Color("#ffffff");    // メイン数字
const COLOR_SUB_TEXT = new Color("#8e8e93");    // サブテキスト
const COLOR_BG       = new Color("#1c1c1e");    // 背景
const COLOR_DUE         = new Color("#0a84ff");    // 残りタスク（青）
const COLOR_YELLOW_GREEN = new Color("#aaed6f");   // 消費済み時間（黄緑）
const COLOR_DIVIDER  = new Color("#3a3a3c");    // 区切り線
const DONUT_SIZE     = 50;                      // ドーナツグラフのサイズ（pt）
const GAUGE_SIZE     = 46;                      // 円形ゲージのサイズ（pt）

// ── 個人設定（寿命ゲージ用） ──
const HEART_IMAGE_BASE64 = "";   // ← base64エンコード画像を設定（空欄=LifeMerterから自動取得）

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
  widget.setPadding(8, 16, 8, 16);

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

  // ドーナツ中央値：今日期限の全タスク ∪ 今日完了した全タスク
  const doneDueToday      = completed.filter(r => r.dueDate && isSameDay(r.dueDate, now)).length;
  const doneTodayDueToday = completed.filter(r =>
    r.completionDate && isSameDay(r.completionDate, now) &&
    r.dueDate && isSameDay(r.dueDate, now)
  ).length;
  const centerTotal = doneDueToday + dueToday + doneToday - doneTodayDueToday;

  // 1〜12月の月別データ（今年 vs 前年、折れ線グラフ用）
  const prevYear   = curYear - 1;
  const monthlyData = [];
  for (let m = 0; m < 12; m++) {
    monthlyData.push({
      monthLabel: `${m + 1}`,
      doneThis: cntDone(cd => isSameMonth(cd, curYear, m)),
      donePrev: cntDone(cd => isSameMonth(cd, prevYear, m))
    });
  }
  const totalThis = monthlyData.reduce((s, d) => s + d.doneThis, 0);
  const totalPrev = monthlyData.reduce((s, d) => s + d.donePrev, 0);

  // 円形ゲージ用データ
  const daysInMonth  = new Date(curYear, curMonth + 1, 0).getDate();
  const monthStart   = new Date(curYear, curMonth, 1);
  const monthElapsed = (now - monthStart) / (daysInMonth * 24 * 3600000);  // 消費済み割合
  const monthRemainH = Math.ceil((daysInMonth * 24) * (1 - monthElapsed));

  const LIFE_START   = new Date(2003, 1, 18);   // 2003/02/18
  const LIFE_END     = new Date(2083, 1, 18);   // 2083/02/18
  const lifeElapsed  = (now - LIFE_START) / (LIFE_END - LIFE_START);  // 消費済み割合

  const heartImage   = await loadHeartImage();

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

  statsRow.addSpacer(5);  // 上段を少し右へオフセット
  const todayYear  = `${curYear}`;
  const todayDate  = `${curMonth + 1}/${now.getDate()}`;
  addDonutColumn(statsRow, doneToday, dueToday, diffDay, centerTotal, todayYear, todayDate);
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
  const lhLabel = lineHeader.addText("月次タスク数");
  lhLabel.font = Font.systemFont(8);
  lhLabel.textColor = COLOR_SUB_TEXT;
  lineHeader.addSpacer(6);
  addLegendDot(lineHeader, COLOR_ACCENT, `${curYear}年（${totalThis}件）`);
  lineHeader.addSpacer(4);
  addLegendDot(lineHeader, new Color("#636366"), `${prevYear}年（${totalPrev}件）`);
  lineHeader.addSpacer();

  lineCol.addSpacer(2);
  const lineImg = lineCol.addImage(drawLineChart(monthlyData, 195, 65, curMonth));
  lineImg.resizable = false;
  lineImg.imageSize = new Size(195, 65);

  widget.addSpacer(4);
  addHorizontalLine(widget);
  widget.addSpacer(8);  // 仕切り線から下段を少し離す

  // ── 下段：円形ゲージ（左・ドーナツ下）| 日次バーチャート（右・折れ線下） ──
  const bottomRow = widget.addStack();
  bottomRow.layoutHorizontally();
  bottomRow.centerAlignContent();

  // 円形ゲージ（左）— ドーナツ中心 X に揃えるため 4pt オフセット
  const gaugeRow = bottomRow.addStack();
  gaugeRow.layoutHorizontally();
  gaugeRow.centerAlignContent();
  gaugeRow.addSpacer(7);  // donut center-X = 7 + GAUGE_SIZE/2 = 25pt = DONUT_SIZE/2 ✓

  addGaugeColumn(gaugeRow, monthElapsed, GAUGE_SIZE,
    COLOR_DUE, COLOR_YELLOW_GREEN,
    { type: "text", value: `${monthRemainH}h` });
  gaugeRow.addSpacer(8);
  addGaugeColumn(gaugeRow, lifeElapsed, GAUGE_SIZE,
    COLOR_DUE, COLOR_YELLOW_GREEN,
    { type: "image", value: heartImage });

  bottomRow.addSpacer();  // 折れ線グラフ列の直下に自然に揃う

  // バーチャート列（右）
  const barCol = bottomRow.addStack();
  barCol.layoutVertically();
  const barLabel = barCol.addText("日次完了タスク");
  barLabel.font = Font.systemFont(8);
  barLabel.textColor = COLOR_SUB_TEXT;
  barCol.addSpacer(3);
  const chartImage = drawBarChart(dailyCounts, 195, 44);
  const chartView  = barCol.addImage(chartImage);
  chartView.resizable = false;
  chartView.imageSize = new Size(195, 44);

  return widget;
}

// --------------------------------------------------
// ドーナツカラム
// --------------------------------------------------
// done/due はドーナツ弧の色分け用、centerVal は中央表示値、dateLabel は日付文字列
function addDonutColumn(container, done, due, diff, centerVal, dateYear, dateDay) {
  const wrapper = container.addStack();
  wrapper.layoutHorizontally();
  wrapper.centerAlignContent();
  wrapper.size = new Size(96, 0);  // 幅固定で数値の右揃えを確保

  // ドーナツグラフ（左）
  const imgView = wrapper.addImage(drawDonutChart(done, due, centerVal, DONUT_SIZE));
  imgView.imageSize = new Size(DONUT_SIZE, DONUT_SIZE);
  imgView.resizable = false;

  wrapper.addSpacer(8);

  // テキスト列（右）— ラベル左寄せ・数値右寄せで「お尻」を揃える
  const textCol = wrapper.addStack();
  textCol.layoutVertically();

  const t1 = textCol.addText(dateYear);
  t1.font      = Font.systemFont(8);
  t1.textColor = COLOR_SUB_TEXT;
  textCol.addSpacer(1);
  const dateRow = textCol.addStack();
  dateRow.layoutHorizontally();
  dateRow.addSpacer();
  const t2 = dateRow.addText(dateDay);
  t2.font      = Font.semiboldSystemFont(10);
  t2.textColor = COLOR_MAIN_VAL;

  textCol.addSpacer(4);

  const row2 = textCol.addStack();
  row2.layoutHorizontally();
  const l2 = row2.addText("残件:");
  l2.font      = Font.systemFont(9);
  l2.textColor = COLOR_SUB_TEXT;
  row2.addSpacer();
  const v2 = row2.addText(`${due}`);
  v2.font      = Font.systemFont(9);
  v2.textColor = due > 0 ? COLOR_DUE : COLOR_SUB_TEXT;

  textCol.addSpacer(4);

  const sign   = diff > 0 ? "+" : "";
  const dColor = diff > 0 ? COLOR_ACCENT : diff < 0 ? COLOR_MINUS : COLOR_SUB_TEXT;
  const row3 = textCol.addStack();
  row3.layoutHorizontally();
  const l3 = row3.addText("日比:");
  l3.font      = Font.systemFont(9);
  l3.textColor = COLOR_SUB_TEXT;
  row3.addSpacer();
  const v3 = row3.addText(`${sign}${diff}`);
  v3.font      = Font.systemFont(9);
  v3.textColor = dColor;
}

// --------------------------------------------------
// ドーナツグラフ描画（DrawContext）
// --------------------------------------------------
function drawDonutChart(done, due, centerVal, size) {
  const ctx = new DrawContext();
  ctx.size               = new Size(size, size);
  ctx.opaque             = false;
  ctx.respectScreenScale = true;

  const center = new Point(size / 2, size / 2);
  const outerR = size / 2 - 0.5;
  const innerR = outerR - 4;      // リング幅 4pt（ゲージと統一）
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

    // 残りタスク（青）: 12時から時計回り
    if (due > 0) {
      const dueEndAngle = startAngle + (due / total) * 2 * Math.PI;
      fillArcSegment(ctx, center, outerR, startAngle, dueEndAngle, COLOR_DUE);
    }

    // 完了タスク（グレー）: 12時から反時計回り
    if (done > 0) {
      const doneStartAngle = startAngle - (done / total) * 2 * Math.PI;
      fillArcSegment(ctx, center, outerR, doneStartAngle, startAngle, COLOR_ACCENT);
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

  // 中央テキスト：今日の総タスク数
  const label    = `${centerVal}`;
  const fontSize = label.length >= 4 ? 8 : label.length === 3 ? 9 : label.length === 2 ? 10 : 11;
  ctx.setFont(Font.boldSystemFont(fontSize));
  ctx.setTextColor(centerVal > 0 ? COLOR_MAIN_VAL : new Color("#8e8e93", 0.6));
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
  const LABEL_H  = 11;                   // 曜日ラベル領域
  const NUM_H    = 9;                    // 件数ラベル領域
  const CAP_VAL  = 15;                   // 棒の高さ上限（超えたら "15+" 表示）
  const chartH   = height - LABEL_H;
  const rawMax   = Math.max(...data.map(d => d.count), 1);
  const scaleMax = Math.min(rawMax, CAP_VAL);  // スケール上限
  const slotW    = width / n;
  const barW     = Math.floor(slotW * 0.55);
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  for (let i = 0; i < n; i++) {
    const { date, count } = data[i];
    const isToday  = i === n - 1;
    const isCapped = count > CAP_VAL;
    const capped   = Math.min(count, CAP_VAL);
    const bx       = Math.floor(i * slotW + (slotW - barW) / 2);

    const maxBarH = chartH - NUM_H - 2;
    const barH    = count > 0 ? Math.max(Math.round((capped / scaleMax) * maxBarH), 2) : 0;
    const by      = chartH - barH;

    // バー（上限超えは黄色でハイライト）
    const barColor = isCapped
      ? (isToday ? new Color("#ffcc00") : new Color("#ffcc00", 0.45))
      : (isToday ? COLOR_ACCENT : new Color("#30d158", 0.30));
    ctx.setFillColor(barColor);
    ctx.fillRect(new Rect(bx, by, barW, barH));

    // カウントラベル（バー上部・上限超えは "n+" 表記）
    if (count > 0) {
      const numLabel = isCapped ? `${CAP_VAL}+` : `${count}`;
      ctx.setFont(Font.systemFont(7));
      ctx.setTextColor(isToday ? COLOR_MAIN_VAL : new Color("#8e8e93", 0.75));
      ctx.setTextAlignedCenter();
      ctx.drawTextInRect(numLabel, new Rect(i * slotW, Math.max(by - NUM_H, 0), slotW, NUM_H));
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

function addGaugeColumn(container, progress, size, trackColor, fillColor, centerContent) {
  const col = container.addStack();
  col.layoutVertically();
  col.centerAlignContent();
  const img = col.addImage(drawRingGauge(progress, size, trackColor, fillColor, centerContent));
  img.imageSize = new Size(size, size);
  img.resizable = false;
}

function drawRingGauge(progress, size, trackColor, fillColor, centerContent) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const center = new Point(size / 2, size / 2);
  const outerR = size / 2 - 0.5;
  const innerR = outerR - 4;            // リング幅 4pt（細め）
  const startAngle = -(Math.PI / 2);

  // トラック（背景リング）
  fillArcSegment(ctx, center, outerR, startAngle, startAngle + 2 * Math.PI, trackColor);

  // 進捗弧（消費済み・反時計回り＝上から左へ）
  if (progress > 0.005) {
    fillArcSegment(ctx, center, outerR, startAngle - progress * 2 * Math.PI, startAngle, fillColor);
  }

  // 中心をくり抜いてリング形状に
  const hole = new Path();
  hole.addEllipse(new Rect(size / 2 - innerR, size / 2 - innerR, innerR * 2, innerR * 2));
  ctx.addPath(hole);
  ctx.setFillColor(COLOR_BG);
  ctx.fillPath();

  // 中央コンテンツ（画像 or テキスト）
  if (centerContent && centerContent.type === "image" && centerContent.value) {
    const hSize = Math.floor(innerR * 1.4);
    ctx.drawImageInRect(centerContent.value,
      new Rect(size / 2 - hSize / 2, size / 2 - hSize / 2, hSize, hSize));
  } else if (centerContent && centerContent.value != null) {
    const txt = String(centerContent.value);
    const fontSize = txt.length >= 4 ? 7 : 8;
    ctx.setFont(Font.boldSystemFont(fontSize));
    ctx.setTextColor(COLOR_MAIN_VAL);
    ctx.setTextAlignedCenter();
    const tH = fontSize + 2;
    ctx.drawTextInRect(txt, new Rect(0, size / 2 - tH / 2, size, tH));
  }

  return ctx.getImage();
}

// ハート画像を取得（優先順: HEART_IMAGE_BASE64 → LifeMerter repo → SF Symbol）
async function loadHeartImage() {
  if (HEART_IMAGE_BASE64) {
    try {
      const data = Data.fromBase64String(HEART_IMAGE_BASE64);
      const img  = Image.fromData(data);
      if (img) return img;
    } catch (e) {}
  }
  try {
    const req = new Request(
      "https://raw.githubusercontent.com/chisatoo02018-collab/LifeMerter/main/LifeMerter.js"
    );
    const js = await req.loadString();
    const match = js.match(/heartImageBase64[^"']*["']([A-Za-z0-9+/=]{500,})["']/);
    if (match && match[1]) {
      const data = Data.fromBase64String(match[1]);
      return Image.fromData(data);
    }
  } catch (e) {}
  return SFSymbol.named("heart.fill").image;
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
