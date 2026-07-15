import { Router, type IRouter } from "express";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db, botsTable } from "@workspace/db";
import {
  ImportBotBody,
  UpdateBotBody,
  UpdateBotParams,
  GetBotParams,
  DeleteBotParams,
  ToggleBotFavoriteParams,
  ListBotsQueryParams,
  ListBotsResponse,
  ListBotsResponseItem,
  GetBotResponse,
  UpdateBotResponse,
  ToggleBotFavoriteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toListItem(row: typeof botsTable.$inferSelect) {
  return ListBotsResponseItem.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    strategy: row.strategy,
    market: row.market,
    tags: row.tags,
    favorite: row.favorite,
    sizeBytes: row.sizeBytes,
    status: row.status,
    lastRunAt: row.lastRunAt ?? null,
    createdAt: row.createdAt,
  });
}

router.get("/bots", async (req, res): Promise<void> => {
  const params = ListBotsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const q = params.data.q?.trim();
  const rows = q
    ? await db
        .select()
        .from(botsTable)
        .where(
          or(
            ilike(botsTable.name, `%${q}%`),
            ilike(botsTable.strategy, `%${q}%`),
            ilike(botsTable.market, `%${q}%`),
            sql`array_to_string(${botsTable.tags}, ',') ILIKE ${"%" + q + "%"}`,
          ),
        )
        .orderBy(botsTable.createdAt)
    : await db.select().from(botsTable).orderBy(botsTable.createdAt);

  res.json(ListBotsResponse.parse(rows.map(toListItem)));
});

router.post("/bots", async (req, res): Promise<void> => {
  const parsed = ImportBotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sizeBytes = Buffer.byteLength(parsed.data.xmlContent, "utf-8");
  const [row] = await db
    .insert(botsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      strategy: parsed.data.strategy ?? "Custom",
      market: parsed.data.market ?? "",
      tags: parsed.data.tags ?? [],
      xmlContent: parsed.data.xmlContent,
      sizeBytes,
    })
    .returning();
  res.status(201).json(toListItem(row!));
});

router.get("/bots/:id", async (req, res): Promise<void> => {
  const params = GetBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(botsTable).where(eq(botsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  res.json(
    GetBotResponse.parse({
      id: row.id,
      name: row.name,
      description: row.description,
      strategy: row.strategy,
      market: row.market,
      tags: row.tags,
      favorite: row.favorite,
      sizeBytes: row.sizeBytes,
      status: row.status,
      lastRunAt: row.lastRunAt ?? null,
      createdAt: row.createdAt,
      xmlContent: row.xmlContent,
    }),
  );
});

router.patch("/bots/:id", async (req, res): Promise<void> => {
  const params = UpdateBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateBotBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updateValues: Partial<typeof botsTable.$inferInsert> = {};
  if (body.data.name !== undefined) updateValues.name = body.data.name;
  if (body.data.description !== undefined) updateValues.description = body.data.description;
  if (body.data.strategy !== undefined) updateValues.strategy = body.data.strategy;
  if (body.data.market !== undefined) updateValues.market = body.data.market;
  if (body.data.tags !== undefined) updateValues.tags = body.data.tags;
  if (body.data.status !== undefined) {
    updateValues.status = body.data.status;
    if (body.data.status === "running") {
      updateValues.lastRunAt = new Date();
    }
  }
  const [row] = await db
    .update(botsTable)
    .set(updateValues)
    .where(eq(botsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  res.json(UpdateBotResponse.parse(toListItem(row)));
});

router.post("/bots/:id/toggle-favorite", async (req, res): Promise<void> => {
  const params = ToggleBotFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [current] = await db.select().from(botsTable).where(eq(botsTable.id, params.data.id));
  if (!current) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  const [row] = await db
    .update(botsTable)
    .set({ favorite: !current.favorite })
    .where(eq(botsTable.id, params.data.id))
    .returning();
  res.json(ToggleBotFavoriteResponse.parse(toListItem(row!)));
});

router.delete("/bots/:id", async (req, res): Promise<void> => {
  const params = DeleteBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [removed] = await db
    .delete(botsTable)
    .where(eq(botsTable.id, params.data.id))
    .returning();
  if (!removed) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
