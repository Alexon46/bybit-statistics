import * as fs from "fs";
import * as path from "path";
import type { Trade } from "../types/trade";
import { getProfitUsdt } from "../utils/profitUtils";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getUserFilePath(userId: number): string {
  return path.join(DATA_DIR, `${userId}.json`);
}

function readUserTrades(userId: number): Trade[] {
  ensureDataDir();
  const filePath = getUserFilePath(userId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeUserTrades(userId: number, trades: Trade[]): void {
  ensureDataDir();
  const filePath = getUserFilePath(userId);
  fs.writeFileSync(filePath, JSON.stringify(trades, null, 2), "utf-8");
}

export function exists(orderId: string, userId: number): boolean {
  const trades = readUserTrades(userId);
  return trades.some((t) => t.order_id === orderId);
}

export function insert(trade: Trade, userId: number): void {
  const trades = readUserTrades(userId);
  trades.push({
    ...trade,
    created_at: new Date().toISOString(),
  });
  writeUserTrades(userId, trades);
}

export function queryByPeriod(
  userId: number,
  startTime: Date,
  endTime: Date
): Trade[] {
  const trades = readUserTrades(userId);
  return trades.filter((t) => {
    const settlementDate = new Date(t.settlement_time);
    return settlementDate >= startTime && settlementDate <= endTime;
  });
}

export function getAllUserIds(): number[] {
  ensureDataDir();
  const files = fs.readdirSync(DATA_DIR);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseInt(f.replace(".json", ""), 10))
    .filter((id) => !Number.isNaN(id));
}

export function getAllUsersData(): Record<string, Trade[]> {
  const userIds = getAllUserIds();
  const result: Record<string, Trade[]> = {};
  for (const userId of userIds) {
    result[String(userId)] = readUserTrades(userId);
  }
  return result;
}

export function updateAllTradesWithProfitUsdt(): { usersUpdated: number; tradesUpdated: number } {
  const userIds = getAllUserIds();
  let tradesUpdated = 0;
  let usersUpdated = 0;

  for (const userId of userIds) {
    const trades = readUserTrades(userId);
    let changed = false;
    for (const t of trades) {
      if (t.profitUsdt === undefined) {
        (t as Trade & { profitUsdt: number }).profitUsdt = getProfitUsdt(t);
        tradesUpdated++;
        changed = true;
      }
    }
    if (changed) {
      writeUserTrades(userId, trades);
      usersUpdated++;
    }
  }

  return { usersUpdated, tradesUpdated };
}
