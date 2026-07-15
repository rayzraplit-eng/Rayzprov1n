import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  contractType: text("contract_type").notNull(),
  stake: numeric("stake", { precision: 18, scale: 2 }).notNull(),
  duration: integer("duration"),
  outcome: text("outcome").notNull(),
  profit: numeric("profit", { precision: 18, scale: 2 }).notNull(),
  entryDigit: integer("entry_digit"),
  exitDigit: integer("exit_digit"),
  botId: integer("bot_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
