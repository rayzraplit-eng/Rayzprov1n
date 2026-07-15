import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart2, Activity, Pause, Play, Wifi, WifiOff, Loader2,
  TrendingUp, TrendingDown, Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useDerivTicks } from "@/hooks/use-deriv-ticks";

const SYMBOLS = [
  { id: "R_10",    label: "Volatility 10"        },
  { id: "R_25",    label: "Volatility 25"        },
  { id: "R_50",    label: "Volatility 50"        },
  { id: "R_75",    label: "Volatility 75"        },
  { id: "R_100",   label: "Volatility 100"       },
  { id: "1HZ10V",  label: "Volatility 10 (1s)"   },
  { id: "1HZ25V",  label: "Volatility 25 (1s)"   },
  { id: "1HZ50V",  label: "Volatility 50 (1s)"   },
  { id: "1HZ75V",  label: "Volatility 75 (1s)"   },
  { id: "1HZ100V", label: "Volatility 100 (1s)"  },
  { id: "BOOM1000", label: "Boom 1000"           },
  { id: "CRASH500", label: "Crash 500"           },
];

// Analysis window sizes — controls bias/predictor computation only
// The 64-tick history grid always uses the last 64 of the full 1000-tick buffer
const SAMPLE_SIZES = [15, 20, 25, 30, 50, 75, 100, 120, 240, 500, 1000];

type Mode = "over" | "under" | null;

/** Last digit from a raw quote value */
function lastDigit(quote: number, pip_size: number): number {
  const pip = Math.max(0, Math.min(8, pip_size || 2));
  return Math.abs(Math.round(quote * Math.pow(10, pip))) % 10;
}

/**
 * For each digit 0-9 compute:
 *   overRate[d]  = P(next digit > 3  | current digit = d)
 *   underRate[d] = P(next digit < 6  | current digit = d)
 * Returns the strongest predictor digit for each mode.
 */
function computePredictors(digits: number[]) {
  const overHits  = Array(10).fill(0);
  const underHits = Array(10).fill(0);
  const counts    = Array(10).fill(0);

  for (let i = 0; i < digits.length - 1; i++) {
    const cur  = digits[i];
    const next = digits[i + 1];
    counts[cur]++;
    if (next > 3) overHits[cur]++;
    if (next < 6) underHits[cur]++;
  }

  const overRates  = counts.map((c, d) => (c >= 5 ? (overHits[d]  / c) * 100 : 0));
  const underRates = counts.map((c, d) => (c >= 5 ? (underHits[d] / c) * 100 : 0));

  const bestOver  = overRates.reduce((best, r, d) => (r > overRates[best]  ? d : best), 0);
  const bestUnder = underRates.reduce((best, r, d) => (r > underRates[best] ? d : best), 0);

  return {
    overDigit:   bestOver,
    overRate:    overRates[bestOver],
    overCounts:  counts[bestOver],
    underDigit:  bestUnder,
    underRate:   underRates[bestUnder],
    underCounts: counts[bestUnder],
    overRates,
    underRates,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ConnectionBadge({ status }: { status: "connecting" | "open" | "closed" | "error" }) {
  if (status === "open") return (
    <Badge variant="outline" className="font-mono text-[10px] border-primary/40 text-primary bg-primary/10 flex items-center gap-1">
      <Wifi className="h-3 w-3" />LIVE
    </Badge>
  );
  if (status === "connecting") return (
    <Badge variant="outline" className="font-mono text-[10px] border-chart-3/40 text-chart-3 bg-chart-3/10 flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />CONNECTING
    </Badge>
  );
  return (
    <Badge variant="outline" className="font-mono text-[10px] border-destructive/40 text-destructive bg-destructive/10 flex items-center gap-1">
      <WifiOff className="h-3 w-3" />{status.toUpperCase()}
    </Badge>
  );
}

/** OVER / UNDER / none toggle pill */
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border/60 overflow-hidden font-mono text-xs shrink-0">
      {(["over", "under"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(mode === m ? null : m)}
          className={`px-4 py-1.5 transition-all font-bold uppercase tracking-wider ${
            mode === m
              ? m === "over"
                ? "bg-pink-500/20 text-pink-400 border-pink-500/40"
                : "bg-pink-500/20 text-pink-400 border-pink-500/40"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          {m === "over" ? "↑ Over 3" : "↓ Under 6"}
        </button>
      ))}
    </div>
  );
}

/** Signal notification card above the tick grid */
function PredictorSignal({
  mode,
  overDigit, overRate, overCounts,
  underDigit, underRate, underCounts,
}: {
  mode: Mode;
  overDigit: number; overRate: number; overCounts: number;
  underDigit: number; underRate: number; underCounts: number;
}) {
  const THRESHOLD = 60;

  const overOk  = overRate  >= THRESHOLD;
  const underOk = underRate >= THRESHOLD;

  const showOver  = (mode === "over"  || mode === null) && overOk;
  const showUnder = (mode === "under" || mode === null) && underOk;

  if (!showOver && !showUnder) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/30 bg-muted/10 font-mono text-[11px] text-muted-foreground/60">
        <Zap className="h-3.5 w-3.5 shrink-0" />
        No strong predictor digit found yet — accumulate more ticks
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showOver && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-pink-500/30 bg-pink-500/5 animate-in fade-in duration-300">
          <TrendingUp className="h-4 w-4 text-pink-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-mono text-xs text-foreground">
              After digit{" "}
              <span className="font-bold text-pink-400 text-sm">
                {overDigit}
              </span>{" "}
              → next is{" "}
              <span className="font-bold text-pink-400">OVER 3</span>
              {" "}
              <span className="text-muted-foreground">
                {overRate.toFixed(0)}% of the time ({overCounts} samples)
              </span>
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] border-pink-500/40 text-pink-400 bg-pink-500/10 shrink-0">
            OVER 3
          </Badge>
        </div>
      )}
      {showUnder && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-pink-500/30 bg-pink-500/5 animate-in fade-in duration-300">
          <TrendingDown className="h-4 w-4 text-pink-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-mono text-xs text-foreground">
              After digit{" "}
              <span className="font-bold text-pink-400 text-sm">
                {underDigit}
              </span>{" "}
              → next is{" "}
              <span className="font-bold text-pink-400">UNDER 6</span>
              {" "}
              <span className="text-muted-foreground">
                {underRate.toFixed(0)}% of the time ({underCounts} samples)
              </span>
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] border-pink-500/40 text-pink-400 bg-pink-500/10 shrink-0">
            UNDER 6
          </Badge>
        </div>
      )}
    </div>
  );
}

/** 64-tick digit history grid — 8 cols × 8 rows, newest at bottom-right */
function DigitHistoryGrid({
  digits,
  mode,
  predictorDigit,
}: {
  digits: number[];
  mode: Mode;
  predictorDigit: number | null;
}) {
  const grid = digits.slice(-64);
  const latest = grid.length > 0 ? grid[grid.length - 1] : null;

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
      {grid.map((d, i) => {
        const isLatest      = i === grid.length - 1;
        const isPredictor   = mode !== null && d === predictorDigit;
        const isOver        = d > 3;
        const isUnder       = d < 6;

        let cellClass = "";
        if (isPredictor) {
          cellClass = "ring-1 ring-pink-500/60 bg-pink-500/15 text-pink-400 font-extrabold";
        } else if (isLatest) {
          cellClass = "ring-1 ring-foreground/40 bg-foreground/10 text-foreground font-bold";
        } else {
          const overColor  = "text-primary/70";
          const underColor = "text-destructive/70";
          cellClass = `${isOver ? overColor : underColor} opacity-80`;
        }

        return (
          <div
            key={i}
            title={`Tick -${grid.length - 1 - i}: digit ${d}`}
            className={`h-7 flex items-center justify-center rounded font-mono text-xs transition-all duration-200 ${cellClass}`}
          >
            {d}
          </div>
        );
      })}
      {/* Fill empty cells so grid is always 64 */}
      {Array.from({ length: 64 - grid.length }).map((_, i) => (
        <div key={`empty-${i}`} className="h-7 flex items-center justify-center rounded font-mono text-[10px] text-muted-foreground/20">·</div>
      ))}
    </div>
  );
}

/** Live tick flow strip — newest at right, scrolls left */
function LiveTickFlow({
  digits,
  mode,
  predictorDigit,
}: {
  digits: number[];
  mode: Mode;
  predictorDigit: number | null;
}) {
  const recent = digits.slice(-20);

  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {recent.map((d, i) => {
        const isLatest    = i === recent.length - 1;
        const isPredictor = mode !== null && d === predictorDigit;
        const isOver      = d > 3;

        let cls = "";
        if (isPredictor) {
          cls = "bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/50 font-extrabold scale-110";
        } else if (isLatest) {
          cls = "bg-foreground/15 text-foreground ring-1 ring-foreground/30 font-bold scale-110";
        } else {
          cls = isOver
            ? "bg-primary/10 text-primary/70"
            : "bg-destructive/10 text-destructive/70";
        }

        const opacity = Math.max(0.3, (i + 1) / recent.length);

        return (
          <div
            key={i}
            style={{ opacity }}
            className={`shrink-0 h-7 w-7 flex items-center justify-center rounded font-mono text-xs transition-all duration-200 ${cls}`}
          >
            {d}
          </div>
        );
      })}
      {recent.length === 0 && (
        <span className="font-mono text-[11px] text-muted-foreground/40">waiting for ticks…</span>
      )}
    </div>
  );
}

type DigitEntry = { digit: string; count: number; pct: number };

function digitRank(digit: string, sortedByPct: DigitEntry[]): number {
  return sortedByPct.findIndex((d) => d.digit === digit);
}

/**
 * Tile colour priority (predictor pink overrides rank colours):
 *   rank 0 → green (most frequent)
 *   rank 1 → blue  (second most)
 *   rank 8 → yellow (second least)
 *   rank 9 → red   (least frequent)
 *   else   → muted neutral
 */
function digitTileClass(rank: number, isPredictor: boolean): string {
  if (isPredictor) return "border-pink-500/60 bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/30";
  switch (rank) {
    case 0: return "border-green-500/60  bg-green-500/15  text-green-400";
    case 1: return "border-blue-500/60   bg-blue-500/15   text-blue-400";
    case 8: return "border-yellow-500/60 bg-yellow-500/15 text-yellow-400";
    case 9: return "border-destructive/60 bg-destructive/15 text-destructive";
    default: return "border-border/40 bg-muted/20 text-muted-foreground";
  }
}

function digitBarColor(rank: number, isPredictor: boolean): string {
  if (isPredictor) return "bg-pink-500/50";
  switch (rank) {
    case 0: return "bg-green-500/70";
    case 1: return "bg-blue-500/70";
    case 8: return "bg-yellow-500/70";
    case 9: return "bg-destructive/70";
    default: return "bg-muted-foreground/30";
  }
}

function DigitTileGrid({
  digitData,
  sortedByPct,
  mode,
  overDigit,
  underDigit,
}: {
  digitData: DigitEntry[];
  sortedByPct: DigitEntry[];
  mode: Mode;
  overDigit: number;
  underDigit: number;
}) {
  const maxPct = sortedByPct[0]?.pct ?? 1;

  return (
    <div className="space-y-3">
      {/* 10 digit tiles */}
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {digitData.map((d) => {
          const rank = digitRank(d.digit, sortedByPct);
          const isPredictor =
            (mode === "over"  && Number(d.digit) === overDigit)  ||
            (mode === "under" && Number(d.digit) === underDigit);
          const tileClass = digitTileClass(rank, isPredictor);
          const barClass  = digitBarColor(rank, isPredictor);
          const barWidth  = maxPct > 0 ? (d.pct / maxPct) * 100 : 0;

          return (
            <div
              key={d.digit}
              className={`relative flex flex-col items-center gap-1 rounded-lg border py-3 px-1 font-mono transition-all duration-300 ${tileClass}`}
            >
              {/* Digit number */}
              <span className="text-2xl font-extrabold leading-none">{d.digit}</span>

              {/* Mini fill bar */}
              <div className="w-full h-1 rounded-full bg-black/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Percentage */}
              <span className="text-[11px] font-bold tabular-nums">{d.pct.toFixed(1)}%</span>

              {/* Rank badge for top/bottom */}
              {rank === 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-green-500 text-white rounded-full px-1 leading-4">
                  #1
                </span>
              )}
              {rank === 1 && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-blue-500 text-white rounded-full px-1 leading-4">
                  #2
                </span>
              )}
              {rank === 9 && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-destructive text-white rounded-full px-1 leading-4">
                  #10
                </span>
              )}
              {rank === 8 && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-yellow-500 text-black rounded-full px-1 leading-4">
                  #9
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Colour legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground pt-1 border-t border-border/30">
        <span><span className="text-green-400 font-bold">■</span> Most frequent</span>
        <span><span className="text-blue-400 font-bold">■</span> 2nd most</span>
        <span><span className="text-yellow-400 font-bold">■</span> 2nd least</span>
        <span><span className="text-destructive font-bold">■</span> Least frequent</span>
        {mode !== null && <span><span className="text-pink-400 font-bold">■</span> Predictor digit</span>}
      </div>
    </div>
  );
}

function BiasRow({
  label, valueA, valueB, labelA, labelB, total,
}: {
  label: string; valueA: number; valueB: number;
  labelA: string; labelB: string; total: number;
}) {
  const pctA  = total > 0 ? (valueA / total) * 100 : 0;
  const pctB  = total > 0 ? (valueB / total) * 100 : 0;
  const sumPct = pctA + pctB || 1;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground uppercase">
        <span>{label}</span>
        <span>
          <span className="text-primary font-bold">{pctA.toFixed(1)}%</span>
          <span className="mx-1 text-muted-foreground/60">/</span>
          <span className="text-chart-3 font-bold">{pctB.toFixed(1)}%</span>
        </span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded border border-border/50 bg-muted/30 font-mono text-[10px]">
        <div
          className="bg-primary/30 text-primary flex items-center justify-center transition-all"
          style={{ width: `${(pctA / sumPct) * 100}%` }}
        >
          {pctA / sumPct * 100 > 18 ? labelA : ""}
        </div>
        <div
          className="bg-chart-3/30 text-chart-3 flex items-center justify-center transition-all"
          style={{ width: `${(pctB / sumPct) * 100}%` }}
        >
          {pctB / sumPct * 100 > 18 ? labelB : ""}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalisisToolSection() {
  const [symbol,  setSymbol]  = useState<string>("R_75");
  // sample controls the analysis window only (bias/predictor/chart)
  // the 64-tick history grid always reads from the full 1000-tick buffer
  const [sample,  setSample]  = useState<number>(100);
  const [running, setRunning] = useState<boolean>(true);
  const [mode,    setMode]    = useState<Mode>(null);

  // Always keep 1000 ticks buffered so history is available immediately
  const { ticks, status, last, direction } = useDerivTicks(symbol, {
    bufferSize: 1000,
    enabled:    running,
  });

  // ── 64-tick history (independent of sample selection) ──
  const historyDigits = useMemo(
    () => ticks.slice(-64).map((t) => lastDigit(t.quote, t.pip_size)),
    [ticks],
  );

  // ── Analysis window (respects sample selection) ──
  const analysisWindow = ticks.slice(-sample);
  const total          = Math.max(analysisWindow.length, 1);

  const digits = useMemo(
    () => analysisWindow.map((t) => lastDigit(t.quote, t.pip_size)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysisWindow.length, ticks],
  );

  const predictors = useMemo(() => computePredictors(digits), [digits]);

  const predictorDigit: number | null =
    mode === "over"  ? predictors.overDigit  :
    mode === "under" ? predictors.underDigit :
    null;

  const digitData = useMemo(() => {
    const counts = Array.from({ length: 10 }, (_, d) => digits.filter((x) => x === d).length);
    return counts.map((count, d) => ({
      digit: String(d),
      count,
      pct:   +((count / total) * 100).toFixed(2),
    }));
  }, [digits, total]);

  const evenCount    = digits.filter((d) => d % 2 === 0).length;
  const oddCount     = total - evenCount;
  const overCount    = digits.filter((d) => d > 4).length;
  const underCount   = digits.filter((d) => d < 5).length;
  const matchesCount = digits.length > 1
    ? digits.slice(1).filter((d, i) => d === digits[i]).length
    : 0;

  // Rank digits by percentage (descending) to assign highlight colours
  const sortedByPct = useMemo(
    () => [...digitData].sort((a, b) => b.pct - a.pct),
    [digitData],
  );

  return (
    <section className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart2 className="h-7 w-7 text-primary" />
          ANALISIS TOOL
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <ConnectionBadge status={status} />
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="w-[190px] h-9 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map((s) => (
                <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
                  {s.id} — {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(sample)} onValueChange={(v) => setSample(Number(v))}>
            <SelectTrigger className="w-[110px] h-9 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAMPLE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)} className="font-mono text-xs">
                  {n} ticks
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-9 font-mono text-xs"
            onClick={() => setRunning((r) => !r)}
          >
            {running ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {running ? "Pause" : "Resume"}
          </Button>
        </div>
      </div>

      {/* ── Over / Under mode toggle ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground font-mono">
          Highlight the predictor digit for the selected contract
        </p>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* ── Predictor signal notification ── */}
      <PredictorSignal
        mode={mode}
        overDigit={predictors.overDigit}
        overRate={predictors.overRate}
        overCounts={predictors.overCounts}
        underDigit={predictors.underDigit}
        underRate={predictors.underRate}
        underCounts={predictors.underCounts}
      />

      {/* ── Live tick flow + 64-tick history ── */}
      <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Last 64 Ticks
            </CardTitle>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-muted-foreground">LIVE</span>
              <span
                className={`font-bold transition-colors ${
                  direction === "up"   ? "text-primary"     :
                  direction === "down" ? "text-destructive" :
                  "text-foreground"
                }`}
              >
                {last ? last.quote.toFixed(last.pip_size || 2) : "—"}
              </span>
              <Badge variant="outline" className="font-mono text-[10px] border-border/60">{symbol}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {historyDigits.length === 0 ? (
            <div className="h-24 flex flex-col items-center justify-center text-muted-foreground font-mono text-sm gap-2">
              {status === "connecting" || status === "open" ? (
                <><Loader2 className="h-5 w-5 animate-spin text-primary" /><span>Loading history…</span></>
              ) : (
                <><WifiOff className="h-5 w-5 text-destructive" /><span>WebSocket {status}</span></>
              )}
            </div>
          ) : (
            <>
              {/* Tick flow strip — uses full buffer newest ticks */}
              <div className="space-y-1">
                <p className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest">Live flow →</p>
                <LiveTickFlow digits={historyDigits} mode={mode} predictorDigit={predictorDigit} />
              </div>

              {/* 64-tick grid — always last 64 from full buffer, independent of sample */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest">
                    Last 64 digits (newest → bottom-right) · {ticks.length} ticks loaded
                  </p>
                  {mode !== null && predictorDigit !== null && (
                    <span className="font-mono text-[9px] text-pink-400">
                      ■ digit {predictorDigit} = {mode === "over" ? "over 3" : "under 6"} predictor
                    </span>
                  )}
                </div>
                <DigitHistoryGrid digits={historyDigits} mode={mode} predictorDigit={predictorDigit} />
              </div>

              {/* Digit legend */}
              <div className="flex gap-3 font-mono text-[9px] text-muted-foreground/60 pt-0.5 flex-wrap">
                <span><span className="text-primary">■</span> digit ≥4 (over side)</span>
                <span><span className="text-destructive">■</span> digit ≤3 (under side)</span>
                {mode !== null && <span><span className="text-pink-400">■</span> predictor digit</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Distribution chart + bias stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Digit Distribution · {digits.length.toLocaleString()} ticks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {digits.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground font-mono text-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" /> Loading…
              </div>
            ) : (
              <DigitTileGrid
                digitData={digitData}
                sortedByPct={sortedByPct}
                mode={mode}
                overDigit={predictors.overDigit}
                underDigit={predictors.underDigit}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">Bias Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BiasRow label="Even/Odd" valueA={evenCount} valueB={oddCount} labelA="EVEN" labelB="ODD" total={total} />
            <BiasRow label="Over/Under" valueA={overCount} valueB={underCount} labelA="OVER 4" labelB="UNDER 5" total={total} />
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div>
                <div className="font-mono font-bold text-sm">Matches</div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">consecutive same-digit</div>
              </div>
              <div className="text-right font-mono">
                <div className="text-lg font-bold text-foreground">{matchesCount}</div>
                <div className="text-[11px] text-muted-foreground">{((matchesCount / Math.max(total - 1, 1)) * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono pt-2 border-t border-border/40">
              {digits.length.toLocaleString()} / {sample.toLocaleString()} ticks analysed · {ticks.length} total loaded · {running ? "live" : "paused"}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
