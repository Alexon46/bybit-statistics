/**
 * Migrates trades from JSON files (data/*.json) to Neon Postgres.
 * Run once after setting DATABASE_URL in .env.
 *
 * Usage: npx ts-node scripts/migrate-json-to-neon.ts
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import type { Trade } from "../src/types/trade";
import { getProfitUsdt } from "../src/utils/profitUtils";

const DATA_DIR = path.join(process.cwd(), "data");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required. Add it to .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

async function migrate(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    console.log("No data/ directory found. Nothing to migrate.");
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("No JSON files in data/. Nothing to migrate.");
    return;
  }

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const userId = parseInt(file.replace(".json", ""), 10);
    if (Number.isNaN(userId)) continue;

    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    let trades: Trade[];
    try {
      trades = JSON.parse(content);
    } catch {
      console.warn(`Skipping ${file}: invalid JSON`);
      continue;
    }

    for (const t of trades) {
      const profitUsdt = t.profitUsdt ?? getProfitUsdt(t);
      try {
        const result = await pool.query(
          `INSERT INTO trades (
            user_id, order_id, pair, investment_amount, investment_currency,
            order_direction, term, target_price, apr, placement_time, order_type,
            order_status, settlement_time, settlement_price, yield_amount,
            yield_currency, to_account, profit_usdt
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (user_id, order_id) DO NOTHING`,
          [
            userId,
            t.order_id,
            t.pair,
            t.investment_amount,
            t.investment_currency,
            t.order_direction,
            t.term,
            t.target_price,
            t.apr,
            t.placement_time,
            t.order_type,
            t.order_status,
            t.settlement_time,
            t.settlement_price,
            t.yield_amount,
            t.yield_currency,
            t.to_account,
            profitUsdt,
          ]
        );
        if (result.rowCount === 1) {
          totalInserted++;
        } else {
          totalSkipped++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error inserting ${t.order_id} for user ${userId}:`, msg);
      }
    }
    console.log(`Migrated user ${userId}: ${trades.length} trades from ${file}`);
  }

  console.log(`\nDone. Inserted: ${totalInserted}, skipped (duplicates): ${totalSkipped}`);
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
