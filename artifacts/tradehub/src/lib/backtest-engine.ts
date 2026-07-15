// Deterministic backtest replayer for the digit-pattern bots.
//
// Each bot's live trading hook (see src/hooks/use-*.ts) reacts to the tick
// stream in real time. To evaluate historical performance we replay the
// exact same entry/recovery rules over a fixed sequence of last-digits and
// tally the outcome digit-by-digit, using the same stake multipliers and
// payout assumptions the live bots use. This file intentionally mirrors
// those rules — if a live bot's entry logic changes, update it here too.

export type BacktestTrade = {
  index:  number;       // position in the digit sequence when the trade settled
  result: "win" | "loss";
  pnl:    number;
};

export type BacktestResult = {
  trades:          BacktestTrade[];
  wins:            number;
  losses:          number;
  totalTrades:     number;
  winRate:         number;      // 0-100
  netPnl:          number;
  maxWinStreak:    number;
  maxLossStreak:   number;
  endingStreak:    { type: "win" | "loss" | "none"; count: number };
};

export const BACKTEST_BOTS = [
  { id: "matches-fixer",     label: "Matches Fixer" },
  { id: "reverse-ou",        label: "Reverse Over/Under" },
  { id: "over2-under7-pro",  label: "Over 2 Under 7 Pro" },
  { id: "under8-over1-pro",  label: "Under 8 Over 1 Pro" },
  { id: "virtual-ou",        label: "Virtual Over Under" },
  { id: "master-ou",         label: "Master Over Under" },
  { id: "differs-pro",       label: "Differs Pro" },
] as const;

export type BacktestBotId = typeof BACKTEST_BOTS[number]["id"];

export const BACKTEST_DURATIONS = [
  { id: 1000,  label: "Last 1,000 ticks" },
  { id: 5000,  label: "Last 5,000 ticks" },
  { id: 10000, label: "Last 10,000 ticks" },
  { id: 20000, label: "Last 20,000 ticks" },
] as const;

function finalize(trades: BacktestTrade[]): BacktestResult {
  let wins = 0, losses = 0, netPnl = 0;
  let maxWinStreak = 0, maxLossStreak = 0;
  let curWinStreak = 0, curLossStreak = 0;

  for (const t of trades) {
    netPnl += t.pnl;
    if (t.result === "win") {
      wins++;
      curWinStreak++;
      curLossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, curWinStreak);
    } else {
      losses++;
      curLossStreak++;
      curWinStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, curLossStreak);
    }
  }

  const totalTrades = trades.length;
  const endingStreak =
    curWinStreak > 0  ? { type: "win" as const,  count: curWinStreak }  :
    curLossStreak > 0 ? { type: "loss" as const, count: curLossStreak } :
    { type: "none" as const, count: 0 };

  return {
    trades, wins, losses, totalTrades,
    winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    netPnl, maxWinStreak, maxLossStreak, endingStreak,
  };
}

/** Runs a martingale sequence with a fixed number of steps; returns [stake, payoutMultiplier] winnings for a win at a given step, or the loss (stake) for a loss. */
function runMartingaleWin(baseStake: number, multiplier: number, step: number, payoutPct: number): number {
  const stake = baseStake * Math.pow(multiplier, step);
  return stake * (payoutPct / 100);
}
function runMartingaleLoss(baseStake: number, multiplier: number, step: number): number {
  return -baseStake * Math.pow(multiplier, step);
}

// ── Matches Fixer ────────────────────────────────────────────────────────
// Mode digit of last 20 ticks; when the mode shifts, fire DIGITMATCH on the
// new mode. 1-tick settlement. ×1.3 martingale, resets on win.
function simMatchesFixer(digits: number[], baseStake: number): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let step = 0;
  let lastMode: number | null = null;

  const modeOf = (win: number[]) => {
    const counts = new Array(10).fill(0);
    win.forEach((d) => counts[d]++);
    let best = 0;
    for (let d = 1; d < 10; d++) if (counts[d] > counts[best]) best = d;
    return best;
  };

  for (let i = 20; i < digits.length - 1; i++) {
    const window = digits.slice(i - 20, i);
    const mode = modeOf(window);
    if (lastMode === null) { lastMode = mode; continue; }
    if (mode !== lastMode) {
      lastMode = mode;
      const outcomeDigit = digits[i + 1];
      const win = outcomeDigit === mode;
      trades.push({
        index: i + 1,
        result: win ? "win" : "loss",
        pnl: win ? runMartingaleWin(baseStake, 1.3, step, 900) : runMartingaleLoss(baseStake, 1.3, step),
      });
      step = win ? 0 : step + 1;
    }
  }
  return trades;
}

// ── Reverse Over/Under ───────────────────────────────────────────────────
function simReverseOU(digits: number[], baseStake: number): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let step = 0;
  let recovering = false;

  for (let i = 1; i < digits.length - 1; i++) {
    const prev = digits[i - 1], curr = digits[i];
    const overEntry  = prev >= 8 && curr <= 2;
    const underEntry = prev <= 1 && curr >= 7;
    if (!recovering && (overEntry || underEntry)) {
      const isOver = overEntry;
      const outcome = digits[i + 1];
      const win = isOver ? outcome > 2 : outcome < 7;
      trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 1.8, step, 85) : runMartingaleLoss(baseStake, 1.8, step) });
      if (win) { step = 0; recovering = false; }
      else { step += 1; recovering = true; }
    } else if (recovering) {
      const overEntry2  = prev <= 2 && curr >= 3;
      const underEntry2 = prev >= 7 && curr <= 6;
      const isOver = overEntry2;
      if (overEntry2 || underEntry2) {
        const outcome = digits[i + 1];
        const win = isOver ? outcome > 4 : outcome < 5;
        trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 1.8, step, 95) : runMartingaleLoss(baseStake, 1.8, step) });
        if (win) { step = 0; recovering = false; }
        else { step += 1; }
      }
    }
  }
  return trades;
}

// ── Over 2 Under 7 Pro ───────────────────────────────────────────────────
function simOver2Under7Pro(digits: number[], baseStake: number): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let step = 0;
  let recovering = false;

  for (let i = 2; i < digits.length - 1; i++) {
    const a = digits[i - 2], b = digits[i - 1], curr = digits[i];
    const overEntry  = a <= 2 && b <= 2 && curr >= 3;
    const underEntry = a >= 7 && b >= 7 && curr <= 6;
    if (!recovering && (overEntry || underEntry)) {
      const isOver = overEntry;
      const outcome = digits[i + 1];
      const win = isOver ? outcome > 2 : outcome < 7;
      trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 1.8, step, 85) : runMartingaleLoss(baseStake, 1.8, step) });
      if (win) { step = 0; recovering = false; } else { step += 1; recovering = true; }
    } else if (recovering) {
      const prev = digits[i - 1];
      const overEntry2  = prev <= 2 && curr >= 3;
      const underEntry2 = prev >= 7 && curr <= 6;
      if (overEntry2 || underEntry2) {
        const isOver = overEntry2;
        const outcome = digits[i + 1];
        const win = isOver ? outcome > 4 : outcome < 5;
        trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 1.8, step, 95) : runMartingaleLoss(baseStake, 1.8, step) });
        if (win) { step = 0; recovering = false; } else { step += 1; }
      }
    }
  }
  return trades;
}

// ── Under 8 Over 1 Pro ───────────────────────────────────────────────────
function simUnder8Over1Pro(digits: number[], baseStake: number): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let step = 0;
  let recovering = false;
  let recoverIsOver = false;

  for (let i = 100; i < digits.length - 1; i++) {
    const window = digits.slice(i - 100, i);
    const counts = new Array(10).fill(0);
    window.forEach((d) => counts[d]++);
    const ranked = counts.map((c, d) => ({ d, c })).sort((x, y) => x.c - y.c);
    const leastFive = new Set(ranked.slice(0, 5).map((x) => x.d));
    const prev = digits[i - 1], curr = digits[i];

    if (!recovering) {
      const underEntry = leastFive.has(8) && leastFive.has(9) && prev >= 8 && curr <= 7;
      const overEntry  = leastFive.has(0) && leastFive.has(1) && prev <= 1 && curr >= 2;
      if (underEntry || overEntry) {
        const isOver = overEntry;
        const outcome = digits[i + 1];
        const win = isOver ? outcome > 1 : outcome < 8;
        trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 1.8, step, 6) : runMartingaleLoss(baseStake, 1.8, step) });
        if (win) { step = 0; } else { step += 1; recovering = true; recoverIsOver = isOver; }
      }
    } else {
      const outcome = digits[i + 1];
      const win = recoverIsOver ? outcome > 4 : outcome < 5;
      trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 1.8, step, 95) : runMartingaleLoss(baseStake, 1.8, step) });
      if (win) { step = 0; recovering = false; } else { step += 1; }
    }
  }
  return trades;
}

// ── Virtual Over Under (single-symbol replay of its per-symbol rule) ────
function simVirtualOU(digits: number[], baseStake: number): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let step = 0;
  let recovering = false;
  let recoverIsOver = false;

  for (let i = 4; i < digits.length - 1; i++) {
    const last4 = digits.slice(i - 4, i);
    if (!recovering) {
      const overEntry  = last4.every((d) => d <= 4);
      const underEntry = last4.every((d) => d >= 5);
      if (overEntry || underEntry) {
        const isOver = overEntry;
        const outcome = digits[i + 1];
        const win = isOver ? outcome > 4 : outcome < 5;
        trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 2.0, step, 95) : runMartingaleLoss(baseStake, 2.0, step) });
        if (win) { step = 0; } else { step += 1; recovering = true; recoverIsOver = isOver; }
      }
    } else {
      const outcome = digits[i + 1];
      const win = recoverIsOver ? outcome > 3 : outcome < 6;
      trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 2.0, step, 65) : runMartingaleLoss(baseStake, 2.0, step) });
      if (win) { step = 0; recovering = false; } else { step += 1; }
    }
  }
  return trades;
}

// ── Master Over Under ────────────────────────────────────────────────────
function simMasterOU(digits: number[], baseStake: number): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let step = 0;
  let recovering = false;
  let recoverIsOver = false;

  for (let i = 2; i < digits.length - 1; i++) {
    const a = digits[i - 2], b = digits[i - 1], curr = digits[i];
    if (!recovering) {
      const overEntry  = a <= 2 && b <= 2 && curr === 3;
      const underEntry = a >= 7 && b >= 7 && curr < 6;
      if (overEntry || underEntry) {
        const isOver = overEntry;
        const outcome = digits[i + 1];
        const win = isOver ? outcome > 2 : outcome < 7;
        trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 1.8, step, 85) : runMartingaleLoss(baseStake, 1.8, step) });
        if (win) { step = 0; } else { step += 1; recovering = true; recoverIsOver = isOver; }
      }
    } else {
      const outcome = digits[i + 1];
      const win = recoverIsOver ? outcome > 4 : outcome < 5;
      trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 1.8, step, 95) : runMartingaleLoss(baseStake, 1.8, step) });
      if (win) { step = 0; recovering = false; } else { step += 1; }
    }
  }
  return trades;
}

// ── Differs Pro ──────────────────────────────────────────────────────────
function simDiffersPro(digits: number[], baseStake: number): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let step = 0;
  let recovering = false;
  let recoverIsOver = false;
  let lastLeast: number | null = null;

  for (let i = 75; i < digits.length - 1; i++) {
    const window = digits.slice(i - 75, i);
    const counts = new Array(10).fill(0);
    window.forEach((d) => counts[d]++);
    let least = 0;
    for (let d = 1; d < 10; d++) if (counts[d] < counts[least]) least = d;

    if (!recovering) {
      if (lastLeast !== null && least !== lastLeast) {
        const outcome = digits[i + 1];
        const win = outcome !== least;
        trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 2.0, step, 11) : runMartingaleLoss(baseStake, 2.0, step) });
        if (win) { step = 0; } else {
          step += 1; recovering = true;
          const recent20 = digits.slice(Math.max(0, i - 20), i);
          const avg = recent20.reduce((s, d) => s + d, 0) / Math.max(1, recent20.length);
          recoverIsOver = avg <= 4.5;
        }
      }
      lastLeast = least;
    } else {
      const prev = digits[i - 1], curr = digits[i];
      const ready = recoverIsOver ? (prev <= 3 && curr >= 4) : (prev >= 6 && curr <= 5);
      if (ready) {
        const outcome = digits[i + 1];
        const win = recoverIsOver ? outcome > 3 : outcome < 6;
        trades.push({ index: i + 1, result: win ? "win" : "loss", pnl: win ? runMartingaleWin(baseStake, 2.0, step, 65) : runMartingaleLoss(baseStake, 2.0, step) });
        if (win) { step = 0; recovering = false; } else { step += 1; }
      }
      lastLeast = least;
    }
  }
  return trades;
}

const SIMULATORS: Record<BacktestBotId, (digits: number[], baseStake: number) => BacktestTrade[]> = {
  "matches-fixer":    simMatchesFixer,
  "reverse-ou":       simReverseOU,
  "over2-under7-pro": simOver2Under7Pro,
  "under8-over1-pro": simUnder8Over1Pro,
  "virtual-ou":       simVirtualOU,
  "master-ou":        simMasterOU,
  "differs-pro":      simDiffersPro,
};

/** Derives last-digits from raw quotes given a pip size (mirrors getLastDigit in use-master-trader.ts). */
export function quotesToDigits(quotes: number[], pipSize: number): number[] {
  const scale = Math.pow(10, pipSize);
  return quotes.map((q) => Math.floor(Math.round(q * scale)) % 10);
}

export function runBacktest(botId: BacktestBotId, quotes: number[], pipSize: number, baseStake: number): BacktestResult {
  const digits = quotesToDigits(quotes, pipSize);
  const sim = SIMULATORS[botId];
  return finalize(sim(digits, baseStake));
}
