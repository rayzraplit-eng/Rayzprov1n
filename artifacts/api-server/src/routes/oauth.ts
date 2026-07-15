/**
 * OAuth route — Deriv PKCE flow (new api.deriv.com / auth.deriv.com registration).
 *
 * POST /oauth/exchange
 *   Frontend sends: { code, codeVerifier, redirectUri }
 *   1. Exchanges auth code for access_token at auth.deriv.com/oauth2/token
 *   2. Fetches all linked Options accounts via REST (api.derivws.com)
 *   3. Persists each account to the database
 *   Returns: { count: number }
 *
 * REST API reference:
 *   GET https://api.derivws.com/trading/v1/options/accounts
 *   Headers: Deriv-App-ID + Authorization: Bearer <access_token>
 *   Response: { data: OptionsAccount[], meta: {} }
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";

const router: IRouter = Router();

const DERIV_APP_ID      = process.env.DERIV_APP_ID ?? "";
const TOKEN_ENDPOINT    = "https://auth.deriv.com/oauth2/token";
const ACCOUNTS_ENDPOINT = "https://api.derivws.com/trading/v1/options/accounts";

// ── Types from Deriv OpenAPI spec ─────────────────────────────────────────────

interface DerivOptionsAccount {
  id:           string;
  account_type: "real" | "demo" | string;
  currency:     string;
  balance:      number;
  // additional fields that may be present
  loginid?:     string;
  email?:       string;
  country?:     string;
  status?:      string;
}

interface DerivAccountsResponse {
  data: DerivOptionsAccount[];
  meta?: Record<string, unknown>;
}

// ── Save accounts to the DB ───────────────────────────────────────────────────

async function saveAccounts(
  accounts: DerivOptionsAccount[],
  accessToken: string,
  log: { warn(obj: object, msg: string): void },
): Promise<number> {
  const existingRows = await db.select().from(accountsTable);
  const isFirstBatch = existingRows.length === 0;
  let saved = 0;

  for (const account of accounts) {
    const loginid     = account.loginid ?? account.id;
    const currency    = account.currency ?? "USD";
    const balance     = typeof account.balance === "number" ? account.balance : 0;
    const accountType = account.account_type === "demo" ? "demo" : "real";

    const [existing] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.loginid, loginid));

    try {
      if (existing) {
        await db
          .update(accountsTable)
          .set({ apiToken: accessToken, balance, currency })
          .where(eq(accountsTable.loginid, loginid));
      } else {
        await db.insert(accountsTable).values({
          label:       loginid,
          apiToken:    accessToken,     // OAuth Bearer token stored for future API calls
          loginid,
          accountType,
          currency,
          balance,
          email:       account.email   ?? null,
          country:     account.country ?? null,
          isActive:    isFirstBatch && saved === 0,
        });
      }
      saved++;
    } catch (err) {
      log.warn({ err, loginid }, "Could not save account — skipping");
    }
  }

  return saved;
}

// ── POST /oauth/exchange ───────────────────────────────────────────────────────

router.post("/oauth/exchange", async (req, res): Promise<void> => {
  const { code, codeVerifier, redirectUri } = req.body as Record<string, unknown>;

  if (
    typeof code         !== "string" || !code ||
    typeof codeVerifier !== "string" || !codeVerifier ||
    typeof redirectUri  !== "string" || !redirectUri
  ) {
    res.status(400).json({ error: "Missing required fields: code, codeVerifier, redirectUri" });
    return;
  }

  if (!DERIV_APP_ID) {
    res.status(500).json({ error: "DERIV_APP_ID is not configured on the server." });
    return;
  }

  // ── 1. Exchange PKCE code for access_token ────────────────────────────────
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

    const rawBody = await tokenRes.text();

    if (!tokenRes.ok) {
      req.log.warn({ status: tokenRes.status, body: rawBody }, "Deriv token endpoint error");
      let msg = `Token exchange failed (HTTP ${tokenRes.status})`;
      try {
        const parsed = JSON.parse(rawBody) as { error_description?: string; error?: string };
        msg = parsed.error_description ?? parsed.error ?? msg;
      } catch { /* not JSON */ }
      res.status(400).json({ error: msg });
      return;
    }

    const tokenData = JSON.parse(rawBody) as {
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
    req.log.error({ err }, "Failed to reach Deriv token endpoint");
    res.status(502).json({ error: "Could not reach Deriv token endpoint" });
    return;
  }

  // ── 2. Fetch linked accounts via REST ─────────────────────────────────────
  let accounts: DerivOptionsAccount[];
  try {
    const accountsRes = await fetch(ACCOUNTS_ENDPOINT, {
      method:  "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Deriv-App-ID":  DERIV_APP_ID,
        "Content-Type":  "application/json",
      },
    });

    const rawBody = await accountsRes.text();
    req.log.info({ status: accountsRes.status, body: rawBody.slice(0, 500) }, "Deriv accounts response");

    if (!accountsRes.ok) {
      let msg = `Failed to fetch accounts (HTTP ${accountsRes.status})`;
      try {
        const parsed = JSON.parse(rawBody) as { errors?: Array<{ message?: string }> };
        msg = parsed.errors?.[0]?.message ?? msg;
      } catch { /* not JSON */ }
      res.status(400).json({ error: msg });
      return;
    }

    const parsed = JSON.parse(rawBody) as DerivAccountsResponse;

    // Response shape: { data: [...] } per OpenAPI spec
    if (Array.isArray(parsed.data)) {
      accounts = parsed.data;
    } else if (Array.isArray(parsed as unknown as DerivOptionsAccount[])) {
      // Fallback: top-level array
      accounts = parsed as unknown as DerivOptionsAccount[];
    } else {
      req.log.warn({ parsed }, "Unexpected accounts response shape");
      accounts = [];
    }
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Deriv accounts");
    res.status(502).json({ error: "Could not retrieve accounts from Deriv" });
    return;
  }

  if (accounts.length === 0) {
    res.status(400).json({
      error: "No Options trading accounts found on this Deriv account. " +
             "Make sure you have at least one real or demo account.",
    });
    return;
  }

  // ── 3. Persist accounts ───────────────────────────────────────────────────
  const count = await saveAccounts(accounts, accessToken, req.log);
  res.json({ count });
});

export default router;
