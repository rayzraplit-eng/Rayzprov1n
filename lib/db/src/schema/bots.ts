import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botsTable = pgTable("bots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  strategy: text("strategy").notNull(),
  status: text("status").notNull().default("stopped"),
  markets: text("markets").notNull().default("[]"),
  stake: numeric("stake", { precision: 18, scale: 2 }),
  winCount: integer("win_count").notNull().default(0),
  lossCount: integer("loss_count").notNull().default(0),
  totalProfit: numeric("total_profit", { precision: 18, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBotSchema = createInsertSchema(botsTable).omit({ id: true, createdAt: true, winCount: true, lossCount: true, totalProfit: true });
export type InsertBot = z.infer<typeof insertBotSchema>;
export type Bot = typeof botsTable.$inferSelect;
