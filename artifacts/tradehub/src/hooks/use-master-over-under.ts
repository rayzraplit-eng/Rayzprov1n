import { useEffect, useRef, useState } from "react";
import { useDerivTicks } from "./use-deriv-ticks";
import { getLastDigit } from "./use-master-trader";

export const MARTINGALE = 1.8;

export type StrategySide = "over" | "under";

export type StrategyStatus =
  | "idle"
  | "buffering"
  | "watching"
  | "trading"
  | "recovering"
  | "max-losses";

export type OverUnderTrade = {
  id: string;
  side: StrategySide;
  contract: string;
  barrier: number;
  digit: number;
  stake: number;
  result: "win" | "loss";
  recovery: boolean;
  epoch: number;
};

type SideState = {
  status: StrategyStatus;
  streak: number;
  currentStake: number;
  consecutiveLosses: number;
  inRecovery: boolean;
  lastEpoch: number;
};

function freshSide(baseStake: number): SideState {
  return {
    status: "buffering",
    streak: 0,
    currentStake: baseStake,
    consecutiveLosses: 0,
    inRecovery: false,
    lastEpoch: 0,
  };
}

/**
 * Master Over 2 / Under 7 strategy:
 *
 * OVER side — entry: 2+ consecutive digits <=2, then a trigger digit of exactly 3
 *   -> buy DIGITOVER barrier 2. On loss, recover with DIGITOVER barrier 4 every
 *   tick (no entry condition) with stake x1.8 until a win, then reset.
 *
 * UNDER side — entry: 2+ consecutive digits >=7, then a trigger digit < 6
 *   -> buy DIGITUNDER barrier 7. On loss, recover with DIGITUNDER barrier 5 every
 *   tick (no entry condition) with stake x1.8 until a win, then reset.
 *
 * Both sides run independently off the same tick stream.
 */
export function useMasterOverUnder(
  symbol: string,
  baseStake: number,
  maxLosses: number,
  enabled: boolean,
) {
  const { ticks, status: wsStatus } = useDerivTicks(symbol, {
    bufferSize: 500,
    enabled,
  });

  const [overStatus, setOverStatus] = useState<StrategyStatus>("idle");
  const [underStatus, setUnderStatus] = useState<StrategyStatus>("idle");
  const [overStake, setOverStake] = useState(baseStake);
  const [underStake, setUnderStake] = useState(baseStake);
  const [overLosses, setOverLosses] = useState(0);
  const [underLosses, setUnderLosses] = useState(0);
  const [trades, setTrades] = useState<OverUnderTrade[]>([]);

  const overRef = useRef<SideState>(freshSide(baseStake));
  const underRef = useRef<SideState>(freshSide(baseStake));
  const lastEpochRef = useRef(0);

  // Reset on disable or when base stake / symbol changes
  useEffect(() => {
    overRef.current = freshSide(baseStake);
    underRef.current = freshSide(baseStake);
    lastEpochRef.current = 0;
    setOverStatus(enabled ? "buffering" : "idle");
    setUnderStatus(enabled ? "buffering" : "idle");
    setOverStake(baseStake);
    setUnderStake(baseStake);
    setOverLosses(0);
    setUnderLosses(0);
    setTrades([]);
  }, [enabled, baseStake, symbol]);

  useEffect(() => {
    if (!enabled) return;
    if (ticks.length < 3) return;

    const lastTick = ticks[ticks.length - 1]!;
    if (lastTick.epoch === lastEpochRef.current) return;
    lastEpochRef.current = lastTick.epoch;

    const digits = ticks.map(getLastDigit);
    const n = digits.length;
    const currentDigit = digits[n - 1]!;
    const prev = digits.slice(0, -1);

    function consecutiveTail(test: (d: number) => boolean): number {
      let count = 0;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (test(prev[i]!)) count++;
        else break;
      }
      return count;
    }

    /* ── OVER side ── */
    {
      const s = overRef.current;
      if (s.status !== "max-losses") {
        let fired = false;
        let contract = "DIGITOVER";
        let barrier = 2;

        if (s.inRecovery) {
          // Recovery: trade every tick, no condition, always OVER 4
          barrier = 4;
          fired = true;
        } else {
          s.status = "watching";
          const streak = consecutiveTail((d) => d <= 2);
          s.streak = streak;
          if (streak >= 2 && currentDigit === 3) {
            barrier = 2;
            fired = true;
          }
        }

        if (fired) {
          const isWin = s.inRecovery ? currentDigit > barrier : currentDigit > 2;
          const trade: OverUnderTrade = {
            id: `over-${lastTick.epoch}-${Math.random().toString(36).slice(2)}`,
            side: "over",
            contract,
            barrier,
            digit: currentDigit,
            stake: s.currentStake,
            result: isWin ? "win" : "loss",
            recovery: s.inRecovery,
            epoch: lastTick.epoch,
          };
          setTrades((prevT) => [trade, ...prevT].slice(0, 80));

          if (isWin) {
            s.inRecovery = false;
            s.currentStake = baseStake;
            s.consecutiveLosses = 0;
            s.status = "watching";
            setOverStake(baseStake);
            setOverLosses(0);
            setOverStatus("watching");
          } else {
            s.consecutiveLosses++;
            setOverLosses(s.consecutiveLosses);
            if (s.consecutiveLosses >= maxLosses) {
              s.status = "max-losses";
              setOverStatus("max-losses");
            } else {
              s.inRecovery = true;
              s.currentStake = parseFloat((s.currentStake * MARTINGALE).toFixed(2));
              setOverStake(s.currentStake);
              s.status = "recovering";
              setOverStatus("recovering");
            }
          }
        } else if (s.status !== "recovering") {
          setOverStatus("watching");
        }
      }
    }

    /* ── UNDER side ── */
    {
      const s = underRef.current;
      if (s.status !== "max-losses") {
        let fired = false;
        let barrier = 7;

        if (s.inRecovery) {
          // Recovery: trade every tick, no condition, always UNDER 5
          barrier = 5;
          fired = true;
        } else {
          s.status = "watching";
          const streak = consecutiveTail((d) => d >= 7);
          s.streak = streak;
          if (streak >= 2 && currentDigit < 6) {
            barrier = 7;
            fired = true;
          }
        }

        if (fired) {
          const isWin = currentDigit < barrier;
          const trade: OverUnderTrade = {
            id: `under-${lastTick.epoch}-${Math.random().toString(36).slice(2)}`,
            side: "under",
            contract: "DIGITUNDER",
            barrier,
            digit: currentDigit,
            stake: s.currentStake,
            result: isWin ? "win" : "loss",
            recovery: s.inRecovery,
            epoch: lastTick.epoch,
          };
          setTrades((prevT) => [trade, ...prevT].slice(0, 80));

          if (isWin) {
            s.inRecovery = false;
            s.currentStake = baseStake;
            s.consecutiveLosses = 0;
            s.status = "watching";
            setUnderStake(baseStake);
            setUnderLosses(0);
            setUnderStatus("watching");
          } else {
            s.consecutiveLosses++;
            setUnderLosses(s.consecutiveLosses);
            if (s.consecutiveLosses >= maxLosses) {
              s.status = "max-losses";
              setUnderStatus("max-losses");
            } else {
              s.inRecovery = true;
              s.currentStake = parseFloat((s.currentStake * MARTINGALE).toFixed(2));
              setUnderStake(s.currentStake);
              s.status = "recovering";
              setUnderStatus("recovering");
            }
          }
        } else if (s.status !== "recovering") {
          setUnderStatus("watching");
        }
      }
    }
  }, [ticks, enabled, maxLosses, baseStake]);

  const recentDigits = ticks.slice(-20).map(getLastDigit);

  return {
    wsStatus,
    tickCount: ticks.length,
    recentDigits,
    over: {
      status: overStatus,
      stake: overStake,
      consecutiveLosses: overLosses,
    },
    under: {
      status: underStatus,
      stake: underStake,
      consecutiveLosses: underLosses,
    },
    trades,
  };
}
