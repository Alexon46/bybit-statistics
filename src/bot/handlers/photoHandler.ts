import type { Context } from "telegraf";
import { extractTradeFromImage } from "../../services/geminiService";
import { getProfitUsdt } from "../../services/statsService";
import * as db from "../../services/databaseService";
import { tryDeleteUserMessage, deletePreviousBotMessages } from "../helpers/telegram";
import { storeMessageIds } from "../helpers/messageStore";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function downloadPhoto(ctx: Context, fileId: string): Promise<Buffer> {
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(fileLink.href);
  if (!response.ok) {
    throw new Error("Failed to download photo");
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function editStatusMessage(
  ctx: Context,
  messageId: number,
  text: string
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  await ctx.telegram.editMessageText(chatId, messageId, undefined, text);
}

export async function handlePhoto(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Не удалось определить пользователя.");
    return;
  }

  if (!GEMINI_API_KEY) {
    await ctx.reply("Ошибка: GEMINI_API_KEY не настроен.");
    return;
  }

  const msg = ctx.message;
  if (!msg || !("photo" in msg) || !msg.photo?.length) {
    await ctx.reply("Фото не получено.");
    return;
  }

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  await tryDeleteUserMessage(ctx);
  await deletePreviousBotMessages(ctx);

  const statusMsg = await ctx.reply("Обрабатываю скриншот...");

  try {
    const buffer = await downloadPhoto(ctx, fileId);
    const trade = await extractTradeFromImage(buffer, GEMINI_API_KEY);

    if (!trade) {
      await editStatusMessage(
        ctx,
        statusMsg.message_id,
        "Ордер не распознан. Убедитесь, что на скриншоте видно окно «Информация об ордере» с полем ID ордера."
      );
      storeMessageIds(userId, [statusMsg.message_id]);
      return;
    }

    if (await db.exists(trade.order_id, userId)) {
      await editStatusMessage(
        ctx,
        statusMsg.message_id,
        `Дубликат. Ордер ${trade.order_id} уже добавлен ранее.`
      );
      storeMessageIds(userId, [statusMsg.message_id]);
      return;
    }

    const tradeWithProfit = { ...trade, profitUsdt: getProfitUsdt(trade) };
    await db.insert(tradeWithProfit, userId);

    const summary = [
      `Ордер сохранён: ${trade.order_id}`,
      `${trade.pair} | ${trade.investment_amount} ${trade.investment_currency}`,
      `Доходность: ${trade.yield_amount} ${trade.yield_currency}`,
    ].join("\n");

    await editStatusMessage(ctx, statusMsg.message_id, summary);
    storeMessageIds(userId, [statusMsg.message_id]);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка";
    await editStatusMessage(ctx, statusMsg.message_id, `Ошибка обработки: ${errMsg}`).catch(
      () => {}
    );
    storeMessageIds(userId, [statusMsg.message_id]);
  }
}
