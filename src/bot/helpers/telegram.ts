import type { Context } from "telegraf";
import { getStoredMessageIds, clearStoredMessages } from "./messageStore";

export async function tryDeleteUserMessage(ctx: Context): Promise<void> {
  try {
    if (ctx.message && "message_id" in ctx.message) {
      await ctx.deleteMessage(ctx.message.message_id);
    }
  } catch {
    // In private chats bots cannot delete user messages
  }
}

export async function deletePreviousBotMessages(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const ids = getStoredMessageIds(userId);
  if (ids.length === 0) return;

  for (const msgId of ids) {
    try {
      await ctx.telegram.deleteMessage(chatId, msgId);
    } catch {
      // Message may have been deleted by user
    }
  }
  clearStoredMessages(userId);
}
