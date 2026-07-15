import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import {
  ConnectAccountBody,
  UpdateAccountBody,
  UpdateAccountParams,
  DisconnectAccountParams,
  RefreshAccountBalanceParams,
  ListAccountsResponse,
  ListAccountsResponseItem,
} from "@workspace/api-zod";
import { fetchDerivAccountInfo, DerivAuthError } from "../lib/deriv";

const router: IRouter = Router();

function serialize(row: typeof accountsTable.$inferSelect) {
  return ListAccountsResponseItem.parse({
    id: row.id,
    label: row.label,
    loginid: row.loginid,
    accountType: row.accountType,
    currency: row.currency,
    balance: Number(row.balance),
    email: row.email ?? undefined,
    country: row.country ?? undefined,
    isActive: row.isActive,
    connectedAt: row.connectedAt,
  });
}

router.get("/accounts", async (_req, res): Promise<void> => {
  const rows = await db.select().from(accountsTable).orderBy(accountsTable.connectedAt);
  res.json(ListAccountsResponse.parse(rows.map(serialize)));
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = ConnectAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let info;
  try {
    info = await fetchDerivAccountInfo(parsed.data.apiToken);
  } catch (err) {
    const message = err instanceof DerivAuthError ? err.message : "Failed to verify token";
    req.log.warn({ err }, "Deriv authorization failed");
    res.status(400).json({ error: message });
    return;
  }

  const existingActive = await db.select().from(accountsTable);
  const isFirst = existingActive.length === 0;

  const [row] = await db
    .insert(accountsTable)
    .values({
      label: parsed.data.label,
      apiToken: parsed.data.apiToken,
      loginid: info.loginid,
      accountType: info.accountType,
      currency: info.currency,
      balance: info.balance,
      email: info.email,
      country: info.country,
      isActive: isFirst,
    })
    .returning();

  res.status(201).json(serialize(row!));
});

router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const params = DisconnectAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [removed] = await db
    .delete(accountsTable)
    .where(eq(accountsTable.id, params.data.id))
    .returning();

  if (!removed) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  if (removed.isActive) {
    const [next] = await db.select().from(accountsTable).limit(1);
    if (next) {
      await db.update(accountsTable).set({ isActive: true }).where(eq(accountsTable.id, next.id));
    }
  }

  res.sendStatus(204);
});

router.patch("/accounts/:id", async (req, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateAccountBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (body.data.isActive === true) {
    await db.update(accountsTable).set({ isActive: false });
  }

  const updateValues: Partial<typeof accountsTable.$inferInsert> = {};
  if (body.data.label !== undefined) updateValues.label = body.data.label;
  if (body.data.isActive !== undefined) updateValues.isActive = body.data.isActive;

  const [row] = await db
    .update(accountsTable)
    .set(updateValues)
    .where(eq(accountsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.json(serialize(row));
});

router.post("/accounts/:id/refresh", async (req, res): Promise<void> => {
  const params = RefreshAccountBalanceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  let info;
  try {
    info = await fetchDerivAccountInfo(existing.apiToken);
  } catch (err) {
    const message = err instanceof DerivAuthError ? err.message : "Failed to refresh balance";
    req.log.warn({ err }, "Deriv balance refresh failed");
    res.status(400).json({ error: message });
    return;
  }

  const [row] = await db
    .update(accountsTable)
    .set({ balance: info.balance, currency: info.currency })
    .where(eq(accountsTable.id, params.data.id))
    .returning();

  res.json(serialize(row!));
});

export default router;
