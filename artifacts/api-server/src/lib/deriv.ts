import WebSocket from "ws";

// Deriv has TWO separate ID systems:
//   • OAuth client_id  (DERIV_APP_ID)    — alphanumeric, used only in the OAuth
//     authorize / token exchange flow.
//   • WebSocket app_id (DERIV_WS_APP_ID) — must be NUMERIC. Required for all
//     WebSocket connections to wss://ws.derivws.com.
//
// Set DERIV_WS_APP_ID to your numeric app_id from https://app.deriv.com/account/apps.
// If omitted and DERIV_APP_ID is alphanumeric (new OAuth system), falls back to 36544.
const _oauthId = process.env.DERIV_APP_ID ?? "36544";
const DERIV_WS_APP_ID =
  process.env.DERIV_WS_APP_ID ??
  (/^\d+$/.test(_oauthId) ? _oauthId : "36544");
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_WS_APP_ID}`;
const TIMEOUT_MS = 12_000;

export interface DerivAccountInfo {
  loginid: string;
  email: string | null;
  country: string | null;
  currency: string;
  accountType: string;
  balance: number;
}

export class DerivAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DerivAuthError";
  }
}

/**
 * Authorise via WebSocket using a Deriv OAuth2 access_token.
 * Returns all linked accounts with their per-account API tokens,
 * extracted from the `account_list` field of the `authorize` response.
 *
 * This is the second step of the PKCE flow after the code has been exchanged
 * for an access_token at https://oauth.deriv.com/oauth2/token.
 */
export async function fetchDerivAccountsFromOAuth(
  accessToken: string,
): Promise<Array<{ loginid: string; token: string }>> {
  return new Promise((resolve, reject) => {
    const ws      = new WebSocket(DERIV_WS_URL);
    let settled   = false;
    let timeout: NodeJS.Timeout;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      try { ws.close(); } catch { /* noop */ }
    };

    const finish = (err: Error | null, value?: Array<{ loginid: string; token: string }>) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve(value!);
    };

    timeout = setTimeout(() => {
      finish(new DerivAuthError("Timed out authorising with Deriv"));
    }, TIMEOUT_MS);

    ws.on("open", () => {
      ws.send(JSON.stringify({ authorize: accessToken, req_id: 1 }));
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

        if (msg.error) {
          const e = msg.error as { message?: string };
          finish(new DerivAuthError(e.message ?? "Deriv authorisation failed"));
          return;
        }

        if (msg.msg_type === "authorize") {
          const auth = msg.authorize as Record<string, unknown>;
          const list = (auth.account_list ?? []) as Array<{
            loginid: string;
            token:   string;
            is_disabled?: number | boolean;
          }>;

          const accounts = list
            .filter((a) => !a.is_disabled)
            .map(({ loginid, token }) => ({ loginid, token }));

          finish(null, accounts);
        }
      } catch (err) {
        finish(err as Error);
      }
    });

    ws.on("error", (err) => finish(err as Error));

    ws.on("close", () => {
      if (!settled) finish(new DerivAuthError("WebSocket closed before accounts were returned"));
    });
  });
}

export async function fetchDerivAccountInfo(token: string): Promise<DerivAccountInfo> {
  return new Promise<DerivAccountInfo>((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL);
    let timeout: NodeJS.Timeout;
    let settled = false;

    const cleanup = (): void => {
      if (timeout) clearTimeout(timeout);
      try {
        ws.close();
      } catch {
        /* noop */
      }
    };

    const finish = (err: Error | null, value?: DerivAccountInfo): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else if (value) resolve(value);
    };

    timeout = setTimeout(() => {
      finish(new DerivAuthError("Timed out connecting to Deriv"));
    }, TIMEOUT_MS);

    let authorize: Record<string, unknown> | null = null;

    ws.on("open", () => {
      ws.send(JSON.stringify({ authorize: token, req_id: 1 }));
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (msg.error) {
          const err = msg.error as { message?: string };
          finish(new DerivAuthError(err.message ?? "Authorization failed"));
          return;
        }

        if (msg.msg_type === "authorize") {
          authorize = msg.authorize as Record<string, unknown>;
          ws.send(JSON.stringify({ balance: 1, req_id: 2 }));
          return;
        }

        if (msg.msg_type === "balance" && authorize) {
          const balanceObj = msg.balance as { balance?: number; currency?: string };
          const accountType =
            (authorize["is_virtual"] === 1 || authorize["is_virtual"] === true)
              ? "demo"
              : "real";
          finish(null, {
            loginid: String(authorize["loginid"] ?? ""),
            email: (authorize["email"] as string | undefined) ?? null,
            country: (authorize["country"] as string | undefined) ?? null,
            currency:
              (balanceObj?.currency as string | undefined) ??
              (authorize["currency"] as string | undefined) ??
              "USD",
            accountType,
            balance:
              typeof balanceObj?.balance === "number"
                ? balanceObj.balance
                : Number(authorize["balance"] ?? 0),
          });
          return;
        }
      } catch (err) {
        finish(err as Error);
      }
    });

    ws.on("error", (err) => {
      finish(err as Error);
    });

    ws.on("close", () => {
      if (!settled) {
        finish(new DerivAuthError("Connection closed before authorization completed"));
      }
    });
  });
}
