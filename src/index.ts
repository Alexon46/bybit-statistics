import "dotenv/config";
import { createBot } from "./bot/bot";

const bot = createBot();

bot.launch().then(async () => {
  await bot.telegram.setMyCommands([
    { command: "week", description: "Статистика за текущую неделю" },
    { command: "lastweek", description: "Статистика за прошлую неделю" },
    { command: "month", description: "Статистика за текущий месяц" },
    { command: "lastmonth", description: "Статистика за прошлый месяц" },
  ]);
  console.log("Bot started");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
