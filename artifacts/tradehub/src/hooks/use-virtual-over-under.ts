import { useEffect, useRef, useState } from "react";
import { useDerivTicks } from "./use-deriv-ticks";
import { getLastDigit } from "./use-master-trader";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VouTradeType = "over4" | "over3" | "under5" | "under6";
export type VouMode      = "over" | "under";
export type VouPhase     = "entry" | "recovery";

export type VouTrade = {
  id:          string;
  type:        VouTradeType;
  stake:       number;
  result:      "win" | "loss";
  actualDigit: number;
  epoch:       number;
  pnl:         number;
};

// Approximate profit-on-stake payouts (Deriv digit contracts):
// over4 / under5 → 50% win rate  → ~95% payout
// over3 / under6 → 60% win rate  → ~65% payout (6 of 10 digits win)
export const VOU_PAYOUT: Record<VouTradeType, number> = {
  over4:  0.95,
  under5: 0.95,
  over3:  0.65,
  under6: 0.65,
};

export type VirtualMarketStatus =
  | "buffering"
  | "watching"
  | "trading"
  | "max-losses"
  | "disabled";

export type VirtualMarketState = {
  symbol:            string;
  label:             string;
  wsOpen:            boolean;
  status:            VirtualMarketStatus;
  mode:              VouMode | null;
  phase:             VouPhase | null;
  currentType:       VouTradeType | null;
  currentStake:      number;
  consecutiveLosses: number;
  totalWins:         number;
  totalLosses:       number;
  totalPnl:          number;
  trades:            VouTrade[];
  recentDigits:      number[];
  tickCount:         number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MARTINGALE   = 2;
const TICKS_WINDOW = 1; // result settles on the very next tick (no skipping)

function isWin(type: VouTradeType, digit: number): boolean {
  if (type === "over4")  return digit > 4;
  if (type === "over3")  return digit > 3;
  if (type === "under5") return digit < 5;
  return digit < 6; // under6
}

/** last 4 digits are all ≤ 4 */
function allLow(digits: number[]): boolean {
  if (digits.length < 4) return false;
  return digits.slice(-4).every((d) => d <= 4);
}

/** last 4 digits are all ≥ 5 */
function allHigh(digits: number[]): boolean {
  if (digits.length < 4) return false;
  return digits.slice(-4).every((d) => d >= 5);
}

// ─── Per-market internal ref ──────────────────────────────────────────────────

type MarketRef = {
  status:            VirtualMarketStatus;
  mode:              VouMode | null;
  phase:             VouPhase | null;
  tradeActive:       boolean;
  ticksSinceTrade:   number;
  currentStake:      number;
  consecutiveLosses: number;
  totalWins:         number;
  totalLosses:       number;
  totalPnl:          number;
  trades:            VouTrade[];
  lastEpoch:         number;
};

function makeMarketRef(baseStake: number): MarketRef {
  return {
    status:            "buffering",
    mode:              null,
    phase:             null,
    tradeActive:       false,
    ticksSinceTrade:   0,
    currentStake:      baseStake,
    consecutiveLosses: 0,
    totalWins:         0,
    totalLosses:       0,
    totalPnl:          0,
    trades:            [],
    lastEpoch:         0,
  };
}

// ─── Single-market sub-hook ───────────────────────────────────────────────────

function useVirtualMarket(
  symbol:    string,
  label:     string,
  baseStake: number,
  maxLosses: number,
  stopped:   boolean, // global max-profit or user-stopped
  enabled:   boolean,
): VirtualMarketState {
  const { ticks, status: wsStatus } = useDerivTicks(symbol, {
    bufferSize: 50,
    enabled,
  });

  const [state, setState] = useState<Omit<VirtualMarketState, "symbol" | "label">>({
    wsOpen:            false,
    status:            "buffering",
    mode:              null,
    phase:             null,
    currentType:       null,
    currentStake:      baseStake,
    consecutiveLosses: 0,
    totalWins:         0,
    totalLosses:       0,
    totalPnl:          0,
    trades:            [],
    recentDigits:      [],
    tickCount:         0,
  });

  const ref = useRef<MarketRef>(makeMarketRef(baseStake));

  // Reset when disabled
  useEffect(() => {
    if (enabled) return;
    ref.current = makeMarketRef(baseStake);
    setState({
      wsOpen: false, status: "disabled", mode: null, phase: null, currentType: null,
      currentStake: baseStake, consecutiveLosses: 0, totalWins: 0, totalLosses: 0,
      totalPnl: 0, trades: [], recentDigits: [], tickCount: 0,
    });
  }, [enabled, baseStake]);

  useEffect(() => {
    if (!enabled) return;

    const r = ref.current;

    if (ticks.length < 4) {
      if (r.status !== "buffering") {
        r.status = "buffering";
        setState((s) => ({ ...s, wsOpen: wsStatus === "open", status: "buffering", tickCount: ticks.length }));
      }
      return;
    }

    const lastTick = ticks[ticks.length - 1]!;
    if (lastTick.epoch === r.lastEpoch) return;
    r.lastEpoch = lastTick.epoch;

    // Stop processing if this market already hit its loss cap
    if (r.status === "max-losses") return;

    const digits      = ticks.map(getLastDigit);
    const digit       = digits[digits.length - 1]!;
    const recentDigits = digits.slice(-8);

    if (r.status === "buffering") {
      r.status = "watching";
    }

    // ── Resolve active trade ────────────────────────────────────────────────
    // NOTE: active trades always resolve even when globally stopped (max-profit)
    //       Only new ENTRIES are blocked by the stopped flag (see bottom of effect).
    if (r.tradeActive) {
      r.ticksSinceTrade++;
      if (r.ticksSinceTrade < TICKS_WINDOW) {
        setState((s) => ({ ...s, wsOpen: wsStatus === "open", recentDigits, tickCount: ticks.length }));
        return;
      }
      r.ticksSinceTrade = 0;

      const tradeType: VouTradeType =
        r.phase === "entry"
          ? (r.mode === "over" ? "over4" : "under5")
          : (r.mode === "over" ? "over3" : "under6");

      const win    = isWin(tradeType, digit);
      const payout = VOU_PAYOUT[tradeType];
      const pnl    = win ? +(r.currentStake * payout).toFixed(2) : -r.currentStake;

      r.totalPnl = parseFloat((r.totalPnl + pnl).toFixed(2));

      const trade: VouTrade = {
        id:          `${lastTick.epoch}-${Math.random().toString(36).slice(2)}`,
        type:        tradeType,
        stake:       r.currentStake,
        result:      win ? "win" : "loss",
        actualDigit: digit,
        epoch:       lastTick.epoch,
        pnl,
      };
      r.trades = [trade, ...r.trades].slice(0, 40);

      if (win) {
        r.totalWins++;
        // Reset this market to watching
        r.tradeActive       = false;
        r.mode              = null;
        r.phase             = null;
        r.currentStake      = baseStake;
        r.consecutiveLosses = 0;
        r.status            = "watching";
        setState({
          wsOpen: wsStatus === "open",
          status: "watching", mode: null, phase: null, currentType: null,
          currentStake: baseStake, consecutiveLosses: 0,
          totalWins: r.totalWins, totalLosses: r.totalLosses, totalPnl: r.totalPnl,
          trades: r.trades, recentDigits, tickCount: ticks.length,
        });
      } else {
        r.totalLosses++;
        r.consecutiveLosses++;
        r.currentStake = parseFloat((r.currentStake * MARTINGALE).toFixed(2));

        if (r.consecutiveLosses >= maxLosses) {
          r.status      = "max-losses";
          r.tradeActive = false;
          setState({
            wsOpen: wsStatus === "open",
            status: "max-losses", mode: r.mode, phase: r.phase, currentType: null,
            currentStake: r.currentStake, consecutiveLosses: r.consecutiveLosses,
            totalWins: r.totalWins, totalLosses: r.totalLosses, totalPnl: r.totalPnl,
            trades: r.trades, recentDigits, tickCount: ticks.length,
          });
          return;
        }

        // Immediately continue recovery (no tick skipping)
        r.phase        = "recovery";
        r.tradeActive  = true;
        r.ticksSinceTrade = 0;
        const nextType: VouTradeType = r.mode === "over" ? "over3" : "under6";
        setState({
          wsOpen: wsStatus === "open",
          status: "trading", mode: r.mode, phase: "recovery", currentType: nextType,
          currentStake: r.currentStake, consecutiveLosses: r.consecutiveLosses,
          totalWins: r.totalWins, totalLosses: r.totalLosses, totalPnl: r.totalPnl,
          trades: r.trades, recentDigits, tickCount: ticks.length,
        });
      }
      return;
    }

    // ── Watch for entry pattern ────────────────────────────────────────────────
    // New entries are blocked when globally stopped (max-profit reached or user stopped).
    // Active trade resolution above still proceeds regardless of stopped.
    if (stopped) {
      setState((s) => ({ ...s, wsOpen: wsStatus === "open", recentDigits, tickCount: ticks.length }));
      return;
    }

    // Over 4 entry: last 4 digits all ≤ 4
    // Under 5 entry: last 4 digits all ≥ 5
    const overEntry  = allLow(digits);
    const underEntry = allHigh(digits);

    if (overEntry) {
      r.mode            = "over";
      r.phase           = "entry";
      r.tradeActive     = true;
      r.ticksSinceTrade = 0;
      r.status          = "trading";
      setState({
        wsOpen: wsStatus === "open",
        status: "trading", mode: "over", phase: "entry", currentType: "over4",
        currentStake: r.currentStake, consecutiveLosses: r.consecutiveLosses,
        totalWins: r.totalWins, totalLosses: r.totalLosses, totalPnl: r.totalPnl,
        trades: r.trades, recentDigits, tickCount: ticks.length,
      });
    } else if (underEntry) {
      r.mode            = "under";
      r.phase           = "entry";
      r.tradeActive     = true;
      r.ticksSinceTrade = 0;
      r.status          = "trading";
      setState({
        wsOpen: wsStatus === "open",
        status: "trading", mode: "under", phase: "entry", currentType: "under5",
        currentStake: r.currentStake, consecutiveLosses: r.consecutiveLosses,
        totalWins: r.totalWins, totalLosses: r.totalLosses, totalPnl: r.totalPnl,
        trades: r.trades, recentDigits, tickCount: ticks.length,
      });
    } else {
      // Update display only
      if (r.status === "watching") {
        setState((s) => ({ ...s, wsOpen: wsStatus === "open", recentDigits, tickCount: ticks.length }));
      }
    }
  }, [ticks, enabled, stopped, baseStake, maxLosses, wsStatus]);

  return { symbol, label, ...state };
}

// ─── Main hook (all 10 markets) ───────────────────────────────────────────────

export function useVirtualOverUnder(
  baseStake: number,
  maxProfit: number,
  maxLosses: number,
  enabled:   boolean,
) {
  // Aggregate PnL checked against maxProfit to stop new trades
  const [totalPnlSnapshot, setTotalPnlSnapshot] = useState(0);

  const isMaxProfit = enabled && totalPnlSnapshot >= maxProfit && maxProfit > 0 && totalPnlSnapshot > 0;

  // Each market stops entry when globally stopped
  const stopped = isMaxProfit || !enabled;

  // Fixed hook calls — one per symbol (React rules: no loops)
  const m0  = useVirtualMarket("R_10",    "Volatility 10",  baseStake, maxLosses, stopped, enabled);
  const m1  = useVirtualMarket("R_25",    "Volatility 25",  baseStake, maxLosses, stopped, enabled);
  const m2  = useVirtualMarket("R_50",    "Volatility 50",  baseStake, maxLosses, stopped, enabled);
  const m3  = useVirtualMarket("R_75",    "Volatility 75",  baseStake, maxLosses, stopped, enabled);
  const m4  = useVirtualMarket("R_100",   "Volatility 100", baseStake, maxLosses, stopped, enabled);
  const m5  = useVirtualMarket("1HZ10V",  "Vol 10 (1s)",    baseStake, maxLosses, stopped, enabled);
  const m6  = useVirtualMarket("1HZ25V",  "Vol 25 (1s)",    baseStake, maxLosses, stopped, enabled);
  const m7  = useVirtualMarket("1HZ50V",  "Vol 50 (1s)",    baseStake, maxLosses, stopped, enabled);
  const m8  = useVirtualMarket("1HZ75V",  "Vol 75 (1s)",    baseStake, maxLosses, stopped, enabled);
  const m9  = useVirtualMarket("1HZ100V", "Vol 100 (1s)",   baseStake, maxLosses, stopped, enabled);

  const markets: VirtualMarketState[] = [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9];

  const totalPnl    = parseFloat(markets.reduce((s, m) => s + m.totalPnl,    0).toFixed(2));
  const totalWins   = markets.reduce((s, m) => s + m.totalWins,   0);
  const totalLosses = markets.reduce((s, m) => s + m.totalLosses, 0);
  const activeCount = markets.filter((m) => m.status === "trading").length;
  const readyCount  = markets.filter((m) => m.status !== "buffering" && m.status !== "disabled").length;

  // Sync snapshot for maxProfit gate
  useEffect(() => {
    setTotalPnlSnapshot(totalPnl);
  }, [totalPnl]);

  return {
    markets,
    totalPnl,
    totalWins,
    totalLosses,
    activeCount,
    readyCount,
    isMaxProfit,
  };
}
