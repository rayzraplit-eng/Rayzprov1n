import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Play, Square, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Eye, Loader2,
  Target, Trophy, ShieldX, AlertTriangle,
} from "lucide-react";
import {
  useOver2Under7Pro,
  PAYOUT_MULTIPLIER,
  type ProStatus,
  type ProMode,
  type ProPhase,
  type ProTradeType,
  type ProTrade,
} from "@/hooks/use-over2-under7-pro";

// ─── Constants ────────────────────────────────────────────────────────────────

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

const MARTINGALE = 1.8;

const TRADE_META: Record<ProTradeType, { label: string; cls: string; winCls: string }> = {
  over2:  { label: "OVER 2",  cls: "border-sky-500/60 text-sky-400 bg-sky-500/10",          winCls: "text-sky-400"     },
  over4:  { label: "OVER 4",  cls: "border-chart-3/60 text-chart-3 bg-chart-3/10",          winCls: "text-chart-3"    },
  under7: { label: "UNDER 7", cls: "border-violet-500/60 text-violet-400 bg-violet-500/10", winCls: "text-violet-400" },
  under5: { label: "UNDER 5", cls: "border-rose-500/60 text-rose-400 bg-rose-500/10",       winCls: "text-rose-400"   },
};

const STATUS_LABEL: Record<ProStatus, string> = {
  idle:        "IDLE",
  buffering:   "LOADING",
  watching:    "WATCHING",
  trading:     "TRADING",
  "max-profit": "PROFIT TARGET HIT",
  "max-losses": "MAX LOSSES HIT",
};

// ─── Small reusable pieces ────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ProTradeType }) {
  const m = TRADE_META[type];
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase shrink-0 ${m.cls}`}>
      {m.label}
    </Badge>
  );
}

function DigitTile({ digit, highlight, prev }: { digit: number; highlight?: boolean; prev?: boolean }) {
  const isLow  = digit <= 2;
  const isHigh = digit >= 7;
  return (
    <span className={`font-mono text-xs w-6 h-6 rounded flex items-center justify-center font-bold shrink-0 transition-all ${
      highlight
        ? "bg-primary text-primary-foreground scale-110"
        : prev
        ? isLow
          ? "bg-sky-500/20 text-sky-400"
          : isHigh
          ? "bg-violet-500/20 text-violet-400"
          : "bg-muted text-muted-foreground"
        : "bg-muted/60 text-muted-foreground/60"
    }`}>
      {digit}
    </span>
  );
}

function TradeRow({ trade, isNew }: { trade: ProTrade; isNew: boolean }) {
  const m   = TRADE_META[trade.type];
  const isW = trade.result === "win";
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs transition-all duration-300 ${
      isNew
        ? isW ? "border-primary/40 bg-primary/5" : "border-rose-500/30 bg-rose-500/5"
        : "border-border/40 bg-transparent"
    }`}>
      {isW
        ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
        : <XCircle      className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
      <TypeBadge type={trade.type} />
      <span className="text-muted-foreground">→</span>
      <span className={`font-bold ${isW ? m.winCls : "text-rose-400"}`}>{trade.actualDigit}</span>
      <span className={`ml-auto font-bold tabular-nums ${trade.pnl >= 0 ? "text-primary" : "text-rose-400"}`}>
        {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}
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
        <div className="text-muted-foreground">Entry: <span className="text-sky-400">2+ digits ≤2</span> → <span className="text-sky-400">≥3</span></div>
        <div className="text-muted-foreground/70">Trade → <span className="text-sky-400">Over 2</span></div>
        <div className="text-muted-foreground/70">Loss → wait <span className="text-muted-foreground">≤2→≥3</span></div>
        <div className="text-muted-foreground/70">Re-entry → <span className="text-chart-3">Over 4</span> ×1.8</div>
        <div className="text-muted-foreground/70">Further loss → <span className="text-chart-3">Over 4</span> continuous</div>
      </div>
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-1">
        <div className="flex items-center gap-1 font-bold text-violet-400">
          <TrendingDown className="h-3 w-3" /> UNDER SIDE
        </div>
        <div className="text-muted-foreground">Entry: <span className="text-violet-400">2+ digits ≥7</span> → <span className="text-violet-400">≤6</span></div>
        <div className="text-muted-foreground/70">Trade → <span className="text-violet-400">Under 7</span></div>
        <div className="text-muted-foreground/70">Loss → wait <span className="text-muted-foreground">≥7→≤6</span></div>
        <div className="text-muted-foreground/70">Re-entry → <span className="text-rose-400">Under 5</span> ×1.8</div>
        <div className="text-muted-foreground/70">Further loss → <span className="text-rose-400">Under 5</span> continuous</div>
      </div>
    </div>
  );
}

// ─── Streak indicator ─────────────────────────────────────────────────────────

function StreakBar({ consecLow, consecHigh }: { consecLow: number; consecHigh: number }) {
  if (consecLow === 0 && consecHigh === 0) return null;
  return (
    <div className="flex items-center gap-2 font-mono text-[10px]">
      {consecLow > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-sky-500/30 bg-sky-500/5">
          <TrendingUp className="h-2.5 w-2.5 text-sky-400" />
          <span className="text-sky-400 font-bold">{consecLow}×</span>
          <span className="text-muted-foreground">≤2 streak</span>
          {consecLow >= 2 && <span className="text-sky-400 animate-pulse">● ready</span>}
        </div>
      )}
      {consecHigh > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-violet-500/30 bg-violet-500/5">
          <TrendingDown className="h-2.5 w-2.5 text-violet-400" />
          <span className="text-violet-400 font-bold">{consecHigh}×</span>
          <span className="text-muted-foreground">≥7 streak</span>
          {consecHigh >= 2 && <span className="text-violet-400 animate-pulse">● ready</span>}
        </div>
      )}
    </div>
  );
}

// ─── Config form ──────────────────────────────────────────────────────────────

type Cfg = {
  symbol:    string;
  stake:     string;
  maxProfit: string;
  maxLosses: string;
};

function ConfigScreen({ form, setForm, onStart }: {
  form:    Cfg;
  setForm: React.Dispatch<React.SetStateAction<Cfg>>;
  onStart: () => void;
}) {
  const stakeVal  = parseFloat(form.stake);
  const profitVal = parseFloat(form.maxProfit);
  const lossesVal = parseInt(form.maxLosses);
  const canStart  = stakeVal > 0 && profitVal > 0 && lossesVal >= 1;

  // Preview martingale recovery stakes
  const recoveryStakes: number[] = [stakeVal];
  for (let i = 0; i < Math.min(lossesVal - 1, 6); i++) {
    recoveryStakes.push(parseFloat((recoveryStakes[recoveryStakes.length - 1]! * MARTINGALE).toFixed(2)));
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Enters <span className="text-sky-400 font-bold">Over 2</span> after 2+ consecutive digits ≤2, or{" "}
        <span className="text-violet-400 font-bold">Under 7</span> after 2+ consecutive digits ≥7.
        On loss, waits for the reversal pattern and escalates to{" "}
        <span className="text-chart-3 font-bold">Over 4</span> /{" "}
        <span className="text-rose-400 font-bold">Under 5</span> with{" "}
        <span className="text-foreground font-bold">×{MARTINGALE} martingale</span>.
        Further losses trade continuously. Resets on any win.
      </p>

      <PatternHints />

      <div className="space-y-3">
        {/* Market */}
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

        {/* Stake */}
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
        </div>

        {/* Max profit */}
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Trophy className="h-3 w-3" /> Max Profit ($)
          </Label>
          <Input
            type="number" min="0.01" step="0.01" placeholder="e.g. 10.00"
            value={form.maxProfit}
            onChange={(e) => setForm((f) => ({ ...f, maxProfit: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
          <p className="font-mono text-[10px] text-muted-foreground">Bot stops automatically when total profit reaches this.</p>
        </div>

        {/* Max consecutive losses */}
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ShieldX className="h-3 w-3" /> Max Consecutive Losses
          </Label>
          <Input
            type="number" min="1" max="20" step="1" placeholder="e.g. 5"
            value={form.maxLosses}
            onChange={(e) => setForm((f) => ({ ...f, maxLosses: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
          <p className="font-mono text-[10px] text-muted-foreground">Bot stops if this many losses occur in a row.</p>
        </div>
      </div>

      {/* Martingale preview */}
      {stakeVal > 0 && lossesVal >= 1 && (
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Recovery Martingale Preview</div>
          <div className="flex flex-wrap gap-1.5">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-sky-500/40 text-sky-400 bg-sky-500/10">
              Entry ${stakeVal.toFixed(2)}
            </span>
            {recoveryStakes.map((s, i) => (
              <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-chart-3/40 text-chart-3 bg-chart-3/10">
                Rec #{i + 1} ${s.toFixed(2)}
              </span>
            ))}
            {lossesVal > 7 && (
              <span className="font-mono text-[10px] text-muted-foreground">…</span>
            )}
          </div>
        </div>
      )}

      <Button
        className="w-full font-mono text-xs h-9 gap-1.5"
        onClick={onStart}
        disabled={!canStart}
      >
        <Play className="h-3.5 w-3.5" />
        Start Over 2 Under 7 Pro
      </Button>
    </div>
  );
}

// ─── Bot engine (running view) ────────────────────────────────────────────────

function BotEngine({ cfg, onStop }: { cfg: Cfg; onStop: () => void }) {
  const baseStake = parseFloat(cfg.stake);
  const maxProfit = parseFloat(cfg.maxProfit);
  const maxLosses = parseInt(cfg.maxLosses);

  const {
    status, wsStatus,
    mode, phase, currentType,
    currentStake, consecutiveLosses,
    consecLow, consecHigh,
    totalWins, totalLosses, totalPnl,
    trades, recentDigits, tickCount,
  } = useOver2Under7Pro(cfg.symbol, baseStake, maxProfit, maxLosses, true);

  const newTradeId  = trades[0]?.id ?? "";
  const isLoading   = status === "buffering";
  const isStopped   = status === "max-profit" || status === "max-losses";
  const pnlPositive = totalPnl > 0;
  const pnlZero     = totalPnl === 0;

  // In rec-watch, show what the next trade will be
  const pendingType: ProTradeType | null =
    phase === "rec-watch" && mode
      ? (mode === "over" ? "over4" : "under5")
      : null;

  return (
    <div className="space-y-3 animate-in fade-in duration-300">

      {/* ── Stat row ── */}
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

      {/* ── Stop result banner ── */}
      {isStopped && (
        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
          status === "max-profit"
            ? "border-primary/30 bg-primary/5"
            : "border-rose-500/30 bg-rose-500/5"
        }`}>
          {status === "max-profit"
            ? <Trophy className="h-4 w-4 text-primary shrink-0" />
            : <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />}
          <div className="font-mono text-xs flex-1">
            <span className={`font-bold ${status === "max-profit" ? "text-primary" : "text-rose-400"}`}>
              {status === "max-profit" ? "Profit target reached!" : `Max ${maxLosses} consecutive losses hit`}
            </span>
          </div>
          <Button size="sm" variant="outline" className="font-mono text-xs h-7 shrink-0" onClick={onStop}>
            Reset
          </Button>
        </div>
      )}

      {/* ── Mode / phase indicator ── */}
      {mode && !isStopped && (
        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
          mode === "over"
            ? "border-sky-500/30 bg-sky-500/5"
            : "border-violet-500/30 bg-violet-500/5"
        }`}>
          {mode === "over"
            ? <TrendingUp   className="h-4 w-4 text-sky-400 shrink-0"    />
            : <TrendingDown className="h-4 w-4 text-violet-400 shrink-0" />}
          <div className="font-mono text-xs flex-1 min-w-0">
            <span className={`font-bold ${mode === "over" ? "text-sky-400" : "text-violet-400"}`}>
              {mode.toUpperCase()} MODE
            </span>
            {phase === "rec-watch" && (
              <span className="text-muted-foreground ml-2">awaiting re-trigger…</span>
            )}
            {phase === "recovery" && (
              <span className="text-muted-foreground ml-2">
                recovery · {consecutiveLosses} loss{consecutiveLosses !== 1 ? "es" : ""} · ×{MARTINGALE}
              </span>
            )}
          </div>
          {currentType && <TypeBadge type={currentType} />}
          {pendingType && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="font-mono text-[9px] text-muted-foreground">next:</span>
              <TypeBadge type={pendingType} />
            </div>
          )}
          {phase === "recovery" && (
            <Badge variant="outline" className="font-mono text-[9px] border-chart-3/40 text-chart-3 bg-chart-3/10 shrink-0">
              RECOVERY
            </Badge>
          )}
        </div>
      )}

      {/* ── Streak indicator (only while watching) ── */}
      {(status === "watching" && !mode) && (
        <StreakBar consecLow={consecLow} consecHigh={consecHigh} />
      )}

      {/* ── Recent digits ── */}
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
        </div>
      )}

      {/* ── Status bar + stop button ── */}
      {!isStopped && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase ${
              status === "watching"   ? "border-primary/50 text-primary bg-primary/10"
              : status === "trading"  ? "border-sky-500/50 text-sky-400 bg-sky-500/10 animate-pulse"
              : status === "buffering"? "border-chart-3/50 text-chart-3 bg-chart-3/10"
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
            {consecutiveLosses > 0 && (
              <Badge variant="outline" className="font-mono text-[10px] border-rose-500/40 text-rose-400 bg-rose-500/10">
                {consecutiveLosses}/{maxLosses} losses
              </Badge>
            )}
          </div>
          <Button size="sm" variant="destructive" className="font-mono text-xs h-7 gap-1" onClick={onStop}>
            <Square className="h-3 w-3" /> Stop
          </Button>
        </div>
      )}

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
                Over: 2+ digits ≤2 → ≥3 · Under: 2+ digits ≥7 → ≤6
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inline export (used in Master Bot tab) ───────────────────────────────────

export function Over2Under7ProInline() {
  const [cfg, setCfg]   = useState<Cfg | null>(null);
  const [form, setForm] = useState<Cfg>({
    symbol:    "R_100",
    stake:     "1",
    maxProfit: "10",
    maxLosses: "5",
  });

  return (
    <section className="max-w-md mx-auto space-y-5 animate-in fade-in duration-500 px-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-0">
              <TrendingUp   className="h-3.5 w-3.5 text-sky-400"    />
              <TrendingDown className="h-3.5 w-3.5 text-violet-400" />
            </div>
          </div>
          {cfg && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background animate-ping" />
          )}
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">OVER 2 UNDER 7 PRO</h2>
          <p className="font-mono text-xs text-muted-foreground">Streak reversal · ×1.8 recovery martingale</p>
        </div>
        <Badge variant="outline" className="font-mono text-[9px] border-primary/40 text-primary bg-primary/10 uppercase ml-auto shrink-0">
          Live Bot
        </Badge>
      </div>

      {cfg === null ? (
        <ConfigScreen form={form} setForm={setForm} onStart={() => setCfg({ ...form })} />
      ) : (
        <BotEngine cfg={cfg} onStop={() => setCfg(null)} />
      )}
    </section>
  );
}
