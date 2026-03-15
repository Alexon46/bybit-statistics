import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { handlePhoto } from "./handlers/photoHandler";
import {
  handleStart,
  handleWeek,
  handleLastWeek,
  handleMonth,
  handleLastMonth,
  handleDetailCallback,
  handleUnknownText,
} from "./handlers/statsHandler";
import {
  handleAdmin,
  handleUpdateOrders,
  handleExportAll,
  isAdmin,
} from "./handlers/adminHandler";

export function createBot(): Telegraf {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const bot = new Telegraf(token);

  bot.start(handleStart);
  bot.command("admin", handleAdmin);
  bot.command("week", handleWeek);
  bot.command("lastweek", handleLastWeek);
  bot.command("month", handleMonth);
  bot.command("lastmonth", handleLastMonth);
  bot.action(/^detail:(.+)$/, handleDetailCallback);
  bot.on(message("photo"), handlePhoto);
  bot.on(message("text"), async (ctx, next) => {
    const userId = ctx.from?.id;
    const text = "text" in ctx.message ? ctx.message.text : "";
    if (userId && isAdmin(userId)) {
      if (text === "Обновить ранее созданные ордера") {
        await handleUpdateOrders(ctx);
        return;
      }
      if (text === "Export all") {
        await handleExportAll(ctx);
        return;
      }
    }
    await handleUnknownText(ctx);
  });

  return bot;
}
