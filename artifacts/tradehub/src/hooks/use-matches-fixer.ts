import { useEffect, useRef, useState } from "react";
import { useDerivTicks } from "./use-deriv-ticks";
import { getLastDigit } from "./use-master-trader";

export type FixerStatus =
  | "idle"
  | "buffering"
  | "watching"
  | "trading"
  | "won"
  | "max-losses";

export type FixerTrade = {
  id: string;
  targetDigit: number;
  actualDigit: number;
  stake: number;
  result: "win" | "loss";
  epoch: number;
};

type InternalRef = {
  prevLeading:       number | null;
  targetDigit:       number | null;
  currentStake:      number;
  consecutiveLosses: number;
  lastEpoch:         number;
  status:            FixerStatus;
};

function modeDigit(digits: number[]): number {
  const counts = new Array(10).fill(0) as number[];
  for (const d of digits) counts[d]++;
  let best = -1;
  let mode = 0;
  for (let i = 0; i < 10; i++) {
    if (counts[i]! > best) { best = counts[i]!; mode = i; }
  }
  return mode;
}

export function useMatchesFixer(
  symbol:    string,
  baseStake: number,
  maxLosses: number,
  enabled:   boolean,
) {
  const { ticks, status: wsStatus } = useDerivTicks(symbol, {
    bufferSize: 500,
    enabled,
  });

  const [status,            setStatus]            = useState<FixerStatus>("idle");
  const [leadingDigit,      setLeadingDigit]      = useState<number | null>(null);
  const [targetDigit,       setTargetDigit]       = useState<number | null>(null);
  const [currentStake,      setCurrentStake]      = useState(baseStake);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [trades,            setTrades]            = useState<FixerTrade[]>([]);

  const ref = useRef<InternalRef>({
    prevLeading:       null,
    targetDigit:       null,
    currentStake:      baseStake,
    consecutiveLosses: 0,
    lastEpoch:         0,
    status:            "idle",
  });

  // Reset everything when disabled or baseStake changes
  useEffect(() => {
    if (enabled) return;
    ref.current = {
      prevLeading:       null,
      targetDigit:       null,
      currentStake:      baseStake,
      consecutiveLosses: 0,
      lastEpoch:         0,
      status:            "idle",
    };
    setStatus("idle");
    setLeadingDigit(null);
    setTargetDigit(null);
    setCurrentStake(baseStake);
    setConsecutiveLosses(0);
    setTrades([]);
  }, [enabled, baseStake]);

  useEffect(() => {
    if (!enabled) return;
    if (ticks.length < 20) {
      if (ref.current.status !== "buffering") {
        ref.current.status = "buffering";
        setStatus("buffering");
      }
      return;
    }

    const r = ref.current;
    if (r.status === "won" || r.status === "max-losses") return;

    const lastTick = ticks[ticks.length - 1]!;
    if (lastTick.epoch === r.lastEpoch) return;
    r.lastEpoch = lastTick.epoch;

    const window20  = ticks.slice(-20).map(getLastDigit);
    const leading   = modeDigit(window20);
    const lastDigit = getLastDigit(lastTick);

    setLeadingDigit(leading);

    if (r.targetDigit === null) {
      // Not yet in trading mode — watch for a shift
      if (r.status !== "watching") {
        r.status = "watching";
        setStatus("watching");
      }

      const shifted = r.prevLeading !== null && leading !== r.prevLeading;
      r.prevLeading = leading;

      if (!shifted) return;

      // Shift detected — enter trading mode with the new leading digit as target
      r.targetDigit = leading;
      r.status      = "trading";
      setTargetDigit(leading);
      setStatus("trading");
      // Fall through to evaluate this tick as first trade
    }

    // Evaluate current tick as a trade result
    const isWin = lastDigit === r.targetDigit;
    const trade: FixerTrade = {
      id:          `${lastTick.epoch}-${Math.random().toString(36).slice(2)}`,
      targetDigit: r.targetDigit!,
      actualDigit: lastDigit,
      stake:       r.currentStake,
      result:      isWin ? "win" : "loss",
      epoch:       lastTick.epoch,
    };
    setTrades((prev) => [trade, ...prev].slice(0, 60));

    if (isWin) {
      r.status = "won";
      setStatus("won");
      return;
    }

    // Loss — apply martingale
    r.consecutiveLosses++;
    setConsecutiveLosses(r.consecutiveLosses);

    if (r.consecutiveLosses >= maxLosses) {
      r.status = "max-losses";
      setStatus("max-losses");
      return;
    }

    r.currentStake = parseFloat((r.currentStake * 1.3).toFixed(2));
    setCurrentStake(r.currentStake);
  }, [ticks, enabled, maxLosses]);

  const recentDigits = ticks.slice(-20).map(getLastDigit);

  return {
    status,
    wsStatus,
    trades,
    leadingDigit,
    targetDigit,
    currentStake,
    consecutiveLosses,
    tickCount: ticks.length,
    recentDigits,
  };
}
