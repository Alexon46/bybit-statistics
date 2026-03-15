import * as fs from "fs";
import * as path from "path";
import type { Trade } from "../types/trade";

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
