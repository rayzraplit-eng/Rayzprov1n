import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, tradesTable } from "@workspace/db";
import {
  CreateTradeBody,
  DeleteTradeParams,
  ListTradesQueryParams,
  ListTradesResponse,
  ListTradesResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serialize(row: typeof tradesTable.$inferSelect) {
  return ListTradesResponseItem.parse({
    id: row.id,
    symbol: row.symbol,
    contractType: row.contractType,
    stake: Number(row.stake),
    payout: Number(row.payout),
    profit: Number(row.profit),
    result: row.result,
    botId: row.botId ?? null,
    notes: row.notes,
    tradedAt: row.tradedAt,
  });
}

router.get("/trades", async (req, res): Promise<void> => {
  const params = ListTradesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { limit = 50, result } = params.data;
  const conditions = result ? and(eq(tradesTable.result, result)) : undefined;
  const rows = await db
    .select()
    .from(tradesTable)
    .where(conditions)
    .orderBy(desc(tradesTable.tradedAt))
    .limit(limit);
  res.json(ListTradesResponse.parse(rows.map(serialize)));
});

router.post("/trades", async (req, res): Promise<void> => {
  const parsed = CreateTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(tradesTable)
    .values({
      symbol: parsed.data.symbol,
      contractType: parsed.data.contractType,
      stake: parsed.data.stake,
      payout: parsed.data.payout,
      profit: parsed.data.profit,
      result: parsed.data.result,
      botId: parsed.data.botId ?? null,
      notes: parsed.data.notes ?? "",
      tradedAt: parsed.data.tradedAt ? new Date(parsed.data.tradedAt) : new Date(),
    })
    .returning();
  res.status(201).json(serialize(row!));
});

router.delete("/trades/:id", async (req, res): Promise<void> => {
  const params = DeleteTradeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [removed] = await db
    .delete(tradesTable)
    .where(eq(tradesTable.id, params.data.id))
    .returning();
  if (!removed) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
