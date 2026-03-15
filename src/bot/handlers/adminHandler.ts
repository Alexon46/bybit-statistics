import type { Context } from "telegraf";
import { Markup } from "telegraf";
import { ADMIN_USER_ID } from "../../constants";
import * as db from "../../services/databaseService";
import { tryDeleteUserMessage, deletePreviousBotMessages } from "../helpers/telegram";
import { storeMessageIds } from "../helpers/messageStore";

export const ADMIN_KEYBOARD = Markup.keyboard([["Export all"]])
  .resize()
  .persistent();

export function isAdmin(userId: number): boolean {
  return userId === ADMIN_USER_ID;
}

export async function handleAdmin(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) return;

  await tryDeleteUserMessage(ctx);
  await deletePreviousBotMessages(ctx);

  const msg = await ctx.reply("Админ-панель. Выберите действие:", ADMIN_KEYBOARD);
  storeMessageIds(userId, [msg.message_id]);
}

export async function handleExportAll(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) return;

  await tryDeleteUserMessage(ctx);
  await deletePreviousBotMessages(ctx);

  const statusMsg = await ctx.reply("Формирую экспорт...");

  try {
    const data = await db.getAllUsersData();
    const json = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(json, "utf-8");
    const filename = `bybit-export-${new Date().toISOString().slice(0, 10)}.json`;

    await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id);
    await ctx.replyWithDocument(
      { source: buffer, filename },
      { caption: `Экспорт данных всех пользователей (${Object.keys(data).length} пользователей)` }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка";
    await ctx.telegram
      .editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, `Ошибка: ${errMsg}`)
      .catch(() => {});
    storeMessageIds(userId, [statusMsg.message_id]);
  }
}
