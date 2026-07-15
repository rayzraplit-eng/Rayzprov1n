import { useState } from "react";
import { Button }    from "@/components/ui/button";
import { Badge }     from "@/components/ui/badge";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Play, Square, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Eye, Loader2,
  Target, Trophy, ShieldX, AlertTriangle,
  ArrowDown, ArrowUp,
} from "lucide-react";
import {
  useUnder8Over1Pro,
  U8O1_PAYOUT,
  type U8O1Status,
  type U8O1Mode,
  type U8O1Phase,
  type U8O1TradeType,
  type U8O1Trade,
} from "@/hooks/use-under8-over1-pro";

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMBOLS = [
  { id: "R_10",    label: "Volatility 10"   },
  { id: "R_25",    label: "Volatility 25"   },
  { id: "R_50",    label: "Volatility 50"   },
  { id: "R_75",    label: "Volatility 75"   },
  { id: "R_100",   label: "Volatility 100"  },
  { id: "1HZ10V",  label: "Vol 10 (1s)"    },
  { id: "1HZ25V",  label: "Vol 25 (1s)"    },
  { id: "1HZ50V",  label: "Vol 50 (1s)"    },
  { id: "1HZ75V",  label: "Vol 75 (1s)"    },
  { id: "1HZ100V", label: "Vol 100 (1s)"   },
] as const;

const MARTINGALE = 1.8;

const TRADE_META: Record<U8O1TradeType, { label: string; cls: string; winCls: string }> = {
  under8: { label: "UNDER 8", cls: "border-violet-500/60 text-violet-400 bg-violet-500/10", winCls: "text-violet-400" },
  under5: { label: "UNDER 5", cls: "border-rose-500/60 text-rose-400 bg-rose-500/10",       winCls: "text-rose-400"   },
  over1:  { label: "OVER 1",  cls: "border-sky-500/60 text-sky-400 bg-sky-500/10",          winCls: "text-sky-400"    },
  over4:  { label: "OVER 4",  cls: "border-chart-3/60 text-chart-3 bg-chart-3/10",          winCls: "text-chart-3"    },
};

const STATUS_LABEL: Record<U8O1Status, string> = {
  idle:          "IDLE",
  buffering:     "LOADING",
  watching:      "WATCHING",
  trading:       "TRADING",
  "max-profit":  "PROFIT TARGET HIT",
  "max-losses":  "MAX LOSSES HIT",
};

// ─── Small reusable pieces ────────────────────────────────────────────────────

function TypeBadge({ type }: { type: U8O1TradeType }) {
  const m = TRADE_META[type];
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase shrink-0 ${m.cls}`}>
      {m.label}
    </Badge>
  );
}

function DigitTile({ digit, highlight, prev }: { digit: number; highlight?: boolean; prev?: boolean }) {
  const isHigh = digit >= 8; // relevant for under-8 side
  const isLow  = digit <= 1; // relevant for over-1 side
  return (
    <span className={`font-mono text-xs w-6 h-6 rounded flex items-center justify-center font-bold shrink-0 transition-all ${
      highlight
        ? "bg-primary text-primary-foreground scale-110"
        : prev
        ? isHigh
          ? "bg-violet-500/20 text-violet-400"
          : isLow
          ? "bg-sky-500/20 text-sky-400"
          : "bg-muted text-muted-foreground"
        : "bg-muted/60 text-muted-foreground/60"
    }`}>
      {digit}
    </span>
  );
}

function TradeRow({ trade, isNew }: { trade: U8O1Trade; isNew: boolean }) {
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
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-1">
        <div className="flex items-center gap-1 font-bold text-violet-400">
          <ArrowDown className="h-3 w-3" /> UNDER SIDE
        </div>
        <div className="text-muted-foreground">Condition: <span className="text-violet-400">8,9 least% in 100t</span></div>
        <div className="text-muted-foreground">Entry: <span className="text-violet-400">prev ≥8</span> → <span className="text-violet-400">curr ≤7</span></div>
        <div className="text-muted-foreground/70">Trade → <span className="text-violet-400">Under 8</span></div>
        <div className="text-muted-foreground/70">Loss → <span className="text-rose-400">Under 5</span> ×1.8 continuous</div>
      </div>
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5 space-y-1">
        <div className="flex items-center gap-1 font-bold text-sky-400">
          <ArrowUp className="h-3 w-3" /> OVER SIDE
        </div>
        <div className="text-muted-foreground">Condition: <span className="text-sky-400">0,1 least% in 100t</span></div>
        <div className="text-muted-foreground">Entry: <span className="text-sky-400">prev ≤1</span> → <span className="text-sky-400">curr ≥2</span></div>
        <div className="text-muted-foreground/70">Trade → <span className="text-sky-400">Over 1</span></div>
        <div className="text-muted-foreground/70">Loss → <span className="text-chart-3">Over 4</span> ×1.8 continuous</div>
      </div>
    </div>
  );
}

// ─── Digit-pair frequency bar ─────────────────────────────────────────────────

function FreqBar({
  label, pct, cls, active,
}: { label: string; pct: number; cls: string; active: boolean }) {
  const isLeast = pct < 20; // below expected 20% for a pair
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 flex items-center gap-2 ${
      active
        ? "border-primary/40 bg-primary/5"
        : isLeast
        ? "border-border/50 bg-muted/10"
        : "border-border/30 bg-transparent"
    }`}>
      <span className={`font-mono text-[10px] font-bold ${cls}`}>{label}</span>
      <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isLeast ? cls.replace("text-", "bg-").replace("400","500/60") : "bg-muted"}`}
          style={{ width: `${Math.min(pct * 2, 100)}%` }}
        />
      </div>
      <span className={`font-mono text-[9px] tabular-nums ${isLeast ? cls : "text-muted-foreground"}`}>
        {pct.toFixed(0)}%
      </span>
      {isLeast && (
        <span className={`font-mono text-[9px] animate-pulse ${cls}`}>↓ least</span>
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

  // Preview recovery martingale stakes
  const recoveryStakes: number[] = [stakeVal];
  for (let i = 0; i < Math.min(lossesVal - 1, 6); i++) {
    recoveryStakes.push(
      parseFloat((recoveryStakes[recoveryStakes.length - 1]! * MARTINGALE).toFixed(2)),
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Waits for <span className="text-violet-400 font-bold">digits 8/9</span> to be under-represented in 100 ticks,
        then enters <span className="text-violet-400 font-bold">Under 8</span> when prev digit ≥8 and curr ≤7.
        On the other side, waits for{" "}
        <span className="text-sky-400 font-bold">digits 0/1</span> to be under-represented,
        then enters <span className="text-sky-400 font-bold">Over 1</span> when prev digit ≤1 and curr ≥2.
        Any loss immediately escalates to{" "}
        <span className="text-rose-400 font-bold">Under 5</span>{" "}
        / <span className="text-chart-3 font-bold">Over 4</span> with{" "}
        <span className="text-foreground font-bold">×{MARTINGALE} martingale</span> until a win.
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

        {/* Max Profit */}
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
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-violet-500/40 text-violet-400 bg-violet-500/10">
              Entry ${stakeVal.toFixed(2)}
            </span>
            {recoveryStakes.map((s, i) => (
              <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-rose-500/40 text-rose-400 bg-rose-500/10">
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
        Start Under 8 Over 1 Pro
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
    totalWins, totalLosses, totalPnl,
    trades, recentDigits, tickCount,
    pct89, pct01,
  } = useUnder8Over1Pro(cfg.symbol, baseStake, maxProfit, maxLosses, true);

  const newTradeId  = trades[0]?.id ?? "";
  const isLoading   = status === "buffering";
  const isStopped   = status === "max-profit" || status === "max-losses";
  const pnlPositive = totalPnl > 0;
  const pnlZero     = totalPnl === 0;

  return (
    <div className="space-y-3 animate-in fade-in duration-300">

      {/* ── Digit-pair frequency ── */}
      {tickCount >= 100 && (
        <div className="space-y-1.5">
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide">100-Tick Digit-Pair Frequency</div>
          <FreqBar
            label="8 & 9"
            pct={pct89}
            cls="text-violet-400"
            active={mode === "under"}
          />
          <FreqBar
            label="0 & 1"
            pct={pct01}
            cls="text-sky-400"
            active={mode === "over"}
          />
        </div>
      )}

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
          pnlZero      ? "border-border/50 bg-muted/20"
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
            ? <Trophy       className="h-4 w-4 text-primary shrink-0" />
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
          mode === "under"
            ? "border-violet-500/30 bg-violet-500/5"
            : "border-sky-500/30 bg-sky-500/5"
        }`}>
          {mode === "under"
            ? <TrendingDown className="h-4 w-4 text-violet-400 shrink-0" />
            : <TrendingUp   className="h-4 w-4 text-sky-400 shrink-0"    />}
          <div className="font-mono text-xs flex-1 min-w-0">
            <span className={`font-bold ${mode === "under" ? "text-violet-400" : "text-sky-400"}`}>
              {mode === "under" ? "UNDER MODE" : "OVER MODE"}
            </span>
            {phase === "recovery" && (
              <span className="text-muted-foreground ml-2">
                recovery · {consecutiveLosses} loss{consecutiveLosses !== 1 ? "es" : ""} · ×{MARTINGALE}
              </span>
            )}
          </div>
          {currentType && <TypeBadge type={currentType} />}
          {phase === "recovery" && (
            <Badge variant="outline" className="font-mono text-[9px] border-rose-500/40 text-rose-400 bg-rose-500/10 shrink-0">
              RECOVERY
            </Badge>
          )}
        </div>
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
              status === "watching"    ? "border-primary/50 text-primary bg-primary/10"
              : status === "trading"   ? "border-violet-500/50 text-violet-400 bg-violet-500/10 animate-pulse"
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
              <p className="font-mono text-xs text-muted-foreground">Collecting ticks… {tickCount}/100</p>
            </>
          ) : (
            <>
              <Eye className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
              <p className="font-mono text-xs text-muted-foreground">Watching for entry pattern…</p>
              <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">
                Under: 8/9 least% + prev≥8→curr≤7 · Over: 0/1 least% + prev≤1→curr≥2
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inline export (used in Master Bot tab) ───────────────────────────────────

export function Under8Over1ProInline() {
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
              <ArrowDown className="h-3.5 w-3.5 text-violet-400" />
              <ArrowUp   className="h-3.5 w-3.5 text-sky-400"    />
            </div>
          </div>
          {cfg && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background animate-ping" />
          )}
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">UNDER 8 OVER 1 PRO</h2>
          <p className="font-mono text-xs text-muted-foreground">Digit-pair bias + reversal · ×1.8 recovery</p>
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
