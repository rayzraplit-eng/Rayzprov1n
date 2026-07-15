import { pgTable, serial, text, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  contractType: text("contract_type").notNull(),
  stake: doublePrecision("stake").notNull().default(0),
  payout: doublePrecision("payout").notNull().default(0),
  profit: doublePrecision("profit").notNull().default(0),
  result: text("result").notNull().default("breakeven"),
  botId: integer("bot_id"),
  notes: text("notes").notNull().default(""),
  tradedAt: timestamp("traded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
