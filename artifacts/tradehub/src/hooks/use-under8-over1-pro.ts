import { useEffect, useRef, useState } from "react";
import { useDerivTicks } from "./use-deriv-ticks";
import { getLastDigit } from "./use-master-trader";

// ─── Types ────────────────────────────────────────────────────────────────────

export type U8O1Status    = "idle" | "buffering" | "watching" | "trading" | "max-profit" | "max-losses";
export type U8O1Mode      = "under" | "over";
export type U8O1Phase     = "entry" | "recovery";
export type U8O1TradeType = "under8" | "under5" | "over1" | "over4";

export type U8O1Trade = {
  id:          string;
  type:        U8O1TradeType;
  stake:       number;
  result:      "win" | "loss";
  actualDigit: number;
  epoch:       number;
  pnl:         number;
};

// Approximate profit-on-stake multipliers (Deriv digit contract payouts)
// under8 / over1  → ~80% win rate → low payout (~6%)
// under5 / over4  → ~50% win rate → higher payout (~95%)
export const U8O1_PAYOUT: Record<U8O1TradeType, number> = {
  under8: 0.06,
  over1:  0.06,
  under5: 0.95,
  over4:  0.95,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MARTINGALE   = 1.8;
const TICKS_WINDOW = 1;   // result settles on the next tick after the trade

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWin(type: U8O1TradeType, digit: number): boolean {
  if (type === "under8") return digit < 8;
  if (type === "under5") return digit < 5;
  if (type === "over1")  return digit > 1;
  return digit > 4; // over4
}

/**
 * Returns true if BOTH target digits are in the lower half of digit
 * frequencies over the last 100 ticks (i.e. "among the least frequent").
 */
function areAmongLeast(window100: number[], d1: number, d2: number): boolean {
  if (window100.length < 100) return false;
  const counts = Array(10).fill(0) as number[];
  for (const d of window100) counts[d]!++;
  // Sort counts ascending; take the 5th value as the lower-half threshold
  const threshold = [...counts].sort((a, b) => a - b)[4]!;
  return counts[d1]! <= threshold && counts[d2]! <= threshold;
}

// ─── Internal ref ─────────────────────────────────────────────────────────────

type InternalRef = {
  status:            U8O1Status;
  mode:              U8O1Mode | null;
  phase:             U8O1Phase | null;
  tradeActive:       boolean;
  ticksSinceTrade:   number;
  prevDigit:         number | null;
  currentStake:      number;
  consecutiveLosses: number;
  totalWins:         number;
  totalLosses:       number;
  totalPnl:          number;
  lastEpoch:         number;
};

function makeRef(baseStake: number): InternalRef {
  return {
    status:            "idle",
    mode:              null,
    phase:             null,
    tradeActive:       false,
    ticksSinceTrade:   0,
    prevDigit:         null,
    currentStake:      baseStake,
    consecutiveLosses: 0,
    totalWins:         0,
    totalLosses:       0,
    totalPnl:          0,
    lastEpoch:         0,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUnder8Over1Pro(
  symbol:    string,
  baseStake: number,
  maxProfit: number,
  maxLosses: number,
  enabled:   boolean,
) {
  const { ticks, status: wsStatus } = useDerivTicks(symbol, {
    bufferSize: 300,
    enabled,
  });

  const [status,            setStatus]            = useState<U8O1Status>("idle");
  const [mode,              setMode]              = useState<U8O1Mode | null>(null);
  const [phase,             setPhase]             = useState<U8O1Phase | null>(null);
  const [currentType,       setCurrentType]       = useState<U8O1TradeType | null>(null);
  const [currentStake,      setCurrentStake]      = useState(baseStake);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [totalWins,         setTotalWins]         = useState(0);
  const [totalLosses,       setTotalLosses]       = useState(0);
  const [totalPnl,          setTotalPnl]          = useState(0);
  const [trades,            setTrades]            = useState<U8O1Trade[]>([]);
  const [recentDigits,      setRecentDigits]      = useState<number[]>([]);
  // Live display of how under-represented {8,9} and {0,1} are
  const [pct89,             setPct89]             = useState(0);
  const [pct01,             setPct01]             = useState(0);

  const ref = useRef<InternalRef>(makeRef(baseStake));

  // ── Reset on stop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (enabled) return;
    ref.current = makeRef(baseStake);
    setStatus("idle");
    setMode(null);
    setPhase(null);
    setCurrentType(null);
    setCurrentStake(baseStake);
    setConsecutiveLosses(0);
    setTotalWins(0);
    setTotalLosses(0);
    setTotalPnl(0);
    setTrades([]);
    setRecentDigits([]);
    setPct89(0);
    setPct01(0);
  }, [enabled, baseStake]);

  // ── Main tick processor ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    if (ticks.length < 2) {
      if (ref.current.status !== "buffering") {
        ref.current.status = "buffering";
        setStatus("buffering");
      }
      return;
    }

    const r        = ref.current;
    const lastTick = ticks[ticks.length - 1]!;
    if (lastTick.epoch === r.lastEpoch) return;
    r.lastEpoch = lastTick.epoch;

    if (r.status === "max-profit" || r.status === "max-losses") return;

    const digit = getLastDigit(lastTick);
    setRecentDigits(ticks.slice(-14).map(getLastDigit));

    // Update live digit-pair frequency display
    const allDigits  = ticks.map(getLastDigit);
    const window100  = allDigits.slice(-100);
    if (window100.length >= 100) {
      const cnt = Array(10).fill(0) as number[];
      for (const d of window100) cnt[d]!++;
      setPct89(((cnt[8]! + cnt[9]!) / 100) * 100);
      setPct01(((cnt[0]! + cnt[1]!) / 100) * 100);
    }

    if (r.status === "idle" || r.status === "buffering") {
      r.status = "watching";
      setStatus("watching");
    }

    // ── Active trade: await result ────────────────────────────────────────────
    if (r.tradeActive) {
      r.ticksSinceTrade++;
      if (r.ticksSinceTrade < TICKS_WINDOW) return;

      r.ticksSinceTrade = 0;

      const tradeType: U8O1TradeType =
        r.phase === "entry"
          ? (r.mode === "under" ? "under8" : "over1")
          : (r.mode === "under" ? "under5" : "over4");

      const win    = isWin(tradeType, digit);
      const payout = U8O1_PAYOUT[tradeType];
      const pnl    = win ? +(r.currentStake * payout).toFixed(2) : -r.currentStake;

      r.totalPnl = parseFloat((r.totalPnl + pnl).toFixed(2));
      setTotalPnl(r.totalPnl);

      const trade: U8O1Trade = {
        id:          `${lastTick.epoch}-${Math.random().toString(36).slice(2)}`,
        type:        tradeType,
        stake:       r.currentStake,
        result:      win ? "win" : "loss",
        actualDigit: digit,
        epoch:       lastTick.epoch,
        pnl,
      };
      setTrades((prev) => [trade, ...prev].slice(0, 60));

      if (win) {
        r.totalWins++;
        setTotalWins(r.totalWins);

        // Check max-profit stop
        if (r.totalPnl >= maxProfit) {
          r.status      = "max-profit";
          r.tradeActive = false;
          r.mode        = null;
          r.phase       = null;
          setStatus("max-profit");
          setMode(null);
          setPhase(null);
          setCurrentType(null);
          return;
        }

        // Reset to watching after any win
        r.tradeActive       = false;
        r.mode              = null;
        r.phase             = null;
        r.currentStake      = baseStake;
        r.consecutiveLosses = 0;
        r.prevDigit         = digit; // keep digit as prev for next entry detection
        r.status            = "watching";
        setMode(null);
        setPhase(null);
        setCurrentType(null);
        setCurrentStake(baseStake);
        setConsecutiveLosses(0);
        setStatus("watching");
      } else {
        // Loss → escalate stake and move to continuous recovery
        r.totalLosses++;
        setTotalLosses(r.totalLosses);
        r.consecutiveLosses++;
        r.currentStake = parseFloat((r.currentStake * MARTINGALE).toFixed(2));
        setCurrentStake(r.currentStake);
        setConsecutiveLosses(r.consecutiveLosses);

        if (r.consecutiveLosses >= maxLosses) {
          r.status      = "max-losses";
          r.tradeActive = false;
          setStatus("max-losses");
          setCurrentType(null);
          return;
        }

        // Move to (or stay in) recovery — continuous, no re-watch needed
        r.phase           = "recovery";
        r.tradeActive     = true;
        r.ticksSinceTrade = 0;
        setPhase("recovery");
        setCurrentType(r.mode === "under" ? "under5" : "over4");
        // status remains "trading"
      }
      return;
    }

    // ── Watching: detect entry pattern ────────────────────────────────────────
    const prev     = r.prevDigit;
    r.prevDigit    = digit;
    if (prev === null) return;

    // Under 8 entry:
    //   • digits 8 and 9 are both among the least frequent in last 100 ticks
    //   • previous tick digit was ≥8, current tick digit ≤7
    const underEntry =
      areAmongLeast(window100, 8, 9) &&
      prev >= 8 && digit <= 7;

    // Over 1 entry:
    //   • digits 0 and 1 are both among the least frequent in last 100 ticks
    //   • previous tick digit was ≤1, current tick digit ≥2
    const overEntry =
      areAmongLeast(window100, 0, 1) &&
      prev <= 1 && digit >= 2;

    if (underEntry) {
      r.mode            = "under";
      r.phase           = "entry";
      r.tradeActive     = true;
      r.ticksSinceTrade = 0;
      r.status          = "trading";
      setMode("under");
      setPhase("entry");
      setCurrentType("under8");
      setStatus("trading");
    } else if (overEntry) {
      r.mode            = "over";
      r.phase           = "entry";
      r.tradeActive     = true;
      r.ticksSinceTrade = 0;
      r.status          = "trading";
      setMode("over");
      setPhase("entry");
      setCurrentType("over1");
      setStatus("trading");
    }
  }, [ticks, enabled, baseStake, maxProfit, maxLosses]);

  return {
    status,
    wsStatus,
    mode,
    phase,
    currentType,
    currentStake,
    consecutiveLosses,
    totalWins,
    totalLosses,
    totalPnl,
    trades,
    recentDigits,
    tickCount: ticks.length,
    pct89,
    pct01,
  };
}
