import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db, accountsTable, botsTable, tradesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetEquityCurveResponse,
  GetSymbolBreakdownResponse,
  ListAccountsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [accounts, bots, trades] = await Promise.all([
    db.select().from(accountsTable),
    db.select().from(botsTable),
    db.select().from(tradesTable),
  ]);

  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  const decided = wins + losses;
  const winRate = decided === 0 ? 0 : Math.round((wins / decided) * 1000) / 10;
  const totalProfit = Math.round(trades.reduce((acc, t) => acc + Number(t.profit), 0) * 100) / 100;
  const runningBots = bots.filter((b) => b.status === "running").length;

  const symbolMap = new Map<string, number>();
  for (const t of trades) {
    symbolMap.set(t.symbol, (symbolMap.get(t.symbol) ?? 0) + Number(t.profit));
  }
  let bestSymbol: string | null = null;
  let bestProfit = -Infinity;
  for (const [sym, profit] of symbolMap) {
    if (profit > bestProfit) {
      bestProfit = profit;
      bestSymbol = sym;
    }
  }

  const active = accounts.find((a) => a.isActive) ?? null;
  const activeAccount = active
    ? ListAccountsResponseItem.parse({
        id: active.id,
        label: active.label,
        loginid: active.loginid,
        accountType: active.accountType,
        currency: active.currency,
        balance: Number(active.balance),
        email: active.email ?? undefined,
        country: active.country ?? undefined,
        isActive: active.isActive,
        connectedAt: active.connectedAt,
      })
    : undefined;

  res.json(
    GetDashboardSummaryResponse.parse({
      connectedAccounts: accounts.length,
      totalBots: bots.length,
      runningBots,
      totalTrades: trades.length,
      wins,
      losses,
      winRate,
      totalProfit,
      bestSymbol: bestSymbol ?? undefined,
      activeAccount,
    }),
  );
});

router.get("/dashboard/equity-curve", async (_req, res): Promise<void> => {
  const trades = await db.select().from(tradesTable).orderBy(asc(tradesTable.tradedAt));
  let equity = 0;
  const points = trades.map((t) => {
    equity += Number(t.profit);
    return {
      date: t.tradedAt.toISOString(),
      equity: Math.round(equity * 100) / 100,
    };
  });
  res.json(GetEquityCurveResponse.parse(points));
});

router.get("/dashboard/symbol-breakdown", async (_req, res): Promise<void> => {
  const trades = await db.select().from(tradesTable);
  const map = new Map<string, { trades: number; profit: number; wins: number }>();
  for (const t of trades) {
    const cur = map.get(t.symbol) ?? { trades: 0, profit: 0, wins: 0 };
    cur.trades += 1;
    cur.profit += Number(t.profit);
    if (t.result === "win") cur.wins += 1;
    map.set(t.symbol, cur);
  }
  const items = Array.from(map.entries())
    .map(([symbol, v]) => ({
      symbol,
      trades: v.trades,
      profit: Math.round(v.profit * 100) / 100,
      winRate: v.trades === 0 ? 0 : Math.round((v.wins / v.trades) * 1000) / 10,
    }))
    .sort((a, b) => b.profit - a.profit);
  res.json(GetSymbolBreakdownResponse.parse(items));
});

export default router;
