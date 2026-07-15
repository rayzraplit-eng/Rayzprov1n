import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play, Square, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Eye, Loader2,
  ArrowLeftRight, Target,
} from "lucide-react";
import {
  useReverseOverUnder,
  PAYOUT_MULTIPLIER,
  type RouStatus,
  type RouMode,
  type RouPhase,
  type RouTradeType,
  type RouTrade,
} from "@/hooks/use-reverse-over-under";

const SYMBOLS = [
  { id: "R_10",    label: "Volatility 10"  },
  { id: "R_25",    label: "Volatility 25"  },
  { id: "R_50",    label: "Volatility 50"  },
  { id: "R_75",    label: "Volatility 75"  },
  { id: "R_100",   label: "Volatility 100" },
  { id: "1HZ10V",  label: "Vol 10 (1s)"   },
  { id: "1HZ25V",  label: "Vol 25 (1s)"   },
  { id: "1HZ50V",  label: "Vol 50 (1s)"   },
  { id: "1HZ75V",  label: "Vol 75 (1s)"   },
  { id: "1HZ100V", label: "Vol 100 (1s)"  },
] as const;

const TRADE_META: Record<RouTradeType, { label: string; cls: string; winCls: string }> = {
  over2:  { label: "OVER 2",  cls: "border-sky-500/60 text-sky-400 bg-sky-500/10",           winCls: "text-sky-400"     },
  over4:  { label: "OVER 4",  cls: "border-chart-3/60 text-chart-3 bg-chart-3/10",           winCls: "text-chart-3"    },
  under7: { label: "UNDER 7", cls: "border-violet-500/60 text-violet-400 bg-violet-500/10",  winCls: "text-violet-400" },
  under5: { label: "UNDER 5", cls: "border-rose-500/60 text-rose-400 bg-rose-500/10",        winCls: "text-rose-400"   },
};

const STATUS_LABEL: Record<RouStatus, string> = {
  idle:      "IDLE",
  buffering: "LOADING",
  watching:  "WATCHING",
  trading:   "TRADING",
};

function TypeBadge({ type }: { type: RouTradeType }) {
  const m = TRADE_META[type];
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase shrink-0 ${m.cls}`}>
      {m.label}
    </Badge>
  );
}

// Small coloured digit tile
function DigitTile({ digit, highlight, prev }: { digit: number; highlight?: boolean; prev?: boolean }) {
  const isOver = digit > 6;
  const isUnder = digit < 3;
  return (
    <span className={`font-mono text-xs w-6 h-6 rounded flex items-center justify-center font-bold shrink-0 transition-all ${
      highlight
        ? "bg-primary text-primary-foreground scale-110"
        : prev
        ? isOver
          ? "bg-sky-500/20 text-sky-400"
          : isUnder
          ? "bg-violet-500/20 text-violet-400"
          : "bg-muted text-muted-foreground"
        : "bg-muted/60 text-muted-foreground/60"
    }`}>
      {digit}
    </span>
  );
}

function TradeRow({ trade, isNew }: { trade: RouTrade; isNew: boolean }) {
  const m    = TRADE_META[trade.type];
  const isW  = trade.result === "win";
  const pnl  = trade.pnl;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs transition-all duration-300 ${
      isNew
        ? isW ? "border-primary/40 bg-primary/5" : "border-rose-500/30 bg-rose-500/5"
        : "border-border/40 bg-transparent"
    }`}>
      {isW
        ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
        : <XCircle      className="h-3.5 w-3.5 text-rose-400 shrink-0"  />}
      <TypeBadge type={trade.type} />
      <span className="text-muted-foreground">→</span>
      <span className={`font-bold ${isW ? m.winCls : "text-rose-400"}`}>{trade.actualDigit}</span>
      <span className={`ml-auto font-bold tabular-nums ${pnl >= 0 ? "text-primary" : "text-rose-400"}`}>
        {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
      </span>
    </div>
  );
}

function PatternHints() {
  return (
    <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5 space-y-1">
        <div className="flex items-center gap-1 font-bold text-sky-400">
          <TrendingUp className="h-3 w-3" /> OVER SIDE
        </div>
        <div className="text-muted-foreground">Prev: <span className="text-sky-400">8</span> or <span className="text-sky-400">9</span></div>
        <div className="text-muted-foreground">Next: <span className="text-sky-400">0, 1 or 2</span></div>
        <div className="text-muted-foreground/70 mt-1">Entry → <span className="text-sky-400">Over 2</span></div>
        <div className="text-muted-foreground/70">Loss → <span className="text-chart-3">Over 4</span> ×1.8</div>
      </div>
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-1">
        <div className="flex items-center gap-1 font-bold text-violet-400">
          <TrendingDown className="h-3 w-3" /> UNDER SIDE
        </div>
        <div className="text-muted-foreground">Prev: <span className="text-violet-400">0</span> or <span className="text-violet-400">1</span></div>
        <div className="text-muted-foreground">Next: <span className="text-violet-400">7, 8 or 9</span></div>
        <div className="text-muted-foreground/70 mt-1">Entry → <span className="text-violet-400">Under 7</span></div>
        <div className="text-muted-foreground/70">Loss → <span className="text-rose-400">Under 5</span> ×1.8</div>
      </div>
    </div>
  );
}

type Cfg = { symbol: string; stake: string };

function BotEngine({ cfg, onStop }: { cfg: Cfg; onStop: () => void }) {
  const base = parseFloat(cfg.stake) || 1;

  const {
    status, wsStatus,
    mode, phase, currentType,
    currentStake, consecutiveLosses,
    totalWins, totalLosses, totalPnl,
    trades, recentDigits, tickCount,
  } = useReverseOverUnder(cfg.symbol, base, true);

  const newTradeId = trades[0]?.id ?? "";

  const isLoading = status === "buffering";

  // Derive P&L color
  const pnlPositive = totalPnl > 0;
  const pnlZero     = totalPnl === 0;

  return (
    <div className="space-y-3 animate-in fade-in duration-300">

      {/* ── Top stat row ── */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2 text-center">
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Wins</div>
          <div className="font-mono text-sm font-bold text-primary">{totalWins}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2 text-center">
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Losses</div>
          <div className={`font-mono text-sm font-bold ${totalLosses > 0 ? "text-rose-400" : "text-foreground"}`}>{totalLosses}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2 text-center">
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Stake</div>
          <div className="font-mono text-sm font-bold text-foreground">${currentStake.toFixed(2)}</div>
        </div>
        <div className={`rounded-lg border p-2 text-center ${
          pnlZero     ? "border-border/50 bg-muted/20"
          : pnlPositive ? "border-primary/30 bg-primary/5"
          : "border-rose-500/30 bg-rose-500/5"
        }`}>
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide mb-1">P&L</div>
          <div className={`font-mono text-sm font-bold tabular-nums ${
            pnlZero ? "text-foreground" : pnlPositive ? "text-primary" : "text-rose-400"
          }`}>
            {pnlPositive ? "+" : ""}{totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* ── Mode indicator strip ── */}
      {mode && (
        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
          mode === "over"
            ? "border-sky-500/30 bg-sky-500/5"
            : "border-violet-500/30 bg-violet-500/5"
        }`}>
          {mode === "over"
            ? <TrendingUp className="h-4 w-4 text-sky-400 shrink-0" />
            : <TrendingDown className="h-4 w-4 text-violet-400 shrink-0" />}
          <div className="font-mono text-xs flex-1">
            <span className={`font-bold ${mode === "over" ? "text-sky-400" : "text-violet-400"}`}>
              {mode.toUpperCase()} MODE
            </span>
            {phase === "recovery" && (
              <span className="text-muted-foreground ml-2">
                recovery · {consecutiveLosses} loss{consecutiveLosses !== 1 ? "es" : ""} · ×1.8
              </span>
            )}
          </div>
          {currentType && <TypeBadge type={currentType} />}
          {phase === "recovery" && (
            <Badge variant="outline" className="font-mono text-[9px] border-chart-3/40 text-chart-3 bg-chart-3/10 shrink-0">
              RECOVERY
            </Badge>
          )}
        </div>
      )}

      {/* ── Recent digits strip ── */}
      {recentDigits.length > 0 && (
        <div className="flex items-center gap-1 px-0.5 overflow-x-auto">
          <span className="font-mono text-[9px] text-muted-foreground uppercase shrink-0 mr-1">DIGITS</span>
          {recentDigits.map((d, i) => (
            <DigitTile
              key={i}
              digit={d}
              highlight={i === recentDigits.length - 1}
              prev={i === recentDigits.length - 2}
            />
          ))}
          {currentType && (
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <span className="font-mono text-[9px] text-muted-foreground">→</span>
              <TypeBadge type={currentType} />
              <span className="font-mono text-[9px] text-muted-foreground">in {TICKS_WINDOW - 0}t</span>
            </div>
          )}
        </div>
      )}

      {/* ── Status + controls ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase ${
            status === "watching"  ? "border-primary/50 text-primary bg-primary/10"
            : status === "trading" ? "border-sky-500/50 text-sky-400 bg-sky-500/10 animate-pulse"
            : status === "buffering" ? "border-chart-3/50 text-chart-3 bg-chart-3/10"
            : "border-border/40 text-muted-foreground"
          }`}>
            {isLoading && <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />}
            {STATUS_LABEL[status]}
          </Badge>
          {wsStatus === "open" && (
            <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
              {tickCount} ticks
            </span>
          )}
        </div>
        <Button size="sm" variant="destructive" className="font-mono text-xs h-7 gap-1" onClick={onStop}>
          <Square className="h-3 w-3" /> Stop
        </Button>
      </div>

      {/* ── Trade log ── */}
      {trades.length > 0 ? (
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">Trade Log</div>
          {trades.map((t) => (
            <TradeRow key={t.id} trade={t} isNew={t.id === newTradeId} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/40 bg-muted/5 p-4 text-center">
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5 animate-spin" />
              <p className="font-mono text-xs text-muted-foreground">Collecting ticks… {tickCount}/2</p>
            </>
          ) : (
            <>
              <Eye className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
              <p className="font-mono text-xs text-muted-foreground">Watching for pattern…</p>
              <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">
                Over: prev 8/9 → next 0/1/2 · Under: prev 0/1 → next 7/8/9
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TICKS_WINDOW = 2;

type Cfg2 = { symbol: string; stake: string };

export function ReverseOverUnderInline() {
  const [cfg, setCfg]   = useState<Cfg2 | null>(null);
  const [form, setForm] = useState<Cfg2>({ symbol: "R_100", stake: "1" });

  if (cfg) {
    return <BotEngine cfg={cfg} onStop={() => setCfg(null)} />;
  }

  const stakeVal = parseFloat(form.stake);
  const canStart = stakeVal > 0;

  // Preview martingale run
  const stakes = [stakeVal];
  for (let i = 0; i < 4; i++) {
    stakes.push(parseFloat((stakes[stakes.length - 1]! * 1.8).toFixed(2)));
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">

      <p className="text-xs text-muted-foreground leading-relaxed">
        Watches for high-digit reversal patterns. Enters <span className="text-sky-400 font-bold">Over 2</span> or{" "}
        <span className="text-violet-400 font-bold">Under 7</span> on trigger.
        On loss, switches to <span className="text-chart-3 font-bold">Over 4 / Under 5</span> recovery every 2 ticks
        with <span className="text-foreground font-bold">×1.8 martingale</span>. Resets on win.
      </p>

      <PatternHints />

      {/* Config */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">Market</Label>
          <Select value={form.symbol} onValueChange={(v) => setForm((f) => ({ ...f, symbol: v }))}>
            <SelectTrigger className="font-mono text-xs h-8 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map((s) => (
                <SelectItem key={s.id} value={s.id} className="font-mono text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Target className="h-3 w-3" /> Base Stake ($)
          </Label>
          <Input
            type="number" min="0.35" step="0.01" placeholder="e.g. 1.00"
            value={form.stake}
            onChange={(e) => setForm((f) => ({ ...f, stake: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
          {stakeVal > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="font-mono text-[10px] text-muted-foreground">Martingale:</span>
              {stakes.map((s, i) => (
                <span key={i} className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                  i === 0
                    ? "border-primary/40 text-primary bg-primary/10"
                    : "border-border/50 text-muted-foreground"
                }`}>
                  ${s.toFixed(2)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Button className="w-full font-mono text-xs h-9 gap-1.5" onClick={() => setCfg({ ...form })} disabled={!canStart}>
        <Play className="h-3.5 w-3.5" />
        Start Reverse Over/Under
      </Button>
    </div>
  );
}
