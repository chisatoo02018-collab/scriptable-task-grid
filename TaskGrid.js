// ==========================================
// 設定・カラーパレット
// ==========================================
const TARGET_LIST_NAME = "";

const COLOR_ACCENT   = new Color("#30d158");   // 黄緑（完了・消費時間など統一色）
const COLOR_MINUS    = new Color("#ff453a");    // 赤（マイナス）
const COLOR_MAIN_VAL = new Color("#ffffff");    // メイン数字
const COLOR_SUB_TEXT = new Color("#8e8e93");    // サブテキスト
const COLOR_BG       = new Color("#1c1c1e");    // 背景
const COLOR_DUE         = new Color("#007AFF");    // 残りタスク・ゲージトラック（iOS青）
const COLOR_DIVIDER  = new Color("#3a3a3c");    // 区切り線
const DONUT_SIZE     = 54;                      // ドーナツグラフのサイズ（pt）
const GAUGE_SIZE     = 52;                      // 円形ゲージのサイズ（pt）

// ── 個人設定（寿命ゲージ用） ──
const BIRTH_YEAR  = 2003;   // 生年（西暦）
const BIRTH_MONTH = 2;      // 誕生月（1〜12）
const BIRTH_DAY   = 18;     // 誕生日
const LIFE_YEARS  = 80;     // 想定寿命（年）
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

// --------------------------------------------------
// メインウィジェット
// --------------------------------------------------
async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = COLOR_BG;
  widget.setPadding(3, 5, 2, 4);

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
  const diffDay    = doneToday - doneYest;  // 完了数の前日比

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // 完了済の分類（今日完了 × 期限の時間軸）
  const doneFuture   = completed.filter(r => r.completionDate && isSameDay(r.completionDate, now) && r.dueDate && r.dueDate >= todayEnd).length;
  const doneTodayDue = completed.filter(r => r.completionDate && isSameDay(r.completionDate, now) && r.dueDate && isSameDay(r.dueDate, now)).length;
  const donePast     = completed.filter(r => r.completionDate && isSameDay(r.completionDate, now) && r.dueDate && r.dueDate < todayStart).length;
  const doneNoDue    = completed.filter(r => r.completionDate && isSameDay(r.completionDate, now) && !r.dueDate).length;
  // doneToday === doneFuture + doneTodayDue + donePast + doneNoDue

  // 未完了の分類
  const incompletePast = incomplete.filter(r => r.dueDate && r.dueDate < todayStart).length;
  // incompleteToday = dueToday（既存変数を流用）

  // スコープ定義：今日完了 + 今日期限の未完了 + 期日超過の未完了
  // → リング・%・ラベル合計がすべてこの scopeTotal で一致する
  const dueTotal   = dueToday + incompletePast;
  const scopeTotal = doneToday + dueTotal;
  const rateToday  = scopeTotal > 0 ? Math.round(doneToday / scopeTotal * 100) : 0;
  const centerStr  = scopeTotal > 0
    ? (rateToday > 0 ? `${scopeTotal}件\n残${dueTotal}件\n${rateToday}%済` : `${scopeTotal}件\n残${dueTotal}件`)
    : `0件`;

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
  const monthRemainH = Math.max(0, Math.ceil((daysInMonth * 24) * (1 - monthElapsed)));

  const LIFE_START   = new Date(BIRTH_YEAR, BIRTH_MONTH - 1, BIRTH_DAY);
  const LIFE_END     = new Date(BIRTH_YEAR + LIFE_YEARS, BIRTH_MONTH - 1, BIRTH_DAY);
  const lifeElapsed  = Math.min(1, (now - LIFE_START) / (LIFE_END - LIFE_START));  // 消費済み割合

  const heartImage   = await loadHeartImage();

  // 今週（日〜土）の完了数 ＋ 先週同曜日との比較（バーチャート用）
  const thisSunday = new Date(now);
  thisSunday.setDate(now.getDate() - now.getDay());
  thisSunday.setHours(0, 0, 0, 0);
  const weekData = [];
  for (let i = 0; i < 7; i++) {
    const d     = new Date(thisSunday); d.setDate(thisSunday.getDate() + i);
    const dPrev = new Date(d);          dPrev.setDate(d.getDate() - 7);
    weekData.push({
      dayIndex:  i,
      countThis: cntDone(cd => isSameDay(cd, d)),
      countPrev: cntDone(cd => isSameDay(cd, dPrev)),
      isToday:   isSameDay(d, now),
    });
  }

  // ==================== 描画 ====================

  widget.addSpacer(1);

  // ── 統計行：今日ドーナツ | 折れ線グラフ（6ヶ月） ──
  const statsRow = widget.addStack();
  statsRow.layoutHorizontally();
  statsRow.topAlignContent();  // 上揃え：ヘッダー行の縦位置を月次タスク数ラベルに合わせる

  statsRow.addSpacer(2);  // 上段を少し右へオフセット

  // ── 左カラム（ヘッダー＋ドーナツ＋ラベル） ──
  const donutCol = statsRow.addStack();
  donutCol.layoutVertically();
  donutCol.size = new Size(112, 0);  // 幅固定：lineColへの圧迫を防ぐ

  // ヘッダー行：日付+時刻（月次タスク数ラベルと同じ縦位置）
  const mins      = String(now.getMinutes()).padStart(2, '0');
  const mm        = String(curMonth + 1).padStart(2, '0');
  const dd        = String(now.getDate()).padStart(2, '0');
  const todayDate = `${curYear}/${mm}/${dd} ${now.getHours()}:${mins}`;
  const donutHeader = donutCol.addStack();
  donutHeader.layoutHorizontally();
  donutHeader.centerAlignContent();
  donutHeader.addSpacer();
  const dhLabel = donutHeader.addText(todayDate);
  dhLabel.font      = Font.systemFont(8);
  dhLabel.textColor = COLOR_MAIN_VAL;
  donutHeader.addSpacer();

  donutCol.addSpacer(8);  // 折れ線グラフ65pt表示領域の中央にドーナツを配置
  addDonutColumn(donutCol, doneToday, dueTotal, diffDay,
    doneFuture, doneTodayDue, donePast, doneNoDue,
    incompletePast, dueToday, centerStr);

  statsRow.addSpacer(6);
  const statDiv = statsRow.addStack();
  statDiv.size = new Size(1, 79);
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
  lhLabel.textColor = COLOR_MAIN_VAL;
  lineHeader.addSpacer(6);
  addLegendDot(lineHeader, COLOR_ACCENT, `${curYear}（${totalThis}件）`, COLOR_MAIN_VAL);
  lineHeader.addSpacer(4);
  addLegendDot(lineHeader, new Color("#636366"), `${prevYear}（${totalPrev}件）`, COLOR_SUB_TEXT);

  lineCol.addSpacer(2);
  const lineContainer = lineCol.addStack();
  lineContainer.size = new Size(0, 65);  // 幅:カラム追従、高さ:固定
  const lineImg = lineContainer.addImage(drawLineChart(monthlyData, 195, 65, curMonth));
  lineImg.resizable = true;

  widget.addSpacer(1);
  addHorizontalLine(widget);
  widget.addSpacer(2);  // 仕切り線から下段を少し離す

  // ── 下段：円形ゲージ（左・ドーナツ下）| 日次バーチャート（右・折れ線下） ──
  const bottomRow = widget.addStack();
  bottomRow.layoutHorizontally();
  bottomRow.topAlignContent();  // ラベルを上の仕切り線寄りに配置

  // 円形ゲージ（左）＋「残時間」ラベル
  bottomRow.addSpacer(2);  // 左マージン
  const gaugeBlock = bottomRow.addStack();
  gaugeBlock.layoutVertically();
  gaugeBlock.size = new Size(112, 0);  // gauge1(52) + gap(8) + gauge2(52)

  // 残時間ラベル（2つのゲージ中央）
  const gLabelRow = gaugeBlock.addStack();
  gLabelRow.layoutHorizontally();
  gLabelRow.addSpacer();
  const gLabel = gLabelRow.addText("消費時間");
  gLabel.font      = Font.systemFont(8);
  gLabel.textColor = COLOR_MAIN_VAL;
  gLabelRow.addSpacer();
  gaugeBlock.addSpacer(2);

  // ゲージ行
  const gaugeInnerRow = gaugeBlock.addStack();
  gaugeInnerRow.layoutHorizontally();
  gaugeInnerRow.centerAlignContent();
  const COLOR_GAUGE_TRACK = COLOR_DUE;  // ゲージトラック（タスクドーナツと同じ青）
  addGaugeColumn(gaugeInnerRow, monthElapsed, GAUGE_SIZE,
    COLOR_GAUGE_TRACK, COLOR_ACCENT,
    { type: "text", value: `残\n${monthRemainH}h` });
  gaugeInnerRow.addSpacer(8);
  addGaugeColumn(gaugeInnerRow, lifeElapsed, GAUGE_SIZE,
    COLOR_GAUGE_TRACK, COLOR_ACCENT,
    { type: "image", value: heartImage });

  // 下段の仕切り線（2 + 112 + 6 = 120pt → 上段と同じ位置）
  bottomRow.addSpacer(6);
  const bottomDiv = bottomRow.addStack();
  bottomDiv.size = new Size(1, 65);  // label(8) + spacer(2) + gauge(55)
  bottomDiv.backgroundColor = COLOR_DIVIDER;
  bottomRow.addSpacer(8);

  // バーチャート列（右）
  const barCol = bottomRow.addStack();
  barCol.layoutVertically();
  const barLabel = barCol.addText("日次タスク数");
  barLabel.font = Font.systemFont(8);
  barLabel.textColor = COLOR_MAIN_VAL;
  barCol.addSpacer(2);
  const barContainer = barCol.addStack();
  barContainer.size = new Size(0, 55);  // 幅:カラム追従、高さ:ゲージ行に合わせる
  const chartImage = drawBarChart(weekData, 195, 55);
  const chartView  = barContainer.addImage(chartImage);
  chartView.resizable = true;

  return widget;
}

// --------------------------------------------------
// ドーナツカラム
// --------------------------------------------------
// done/due はドーナツ弧の色分け用、centerVal は中央表示文字列（\n区切り可）
// due = dueToday + incompletePast（リングと%は同一分母 scopeTotal=done+due で一致）
function addDonutColumn(container, done, due, diff, doneFuture, doneTodayDue, donePast, doneNoDue, incompletePast, incompleteToday, centerVal) {
  const wrapper = container.addStack();
  wrapper.layoutHorizontally();
  wrapper.bottomAlignContent();     // ラベル群の下端（前日比:）を水平仕切り線に近づける
  wrapper.size = new Size(112, 0);  // donut(54) + gap(6) + textCol(52)

  // ドーナツグラフ（左）
  const imgView = wrapper.addImage(drawDonutChart(done, due, centerVal, DONUT_SIZE));
  imgView.imageSize = new Size(DONUT_SIZE, DONUT_SIZE);
  imgView.resizable = false;

  wrapper.addSpacer(6);

  // テキスト列（右）— 6行・フォント6pt（5文字ラベルが30ptに収まる）
  const textCol = wrapper.addStack();
  textCol.layoutVertically();
  textCol.centerAlignContent();
  textCol.size = new Size(52, 0);  // 112 - donut(54) - gap(6)

  // セクションヘッダー行（全幅・左寄せ）
  function addHeaderRow(col, label) {
    const row = col.addStack();
    row.layoutHorizontally();
    const hdr = row.addText(label);
    hdr.font      = Font.systemFont(6);
    hdr.textColor = COLOR_MAIN_VAL;
    row.addSpacer();
  }

  // サブ行：ラベル固定幅(30pt) + 数値固定幅(22pt) = 52pt
  function addLabelRow(col, label, value, color) {
    const row = col.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    const lblBox = row.addStack();
    lblBox.size = new Size(30, 0);
    const lbl = lblBox.addText(label);
    lbl.font      = Font.systemFont(6);
    lbl.textColor = color === COLOR_SUB_TEXT ? COLOR_SUB_TEXT : COLOR_MAIN_VAL;
    const numBox = row.addStack();
    numBox.size = new Size(22, 0);
    numBox.addSpacer();
    const val = numBox.addText(value);
    val.font      = Font.systemFont(6);
    val.textColor = color;
  }

  // 統計行：ラベル左端・値右端（セクションと同じ階層に見せる）
  function addFlatRow(col, label, value, color) {
    const row = col.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    const lbl = row.addText(label);
    lbl.font      = Font.systemFont(6);
    lbl.textColor = COLOR_MAIN_VAL;
    row.addSpacer();
    const val = row.addText(value);
    val.font      = Font.systemFont(6);
    val.textColor = color;
  }

  // 完了済セクション（1件以上あるときのみ表示）
  if (doneFuture > 0 || doneTodayDue > 0 || donePast > 0 || doneNoDue > 0) {
    addHeaderRow(textCol, "完了済");
    if (doneFuture   > 0) addLabelRow(textCol, "未来分:", `${doneFuture}`,   COLOR_MAIN_VAL);
    if (doneTodayDue > 0) addLabelRow(textCol, "当日分:", `${doneTodayDue}`, COLOR_MAIN_VAL);
    if (donePast     > 0) addLabelRow(textCol, "過去分:", `${donePast}`,     COLOR_MAIN_VAL);
    if (doneNoDue    > 0) addLabelRow(textCol, "期限なし:", `${doneNoDue}`,  COLOR_MAIN_VAL);
  }
  // 未完了セクション（1件以上あるときのみ表示）
  if (incompletePast > 0 || incompleteToday > 0) {
    addHeaderRow(textCol, "未完了");
    if (incompletePast  > 0) addLabelRow(textCol, "過去分:", `${incompletePast}`,  COLOR_MAIN_VAL);
    if (incompleteToday > 0) addLabelRow(textCol, "当日分:", `${incompleteToday}`, COLOR_MAIN_VAL);
  }
  // 総数前日比（±0は非表示）
  if (diff !== 0) {
    const sign   = diff > 0 ? "+" : "";
    const dColor = diff > 0 ? COLOR_ACCENT : COLOR_MINUS;
    addFlatRow(textCol, "総数前日比:", `${sign}${diff}`, dColor);
  }
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
  const ringW  = 4;                     // リング幅
  const innerR = outerR - ringW;
  const midR   = outerR - ringW / 2;   // キャップ円の中心半径
  const capR   = ringW / 2;            // キャップ円の半径（= 半リング幅）
  const total  = done + due;

  const startAngle = -(Math.PI / 2);   // 12時の位置から開始（時計回り）

  if (total === 0) {
    // タスクなし：グレーの輪のみ
    const p = new Path();
    p.addEllipse(new Rect(0.5, 0.5, size - 1, size - 1));
    ctx.addPath(p);
    ctx.setFillColor(new Color("#2c2c2e"));
    ctx.fillPath();
  } else {
    // 残りタスク（青）: 12時から時計回り
    if (due > 0) {
      const dueEndAngle = startAngle + (due / total) * 2 * Math.PI;
      fillArcSegment(ctx, center, outerR, startAngle, dueEndAngle, COLOR_DUE);
    }

    // 完了タスク（緑）: 12時から反時計回り
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

  // 緑弧の両端に丸キャップを描画（ホール抜き後）
  if (total > 0 && done > 0) {
    const doneStartAngle = startAngle - (done / total) * 2 * Math.PI;
    [startAngle, doneStartAngle].forEach(angle => {
      const cx = center.x + midR * Math.cos(angle);
      const cy = center.y + midR * Math.sin(angle);
      const cp = new Path();
      cp.addEllipse(new Rect(cx - capR, cy - capR, capR * 2, capR * 2));
      ctx.addPath(cp);
      ctx.setFillColor(COLOR_ACCENT);
      ctx.fillPath();
    });

  }

  // 中央テキスト（\n で複数行対応）
  ctx.setTextAlignedCenter();
  const lines = String(centerVal).split('\n');
  const fSize  = 9;
  const lineH  = fSize + 2;
  const totalH = lines.length * lineH + (lines.length - 1);
  ctx.setTextColor(COLOR_MAIN_VAL);
  lines.forEach((line, i) => {
    ctx.setFont(Font.boldSystemFont(fSize));
    ctx.drawTextInRect(line, new Rect(0, size / 2 - totalH / 2 + i * (lineH + 1), size, lineH));
  });

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

  const n           = data.length;
  const LABEL_H     = 8;                 // 曜日ラベル領域
  const BAR_YAXIS_W = 12;                // 右端Y軸ラベル領域
  const CAP_VAL     = 15;
  const chartH      = height - LABEL_H;
  const plotW       = width - BAR_YAXIS_W;
  const rawMax      = Math.max(...data.map(d => Math.max(d.countThis, d.countPrev)), 1);
  const scaleMax    = Math.min(rawMax, CAP_VAL);
  const slotW       = plotW / n;
  const halfW       = Math.floor(slotW * 0.42);
  const gap         = Math.max(1, Math.floor(slotW * 0.04));
  const maxBarH     = chartH - 3;        // バー最大高（上部3ptのみ確保）
  const dayNames    = ["日", "月", "火", "水", "木", "金", "土"];

  // Y軸グリッドとラベル
  const ticks = calcNiceTicks(scaleMax).filter(v => v > 0);
  for (const v of ticks) {
    const ty = chartH - Math.round((v / scaleMax) * maxBarH);
    const gp = new Path();
    gp.move(new Point(0, ty));
    gp.addLine(new Point(plotW, ty));
    ctx.addPath(gp);
    ctx.setStrokeColor(new Color("#3a3a3c", 0.25));
    ctx.setLineWidth(0.5);
    ctx.strokePath();
    ctx.setFont(Font.systemFont(6));
    ctx.setTextColor(new Color("#636366", 0.75));
    ctx.setTextAlignedRight();
    ctx.drawTextInRect(`${v}`, new Rect(plotW + 1, Math.max(0, ty - 5), BAR_YAXIS_W - 2, 9));
  }

  // セパレータ線（バー領域と曜日ラベルの境界）
  const sep = new Path();
  sep.move(new Point(0, chartH));
  sep.addLine(new Point(plotW, chartH));
  ctx.addPath(sep);
  ctx.setStrokeColor(new Color("#ffffff", 0.18));
  ctx.setLineWidth(0.5);
  ctx.strokePath();

  for (let i = 0; i < n; i++) {
    const { dayIndex, countThis, countPrev, isToday } = data[i];
    const slotLeft = Math.floor(i * slotW);

    // 先週バー（左側・グレー）
    if (countPrev > 0) {
      const capped = Math.min(countPrev, CAP_VAL);
      const barH   = Math.max(Math.round((capped / scaleMax) * maxBarH), 2);
      const bx     = Math.floor(slotLeft + slotW / 2 - halfW - gap / 2);
      ctx.setFillColor(new Color("#636366", 0.55));
      ctx.fillRect(new Rect(bx, chartH - barH, halfW, barH));
    }

    // 今週バー（右側）
    if (countThis > 0) {
      const capped   = Math.min(countThis, CAP_VAL);
      const barH     = Math.max(Math.round((capped / scaleMax) * maxBarH), 2);
      const by       = chartH - barH;
      const bx       = Math.floor(slotLeft + slotW / 2 + gap / 2);
      const isCapped = countThis > CAP_VAL;
      const barColor = isCapped
        ? (isToday ? new Color("#ffcc00") : new Color("#ffcc00", 0.35))
        : (isToday ? COLOR_ACCENT : new Color("#30d158", 0.38));
      ctx.setFillColor(barColor);
      ctx.fillRect(new Rect(bx, by, halfW, barH));
    }

    // 曜日ラベル（下端・固定）
    ctx.setFont(Font.systemFont(6));
    ctx.setTextColor(isToday ? COLOR_MAIN_VAL : COLOR_SUB_TEXT);
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect(dayNames[dayIndex], new Rect(slotLeft, height - LABEL_H, slotW, LABEL_H));
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

  const n       = data.length;    // 12
  const LABEL_H = 8;
  const TOP_PAD = 1;
  const YAXIS_W = 14;             // 右端Y軸ラベル領域（pt）
  const chartH  = height - LABEL_H - TOP_PAD;
  const plotW   = width - YAXIS_W;  // グラフ実描画幅
  const maxVal  = Math.max(...data.map(d => Math.max(d.doneThis, d.donePrev)), 1);

  const xPos = (i) => (plotW - 8) * i / (n - 1) + 4;
  const yPos = (v) => TOP_PAD + (1 - v / maxVal) * (chartH - 2);

  const COLOR_PREV = new Color("#636366");

  // Y軸の目盛り（キリのいい2〜3個）とグリッド線
  const ticks = calcNiceTicks(maxVal);
  for (const v of ticks) {
    const y = yPos(v);
    const gp = new Path();
    gp.move(new Point(4, y));
    gp.addLine(new Point(plotW - 4, y));
    ctx.addPath(gp);
    ctx.setStrokeColor(new Color("#3a3a3c", v === 0 ? 0.50 : 0.20));
    ctx.setLineWidth(0.5);
    ctx.strokePath();
    // Y軸ラベル（右端にさりげなく）
    ctx.setFont(Font.systemFont(6));
    ctx.setTextColor(new Color("#636366", 0.75));
    ctx.setTextAlignedRight();
    ctx.drawTextInRect(`${v}`, new Rect(plotW, Math.max(0, y - 5), YAXIS_W - 1, 9));
  }

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

  // ドット（今年、前年比マイナスは赤、今月のみ強調）
  for (let i = 0; i <= curMonthIdx; i++) {
    const x = xPos(i), y = yPos(data[i].doneThis);
    const r = i === curMonthIdx ? 2.5 : 1.5;
    const below = data[i].doneThis < data[i].donePrev;
    const dotColor = below
      ? (i === curMonthIdx ? new Color("#ff453a") : new Color("#ff453a", 0.7))
      : (i === curMonthIdx ? COLOR_ACCENT : new Color("#30d158", 0.7));
    const p = new Path();
    p.addEllipse(new Rect(x - r, y - r, r * 2, r * 2));
    ctx.addPath(p);
    ctx.setFillColor(dotColor);
    ctx.fillPath();
  }

  // X 軸ラベル（月）— 今月は白、他はグレー
  const slotW = plotW / n;
  for (let i = 0; i < n; i++) {
    ctx.setFont(Font.systemFont(7));
    ctx.setTextColor(i === curMonthIdx ? COLOR_MAIN_VAL : COLOR_SUB_TEXT);
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect(data[i].monthLabel,
      new Rect(xPos(i) - slotW / 2, height - LABEL_H, slotW, LABEL_H));
  }

  return ctx.getImage();
}

// Y軸の目盛り値を計算（キリのいい2〜3本、0を含む）
function calcNiceTicks(maxVal) {
  if (maxVal <= 0) return [0];
  const niceStep = (raw) => {
    if (raw <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 5, 10]) {
      if (m * mag >= raw) return m * mag;
    }
    return mag * 10;
  };
  for (const target of [2, 3]) {
    const step = niceStep(maxVal / target);
    const ticks = [];
    for (let v = 0; v <= maxVal + step * 0.1; v += step) ticks.push(Math.round(v));
    if (ticks.length >= 2 && ticks.length <= 4) return ticks;
  }
  return [0, Math.round(maxVal)];
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
  const ringW  = 4;
  const innerR = outerR - ringW;
  const midR   = outerR - ringW / 2;
  const capR   = ringW / 2;
  const startAngle = -(Math.PI / 2);

  // トラック（背景リング）
  fillArcSegment(ctx, center, outerR, startAngle, startAngle + 2 * Math.PI, trackColor);

  // 進捗弧（消費済み・反時計回り＝上から左へ）
  const fillStartAngle = startAngle - progress * 2 * Math.PI;
  if (progress > 0.005) {
    fillArcSegment(ctx, center, outerR, fillStartAngle, startAngle, fillColor);
  }

  // 中心をくり抜いてリング形状に
  const hole = new Path();
  hole.addEllipse(new Rect(size / 2 - innerR, size / 2 - innerR, innerR * 2, innerR * 2));
  ctx.addPath(hole);
  ctx.setFillColor(COLOR_BG);
  ctx.fillPath();

  // 黄緑弧の両端に丸キャップ（ホール抜き後）
  if (progress > 0.005 && progress < 0.995) {
    [startAngle, fillStartAngle].forEach(angle => {
      const cx = center.x + midR * Math.cos(angle);
      const cy = center.y + midR * Math.sin(angle);
      const cp = new Path();
      cp.addEllipse(new Rect(cx - capR, cy - capR, capR * 2, capR * 2));
      ctx.addPath(cp);
      ctx.setFillColor(fillColor);
      ctx.fillPath();
    });
  }

  // 中央コンテンツ（画像 or テキスト）
  if (centerContent && centerContent.type === "image" && centerContent.value) {
    const hSize = Math.floor(innerR * 1.4);
    ctx.drawImageInRect(centerContent.value,
      new Rect(size / 2 - hSize / 2, size / 2 - hSize / 2, hSize, hSize));
  } else if (centerContent && centerContent.value != null) {
    const lines = String(centerContent.value).split('\n');
    ctx.setTextAlignedCenter();
    ctx.setTextColor(COLOR_MAIN_VAL);
    if (lines.length === 1) {
      ctx.setFont(Font.boldSystemFont(9));
      const tH = 11;
      ctx.drawTextInRect(lines[0], new Rect(0, size / 2 - tH / 2, size, tH));
    } else {
      // 複数行：固定 9pt、行間 1pt
      const fontSize = 9;
      const lineH = fontSize + 1;
      const totalH = lines.length * lineH + (lines.length - 1);
      lines.forEach((line, i) => {
        ctx.setFont(Font.boldSystemFont(fontSize));
        const y = size / 2 - totalH / 2 + i * (lineH + 1);
        ctx.drawTextInRect(line, new Rect(0, y, size, lineH));
      });
    }
  }

  return ctx.getImage();
}

// ハート画像を取得（HEART_IMAGE_BASE64 が設定されていない場合は SF Symbol にフォールバック）
async function loadHeartImage() {
  if (HEART_IMAGE_BASE64) {
    try {
      const data = Data.fromBase64String(HEART_IMAGE_BASE64);
      const img  = Image.fromData(data);
      if (img) return img;
    } catch (e) {}
  }
  return SFSymbol.named("heart.fill").image;
}

function addLegendDot(container, color, label, textColor = COLOR_SUB_TEXT) {
  const dot = container.addStack();
  dot.size = new Size(6, 6);
  dot.backgroundColor = color;
  dot.cornerRadius = 3;
  container.addSpacer(2);
  const t = container.addText(label);
  t.font = Font.systemFont(6);
  t.textColor = textColor;
}

// --------------------------------------------------
// 区切り線
// --------------------------------------------------

function addHorizontalLine(widget) {
  const d = widget.addStack();
  d.size            = new Size(320, 0.5);
  d.backgroundColor = COLOR_DIVIDER;
  d.alpha           = 0.6;
}
