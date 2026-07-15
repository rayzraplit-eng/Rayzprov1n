import { pgTable, serial, text, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  loginid: text("loginid").notNull(),
  apiToken: text("api_token").notNull(),
  accountType: text("account_type").notNull().default("demo"),
  currency: text("currency").notNull().default("USD"),
  balance: doublePrecision("balance").notNull().default(0),
  email: text("email"),
  country: text("country"),
  isActive: boolean("is_active").notNull().default(false),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({
  id: true,
  connectedAt: true,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
