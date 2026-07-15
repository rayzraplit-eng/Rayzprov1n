// One-off historical tick fetcher for the Journal backtest engine.
// Unlike use-deriv-ticks.ts (persistent live subscription), this opens a
// short-lived WebSocket, requests up to `count` ticks (paginating backward
// in chunks of 5000 — the Deriv API's per-request cap — if more are
// requested), and closes once done.

const _configured = (import.meta.env.VITE_DERIV_APP_ID as string | undefined) ?? "36544";
const DERIV_WS_APP_ID =
  (import.meta.env.VITE_DERIV_WS_APP_ID as string | undefined) ??
  (/^\d+$/.test(_configured) ? _configured : "36544");
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_WS_APP_ID}`;

const MAX_CHUNK = 5000;

export type HistoryTicks = { quotes: number[]; pipSize: number };

function fetchChunk(symbol: string, count: number, endEpoch: number | "latest"): Promise<{ quotes: number[]; times: number[]; pipSize: number }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL);
    const timeout = window.setTimeout(() => {
      ws.close();
      reject(new Error("Timed out fetching historical ticks"));
    }, 15000);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({
        ticks_history:     symbol,
        adjust_start_time: 1,
        count,
        end:               endEpoch,
        style:             "ticks",
      }));
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg?.error) {
          window.clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error.message || "Deriv API error"));
          return;
        }
        if (msg?.msg_type === "history" && msg.history) {
          window.clearTimeout(timeout);
          const pipSize = Number(msg.pip_size ?? 2);
          const prices  = (msg.history.prices ?? []) as string[];
          const times   = (msg.history.times  ?? []) as number[];
          ws.close();
          resolve({ quotes: prices.map(Number), times: times.map(Number), pipSize });
        }
      } catch {
        /* ignore malformed frames */
      }
    });

    ws.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("WebSocket error while fetching historical ticks"));
    });
  });
}

/** Fetches up to `totalCount` of the most recent ticks for a symbol, paginating backward as needed. */
export async function fetchHistoricalTicks(symbol: string, totalCount: number): Promise<HistoryTicks> {
  let quotes: number[] = [];
  let pipSize = 2;
  let endEpoch: number | "latest" = "latest";
  let remaining = totalCount;

  while (remaining > 0) {
    const chunkSize = Math.min(remaining, MAX_CHUNK);
    const chunk = await fetchChunk(symbol, chunkSize, endEpoch);
    pipSize = chunk.pipSize;
    quotes = [...chunk.quotes, ...quotes];
    remaining -= chunk.quotes.length;
    if (chunk.times.length === 0 || chunk.quotes.length < chunkSize) break; // no more history available
    endEpoch = chunk.times[0] - 1;
  }

  return { quotes, pipSize };
}
