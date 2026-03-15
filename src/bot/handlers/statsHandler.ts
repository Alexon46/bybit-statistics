import type { Context } from "telegraf";
import { Markup } from "telegraf";
import {
  getStats,
  getTradesForPeriod,
  formatStats,
  formatDetailReport,
  splitIntoChunks,
  type PeriodKey,
} from "../../services/statsService";
import { PERIOD_LABELS, TELEGRAM_MESSAGE_LIMIT } from "../../constants";
import { tryDeleteUserMessage, deletePreviousBotMessages } from "../helpers/telegram";
import { storeMessageIds } from "../helpers/messageStore";
import { isAdmin } from "./adminHandler";

const PERIODS: PeriodKey[] = ["week", "lastweek", "month", "lastmonth"];

function getDetailKeyboard(period: PeriodKey) {
  return Markup.inlineKeyboard([
    Markup.button.callback("Детальный отчёт", `detail:${period}`),
  ]);
}

export const statsKeyboard = Markup.keyboard([
  ["/week", "/lastweek"],
  ["/month", "/lastmonth"],
])
  .resize()
  .persistent();

export async function handleStart(ctx: Context): Promise<void> {
  await tryDeleteUserMessage(ctx);
  const text = [
    "Привет! Я бот для учёта Бивалютных инвестиций Bybit.",
    "",
    "Отправь скриншот окна «Информация об ордере» — я извлеку данные и сохраню.",
    "",
    "Используй кнопки ниже для быстрой статистики:",
  ].join("\n");
  const userId = ctx.from?.id;
  const keyboard = userId && isAdmin(userId)
    ? Markup.keyboard([
        ["/week", "/lastweek"],
        ["/month", "/lastmonth"],
        ["/admin"],
      ])
      .resize()
      .persistent()
    : statsKeyboard;
  await ctx.reply(text, keyboard);
}

function createStatsHandler(period: PeriodKey) {
  return async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (!userId) return;

    await tryDeleteUserMessage(ctx);
    await deletePreviousBotMessages(ctx);

    const stats = getStats(userId, period);
    const label = `📊 ${PERIOD_LABELS[period]}`;
    const keyboard = stats.count > 0 ? getDetailKeyboard(period) : undefined;
    const msg = await ctx.reply(formatStats(stats, label), keyboard ?? {});
    storeMessageIds(userId, [msg.message_id]);
  };
}

export async function handleUnknownText(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await tryDeleteUserMessage(ctx);
  await deletePreviousBotMessages(ctx);

  const msg = await ctx.reply("Отправьте фото скриншота или выберите команду из меню.");
  storeMessageIds(userId, [msg.message_id]);
}

export const handleWeek = createStatsHandler("week");
export const handleLastWeek = createStatsHandler("lastweek");
export const handleMonth = createStatsHandler("month");
export const handleLastMonth = createStatsHandler("lastmonth");

function isValidPeriod(match: unknown): match is PeriodKey {
  return typeof match === "string" && PERIODS.includes(match as PeriodKey);
}

export async function handleDetailCallback(ctx: Context): Promise<void> {
  const match = "match" in ctx && Array.isArray(ctx.match) ? ctx.match[1] : null;
  if (!match || !isValidPeriod(match)) return;

  const period = match;
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCbQuery();

  const trades = getTradesForPeriod(userId, period);
  const label = PERIOD_LABELS[period];
  const noButton = { reply_markup: { inline_keyboard: [] } };

  if (trades.length === 0) {
    await ctx.editMessageText(`${label}\n\nНет ордеров за выбранный период.`, noButton);
    return;
  }

  const { text, lines } = formatDetailReport(trades, label);

  if (text.length > TELEGRAM_MESSAGE_LIMIT) {
    const chunks = splitIntoChunks(lines, TELEGRAM_MESSAGE_LIMIT);
    const editedMsgId =
      ctx.callbackQuery?.message && "message_id" in ctx.callbackQuery.message
        ? ctx.callbackQuery.message.message_id
        : 0;

    await ctx.editMessageText(chunks[0], noButton);
    const chunkIds: number[] = [editedMsgId];

    for (let i = 1; i < chunks.length; i++) {
      const msg = await ctx.reply(chunks[i]);
      chunkIds.push(msg.message_id);
    }
    storeMessageIds(userId, chunkIds);
  } else {
    await ctx.editMessageText(text, noButton);
  }
}
