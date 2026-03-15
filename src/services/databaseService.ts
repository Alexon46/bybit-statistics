import { Pool } from "pg";
import type { Trade } from "../types/trade";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required. Add it to your .env file (get connection string from Neon Console)."
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

interface TradeRow {
  order_id: string;
  pair: string;
  investment_amount: string;
  investment_currency: string;
  order_direction: string;
  term: string;
  target_price: string;
  apr: string;
  placement_time: string;
  order_type: string;
  order_status: string;
  settlement_time: string;
  settlement_price: string;
  yield_amount: string;
  yield_currency: string;
  to_account: string;
  profit_usdt: string | null;
  created_at: Date | null;
}

function rowToTrade(row: TradeRow): Trade {
  const trade: Trade = {
    order_id: row.order_id,
    pair: row.pair,
    investment_amount: parseFloat(row.investment_amount),
    investment_currency: row.investment_currency,
    order_direction: row.order_direction,
    term: row.term,
    target_price: parseFloat(row.target_price),
    apr: parseFloat(row.apr),
    placement_time: row.placement_time,
    order_type: row.order_type,
    order_status: row.order_status,
    settlement_time: row.settlement_time,
    settlement_price: parseFloat(row.settlement_price),
    yield_amount: parseFloat(row.yield_amount),
    yield_currency: row.yield_currency,
    to_account: row.to_account,
  };
  if (row.created_at) {
    trade.created_at = row.created_at.toISOString();
  }
  if (row.profit_usdt !== null) {
    trade.profitUsdt = parseFloat(row.profit_usdt);
  }
  return trade;
}

export async function exists(orderId: string, userId: number): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM trades WHERE user_id = $1 AND order_id = $2 LIMIT 1",
    [userId, orderId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function insert(trade: Trade, userId: number): Promise<void> {
  await pool.query(
    `INSERT INTO trades (
      user_id, order_id, pair, investment_amount, investment_currency,
      order_direction, term, target_price, apr, placement_time, order_type,
      order_status, settlement_time, settlement_price, yield_amount,
      yield_currency, to_account, profit_usdt
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      userId,
      trade.order_id,
      trade.pair,
      trade.investment_amount,
      trade.investment_currency,
      trade.order_direction,
      trade.term,
      trade.target_price,
      trade.apr,
      trade.placement_time,
      trade.order_type,
      trade.order_status,
      trade.settlement_time,
      trade.settlement_price,
      trade.yield_amount,
      trade.yield_currency,
      trade.to_account,
      trade.profitUsdt ?? null,
    ]
  );
}

export async function queryByPeriod(
  userId: number,
  startTime: Date,
  endTime: Date
): Promise<Trade[]> {
  const result = await pool.query<TradeRow>(
    `SELECT order_id, pair, investment_amount, investment_currency, order_direction,
            term, target_price, apr, placement_time, order_type, order_status,
            settlement_time, settlement_price, yield_amount, yield_currency,
            to_account, profit_usdt, created_at
     FROM trades
     WHERE user_id = $1
       AND settlement_time::timestamptz >= $2
       AND settlement_time::timestamptz <= $3
     ORDER BY settlement_time ASC`,
    [userId, startTime, endTime]
  );
  return result.rows.map(rowToTrade);
}

export async function getAllUserIds(): Promise<number[]> {
  const result = await pool.query<{ user_id: string }>(
    "SELECT DISTINCT user_id FROM trades ORDER BY user_id"
  );
  return result.rows.map((r: { user_id: string }) => parseInt(r.user_id, 10));
}

export async function getAllUsersData(): Promise<Record<string, Trade[]>> {
  const result = await pool.query<TradeRow & { user_id: string }>(
    `SELECT user_id, order_id, pair, investment_amount, investment_currency,
            order_direction, term, target_price, apr, placement_time, order_type,
            order_status, settlement_time, settlement_price, yield_amount,
            yield_currency, to_account, profit_usdt, created_at
     FROM trades
     ORDER BY user_id, settlement_time ASC`
  );
  const byUser: Record<string, Trade[]> = {};
  for (const row of result.rows) {
    const uid = row.user_id;
    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push(rowToTrade(row));
  }
  return byUser;
}
