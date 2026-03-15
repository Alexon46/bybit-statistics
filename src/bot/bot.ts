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

export function createBot(): Telegraf {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const bot = new Telegraf(token);

  bot.start(handleStart);
  bot.command("week", handleWeek);
  bot.command("lastweek", handleLastWeek);
  bot.command("month", handleMonth);
  bot.command("lastmonth", handleLastMonth);
  bot.action(/^detail:(.+)$/, handleDetailCallback);
  bot.on(message("photo"), handlePhoto);
  bot.on(message("text"), handleUnknownText);

  return bot;
}
