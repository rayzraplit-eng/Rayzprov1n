import { useEffect, useRef, useState } from "react";
import { useDerivTicks } from "./use-deriv-ticks";
import { getLastDigit } from "./use-master-trader";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProStatus    = "idle" | "buffering" | "watching" | "trading" | "max-profit" | "max-losses";
export type ProMode      = "over" | "under";
export type ProPhase     = "entry" | "rec-watch" | "recovery";
export type ProTradeType = "over2" | "over4" | "under7" | "under5";

export type ProTrade = {
  id:          string;
  type:        ProTradeType;
  stake:       number;
  result:      "win" | "loss";
  actualDigit: number;
  epoch:       number;
  pnl:         number;
};

// Approximate profit-on-stake multipliers (Deriv digit over/under payouts)
export const PAYOUT_MULTIPLIER: Record<ProTradeType, number> = {
  over2:  0.85, // ~70% win rate
  over4:  0.95, // ~50% win rate
  under7: 0.85,
  under5: 0.95,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MARTINGALE    = 1.8;
const TICKS_WINDOW  = 1;  // result arrives on the next tick after the trade
const MIN_STREAK    = 2;  // consecutive low/high digits required for entry

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWin(type: ProTradeType, digit: number): boolean {
  if (type === "over2")  return digit > 2;
  if (type === "over4")  return digit > 4;
  if (type === "under7") return digit < 7;
  return digit < 5; // under5
}

function entryType(mode: ProMode): ProTradeType {
  return mode === "over" ? "over2" : "under7";
}

function recoveryType(mode: ProMode): ProTradeType {
  return mode === "over" ? "over4" : "under5";
}

// ─── Internal ref ─────────────────────────────────────────────────────────────

type InternalRef = {
  status:            ProStatus;
  mode:              ProMode | null;
  phase:             ProPhase | null;
  tradeActive:       boolean;
  ticksSinceTrade:   number;
  consecLow:         number;  // streak of digits ≤2 (OVER entry tracking)
  consecHigh:        number;  // streak of digits ≥7 (UNDER entry tracking)
  prevDigit:         number | null; // used in rec-watch for pattern detection
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
    consecLow:         0,
    consecHigh:        0,
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

export function useOver2Under7Pro(
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

  const [status,            setStatus]            = useState<ProStatus>("idle");
  const [mode,              setMode]              = useState<ProMode | null>(null);
  const [phase,             setPhase]             = useState<ProPhase | null>(null);
  const [currentType,       setCurrentType]       = useState<ProTradeType | null>(null);
  const [currentStake,      setCurrentStake]      = useState(baseStake);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [consecLowUI,       setConsecLowUI]       = useState(0);
  const [consecHighUI,      setConsecHighUI]      = useState(0);
  const [totalWins,         setTotalWins]         = useState(0);
  const [totalLosses,       setTotalLosses]       = useState(0);
  const [totalPnl,          setTotalPnl]          = useState(0);
  const [trades,            setTrades]            = useState<ProTrade[]>([]);
  const [recentDigits,      setRecentDigits]      = useState<number[]>([]);

  const ref = useRef<InternalRef>(makeRef(baseStake));

  // Reset when bot is stopped
  useEffect(() => {
    if (enabled) return;
    ref.current = makeRef(baseStake);
    setStatus("idle");
    setMode(null);
    setPhase(null);
    setCurrentType(null);
    setCurrentStake(baseStake);
    setConsecutiveLosses(0);
    setConsecLowUI(0);
    setConsecHighUI(0);
    setTotalWins(0);
    setTotalLosses(0);
    setTotalPnl(0);
    setTrades([]);
    setRecentDigits([]);
  }, [enabled, baseStake]);

  useEffect(() => {
    if (!enabled) return;

    // Need at least 2 ticks to start watching
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

    // Don't process any more ticks once auto-stopped
    if (r.status === "max-profit" || r.status === "max-losses") return;

    const digit = getLastDigit(lastTick);
    setRecentDigits(ticks.slice(-14).map(getLastDigit));

    // Transition out of initial states
    if (r.status === "idle" || r.status === "buffering") {
      r.status = "watching";
      setStatus("watching");
    }

    // ── Active trade: wait for result ────────────────────────────────────────
    if (r.tradeActive) {
      r.ticksSinceTrade++;
      if (r.ticksSinceTrade < TICKS_WINDOW) return;

      r.ticksSinceTrade = 0;
      const type   = r.phase === "entry" ? entryType(r.mode!) : recoveryType(r.mode!);
      const win    = isWin(type, digit);
      const payout = PAYOUT_MULTIPLIER[type];
      const pnl    = win ? +(r.currentStake * payout).toFixed(2) : -r.currentStake;

      r.totalPnl = parseFloat((r.totalPnl + pnl).toFixed(2));
      setTotalPnl(r.totalPnl);

      const trade: ProTrade = {
        id:          `${lastTick.epoch}-${Math.random().toString(36).slice(2)}`,
        type,
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

        // Check max-profit stop condition
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

        // Reset and resume watching
        r.tradeActive       = false;
        r.mode              = null;
        r.phase             = null;
        r.currentStake      = baseStake;
        r.consecutiveLosses = 0;
        r.consecLow         = 0;
        r.consecHigh        = 0;
        r.prevDigit         = null;
        r.status            = "watching";
        setMode(null);
        setPhase(null);
        setCurrentType(null);
        setCurrentStake(baseStake);
        setConsecutiveLosses(0);
        setConsecLowUI(0);
        setConsecHighUI(0);
        setStatus("watching");
      } else {
        // Loss — apply martingale, then decide next phase
        r.totalLosses++;
        setTotalLosses(r.totalLosses);
        r.consecutiveLosses++;
        r.currentStake = parseFloat((r.currentStake * MARTINGALE).toFixed(2));
        setCurrentStake(r.currentStake);
        setConsecutiveLosses(r.consecutiveLosses);

        // Check max-losses stop condition
        if (r.consecutiveLosses >= maxLosses) {
          r.status      = "max-losses";
          r.tradeActive = false;
          setStatus("max-losses");
          setCurrentType(null);
          return;
        }

        if (r.phase === "entry") {
          // Entry loss → move to recovery-watch (wait for re-trigger pattern)
          // The loss digit itself seeds the prevDigit for recovery detection:
          //   OVER: loss digit ≤2 is already the start of "digit≤2 → digit≥3"
          //   UNDER: loss digit ≥7 is already the start of "digit≥7 → digit≤6"
          r.phase       = "rec-watch";
          r.tradeActive = false;
          r.prevDigit   = digit;
          r.status      = "watching";
          setPhase("rec-watch");
          setCurrentType(null);
          setStatus("watching");
        } else {
          // Recovery loss → continue trading same type (no wait, continuous)
          r.tradeActive     = true;
          r.ticksSinceTrade = 0;
          // phase stays "recovery"
        }
      }
      return;
    }

    // ── Recovery-watch: look for re-trigger pattern ───────────────────────────
    if (r.phase === "rec-watch") {
      const prev  = r.prevDigit;
      r.prevDigit = digit;

      const overRecovery  = r.mode === "over"  && prev !== null && prev <= 2 && digit >= 3;
      const underRecovery = r.mode === "under" && prev !== null && prev >= 7 && digit <= 6;

      if (overRecovery || underRecovery) {
        r.phase           = "recovery";
        r.tradeActive     = true;
        r.ticksSinceTrade = 0;
        r.status          = "trading";
        setPhase("recovery");
        setCurrentType(r.mode === "over" ? "over4" : "under5");
        setStatus("trading");
      }
      return;
    }

    // ── Watching: look for entry pattern ─────────────────────────────────────
    // Check triggers BEFORE updating streaks (digit IS the potential trigger)
    const overEntry  = r.consecLow  >= MIN_STREAK && digit >= 3;
    const underEntry = r.consecHigh >= MIN_STREAK && digit <= 6;

    // Update consecutive streaks
    if (digit <= 2) {
      r.consecLow++;
      r.consecHigh = 0;
    } else if (digit >= 7) {
      r.consecHigh++;
      r.consecLow = 0;
    } else {
      r.consecLow  = 0;
      r.consecHigh = 0;
    }

    setConsecLowUI(r.consecLow);
    setConsecHighUI(r.consecHigh);

    if (overEntry) {
      r.mode            = "over";
      r.phase           = "entry";
      r.tradeActive     = true;
      r.ticksSinceTrade = 0;
      r.consecLow       = 0;
      r.consecHigh      = 0;
      r.status          = "trading";
      setMode("over");
      setPhase("entry");
      setCurrentType("over2");
      setConsecLowUI(0);
      setConsecHighUI(0);
      setStatus("trading");
    } else if (underEntry) {
      r.mode            = "under";
      r.phase           = "entry";
      r.tradeActive     = true;
      r.ticksSinceTrade = 0;
      r.consecLow       = 0;
      r.consecHigh      = 0;
      r.status          = "trading";
      setMode("under");
      setPhase("entry");
      setCurrentType("under7");
      setConsecLowUI(0);
      setConsecHighUI(0);
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
    consecLow:  consecLowUI,
    consecHigh: consecHighUI,
    consecutiveLosses,
    totalWins,
    totalLosses,
    totalPnl,
    trades,
    recentDigits,
    tickCount: ticks.length,
  };
}
