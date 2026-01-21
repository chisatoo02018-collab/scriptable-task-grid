// ==========================================
// 設定・カラーパレット (Integrated: Wide Padding)
// ==========================================
const TARGET_LIST_NAME = "";

// カラー設定
const COLOR_ACCENT = new Color("#30d158");   // 緑（プラス）
const COLOR_MINUS = new Color("#ff453a");    // 赤（マイナス）
const COLOR_MAIN_VAL = new Color("#ffffff"); // メイン数字
const COLOR_SUB_TEXT = new Color("#8e8e93"); // サブテキスト
const COLOR_BG = new Color("#1c1c1e");       // 背景

// 「残りタスク」の色（提示された青色）
const COLOR_DUE = new Color("#0a84ff");

// ==========================================

if (config.runsInWidget) {
let widget = await createWidget();
Script.setWidget(widget);
} else {
let widget = await createWidget();
widget.presentMedium();
}
Script.complete();

async function createWidget() {
const widget = new ListWidget();
widget.backgroundColor = COLOR_BG;

// 【修正】左右のパディングを増やす (14 -> 24)
widget.setPadding(8, 24, 8, 24);

// --- 1. データ取得 ---
let calendars = undefined;
if (TARGET_LIST_NAME) {
const c = await Calendar.findList(TARGET_LIST_NAME);
calendars = [c];
}
const incomplete = await Reminder.allIncomplete(calendars);
const completed = await Reminder.allCompleted(calendars);

// --- 2. 日付計算 ---
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
const currentDate = now.getDate();
const yesterdayDate = new Date(now);
yesterdayDate.setDate(currentDate - 1);

const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
const lastMonthYear = lastMonthDate.getFullYear();
const lastMonthMonth = lastMonthDate.getMonth();
const lastYear = currentYear - 1;

// 判定ヘルパー
const isSameDay = (d, t) => d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
const isSameMonth = (d, y, m) => d.getMonth() === m && d.getFullYear() === y;
const isSameYear = (d, y) => d.getFullYear() === y;

// --- 3. 集計ロジック ---

// 【A. 今日・昨日】
const doneToday = completed.filter(r => r.completionDate && isSameDay(r.completionDate, now)).length;
const dueToday = incomplete.filter(r => r.dueDate && isSameDay(r.dueDate, now)).length;
const totalToday = doneToday + dueToday;

const doneYesterday = completed.filter(r => r.completionDate && isSameDay(r.completionDate, yesterdayDate)).length;
const totalYesterday = doneYesterday;
const diffYesterday = totalToday - totalYesterday;

// 【B. 今月・先月】
const doneMonth = completed.filter(r => r.completionDate && isSameMonth(r.completionDate, currentYear, currentMonth)).length;
const dueMonth = incomplete.filter(r => r.dueDate && isSameMonth(r.dueDate, currentYear, currentMonth)).length;
const totalMonth = doneMonth + dueMonth;

const doneLastMonth = completed.filter(r => r.completionDate && isSameMonth(r.completionDate, lastMonthYear, lastMonthMonth)).length;
const dueLastMonth = incomplete.filter(r => r.dueDate && isSameMonth(r.dueDate, lastMonthYear, lastMonthMonth)).length;
const totalLastMonth = doneLastMonth + dueLastMonth;
const diffMonth = totalMonth - totalLastMonth;

// 【C. 今年・昨年】
const doneYear = completed.filter(r => r.completionDate && isSameYear(r.completionDate, currentYear)).length;
const dueYear = incomplete.filter(r => r.dueDate && isSameYear(r.dueDate, currentYear)).length;
const totalYear = doneYear + dueYear;

const doneLastYear = completed.filter(r => r.completionDate && isSameYear(r.completionDate, lastYear)).length;
const dueLastYear = incomplete.filter(r => r.dueDate && isSameYear(r.dueDate, lastYear)).length;
const totalLastYear = doneLastYear + dueLastYear;
const diffYear = totalYear - totalLastYear;

// --- 4. ウィジェット描画 ---

// === ヘッダー ===
let headerStack = widget.addStack();
headerStack.centerAlignContent();

let symbol = SFSymbol.named("square.grid.2x2.fill");
let iconImg = headerStack.addImage(symbol.image);
iconImg.tintColor = COLOR_DUE;
iconImg.imageSize = new Size(16, 16);

headerStack.addSpacer(5);

let title = headerStack.addText("Task Grid");
title.font = Font.semiboldSystemFont(15);
title.textColor = COLOR_MAIN_VAL;

headerStack.addSpacer();

// ヘッダー下の余白
widget.addSpacer(6);

// === グリッド構築 ===

// 上段：今日
let topSection = widget.addStack();
topSection.layoutHorizontally();
topSection.centerAlignContent();

addStatItem(topSection, "今日の残り", `${dueToday}`, COLOR_DUE);
addDivider(topSection);
addStatItem(topSection, "今日の総数", `${totalToday}`, COLOR_MAIN_VAL);
addDivider(topSection);
addDiffItem(topSection, "昨日比", diffYesterday);

// 行間の余白
widget.addSpacer(4);
addHorizontalDivider(widget);
widget.addSpacer(4);

// 中段：今月
let midSection = widget.addStack();
midSection.layoutHorizontally();
midSection.centerAlignContent();

addStatItem(midSection, "今月の残り", `${dueMonth}`, COLOR_DUE);
addDivider(midSection);
addStatItem(midSection, "今月の総数", `${totalMonth}`, COLOR_MAIN_VAL);
addDivider(midSection);
addDiffItem(midSection, "先月比", diffMonth);

// 行間の余白
widget.addSpacer(4);
addHorizontalDivider(widget);
widget.addSpacer(4);

// 下段：今年
let botSection = widget.addStack();
botSection.layoutHorizontally();
botSection.centerAlignContent();

addStatItem(botSection, "今年の残り", `${dueYear}`, COLOR_DUE);
addDivider(botSection);
addStatItem(botSection, "今年の総数", `${totalYear}`, COLOR_MAIN_VAL);
addDivider(botSection);
addDiffItem(botSection, "昨年比", diffYear);

return widget;
}

// --------------------------------------------------
// ヘルパー関数
// --------------------------------------------------

function addStatItem(container, label, value, color, isBold = false) {
let wrapper = container.addStack();
wrapper.layoutVertically();
wrapper.size = new Size(86, 0);

// 値
let valStack = wrapper.addStack();
valStack.layoutHorizontally();
valStack.addSpacer();

let valText = valStack.addText(value);
if (isBold) {
valText.font = Font.boldSystemFont(18);
} else {
valText.font = Font.systemFont(18);
}
valText.textColor = color;

valStack.addSpacer();

wrapper.addSpacer(1);

// ラベル
let labStack = wrapper.addStack();
labStack.layoutHorizontally();
labStack.addSpacer();

let labText = labStack.addText(label);
labText.font = Font.systemFont(9);
labText.textColor = COLOR_SUB_TEXT;

labStack.addSpacer();
}

function addDiffItem(container, label, diffValue) {
let wrapper = container.addStack();
wrapper.layoutVertically();
wrapper.size = new Size(86, 0);

// 値
let valStack = wrapper.addStack();
valStack.layoutHorizontally();
valStack.addSpacer();

let sign = diffValue > 0 ? "+" : "";
let valStr = `${sign}${diffValue}`;

let color = COLOR_MAIN_VAL;
if (diffValue > 0) color = COLOR_ACCENT;
if (diffValue < 0) color = COLOR_MINUS;

let valText = valStack.addText(valStr);
valText.font = Font.systemFont(18);
valText.textColor = color;

valStack.addSpacer();

wrapper.addSpacer(1);

// ラベル
let labStack = wrapper.addStack();
labStack.layoutHorizontally();
labStack.addSpacer();

let labText = labStack.addText(label);
labText.font = Font.systemFont(9);
labText.textColor = COLOR_SUB_TEXT;

labStack.addSpacer();
}

function addDivider(container) {
container.addSpacer();
let divider = container.addStack();
divider.size = new Size(1, 12);
divider.backgroundColor = new Color("#3a3a3c");
container.addSpacer();
}

function addHorizontalDivider(widget) {
let stack = widget.addStack();
stack.layoutHorizontally();
stack.addSpacer();
let divider = stack.addStack();
// 【修正】パディング増に合わせて長さを少し調整 (280 -> 260)
divider.size = new Size(280, 0.5);
divider.backgroundColor = new Color("#3a3a3c");
divider.alpha = 0.5;
stack.addSpacer();
}
