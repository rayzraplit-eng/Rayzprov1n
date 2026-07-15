/**
 * OAuth route — Deriv PKCE flow only (new api.deriv.com registration).
 *
 * POST /oauth/exchange
 *   Frontend sends: { code, codeVerifier, redirectUri }
 *   1. Exchanges auth code for access_token at oauth.deriv.com/oauth2/token
 *   2. Authorises via Deriv WebSocket → retrieves all linked account tokens
 *   3. Persists each account to the database
 *   Returns: { count: number }
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import { fetchDerivAccountInfo, fetchDerivAccountsFromOAuth, DerivAuthError } from "../lib/deriv";

const router: IRouter = Router();

const DERIV_APP_ID   = process.env.DERIV_APP_ID ?? "";
// New Deriv API token endpoint — auth.deriv.com (not the legacy oauth.deriv.com)
const TOKEN_ENDPOINT = "https://auth.deriv.com/oauth2/token";

// ── Save a list of {loginid, token} pairs to the DB ──────────────────────────

async function saveAccounts(
  accounts: Array<{ loginid: string; token: string }>,
  log: { warn(obj: object, msg: string): void },
): Promise<number> {
  const existingRows  = await db.select().from(accountsTable);
  const isFirstBatch  = existingRows.length === 0;
  let savedCount      = 0;

  for (const { loginid, token } of accounts) {
    let info;
    try {
      info = await fetchDerivAccountInfo(token);
    } catch (err) {
      log.warn({ err, loginid }, "Could not fetch account info — skipping");
      continue;
    }

    const [existing] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.loginid, loginid));

    if (existing) {
      await db
        .update(accountsTable)
        .set({ apiToken: token, balance: info.balance, currency: info.currency })
        .where(eq(accountsTable.loginid, loginid));
    } else {
      await db.insert(accountsTable).values({
        label:       loginid,
        apiToken:    token,
        loginid:     info.loginid,
        accountType: info.accountType,
        currency:    info.currency,
        balance:     info.balance,
        email:       info.email,
        country:     info.country,
        isActive:    isFirstBatch && savedCount === 0,
      });
    }

    savedCount++;
  }

  return savedCount;
}

// ── POST /oauth/exchange — PKCE code → tokens → save accounts ─────────────────

router.post("/oauth/exchange", async (req, res): Promise<void> => {
  const { code, codeVerifier, redirectUri } = req.body as Record<string, unknown>;

  if (
    typeof code          !== "string" || !code ||
    typeof codeVerifier  !== "string" || !codeVerifier ||
    typeof redirectUri   !== "string" || !redirectUri
  ) {
    res.status(400).json({ error: "Missing required fields: code, codeVerifier, redirectUri" });
    return;
  }

  if (!DERIV_APP_ID) {
    res.status(500).json({ error: "DERIV_APP_ID is not configured on the server." });
    return;
  }

  // ── 1. Exchange PKCE code for access_token ─────────────────────────────────
  let accessToken: string;
  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  redirectUri,
        code_verifier: codeVerifier,
        client_id:     DERIV_APP_ID,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      req.log.warn({ status: tokenRes.status, body }, "Deriv token endpoint error");
      res.status(400).json({ error: `Deriv token exchange failed (${tokenRes.status}): ${body}` });
      return;
    }

    const tokenData = await tokenRes.json() as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      const msg = tokenData.error_description ?? tokenData.error ?? "No access_token in Deriv response";
      res.status(400).json({ error: msg });
      return;
    }

    accessToken = tokenData.access_token;
  } catch (err) {
    req.log.error({ err }, "Failed to call Deriv token endpoint");
    res.status(502).json({ error: "Could not reach Deriv token endpoint" });
    return;
  }

  // ── 2. Authorise via WebSocket → get all linked account tokens ─────────────
  let accounts: Array<{ loginid: string; token: string }>;
  try {
    accounts = await fetchDerivAccountsFromOAuth(accessToken);
  } catch (err) {
    const message = err instanceof DerivAuthError
      ? err.message
      : "Failed to retrieve accounts from Deriv";
    req.log.warn({ err }, "Deriv OAuth account fetch failed");
    res.status(400).json({ error: message });
    return;
  }

  if (accounts.length === 0) {
    res.status(400).json({ error: "No accounts returned by Deriv. Make sure at least one account is active." });
    return;
  }

  // ── 3. Persist accounts ────────────────────────────────────────────────────
  const savedCount = await saveAccounts(accounts, req.log);
  res.json({ count: savedCount });
});

export default router;
