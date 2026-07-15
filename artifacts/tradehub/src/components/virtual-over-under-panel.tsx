import { useState }    from "react";
import { Button }       from "@/components/ui/button";
import { Badge }        from "@/components/ui/badge";
import { Input }        from "@/components/ui/input";
import { Label }        from "@/components/ui/label";
import {
  Play, Square, Trophy, ShieldX, Target,
  TrendingUp, TrendingDown, CheckCircle2,
  XCircle, Loader2, Zap, AlertTriangle,
} from "lucide-react";
import {
  useVirtualOverUnder,
  VOU_PAYOUT,
  type VouTradeType,
  type VouTrade,
  type VirtualMarketState,
} from "@/hooks/use-virtual-over-under";

// ─── Constants ────────────────────────────────────────────────────────────────

const MARTINGALE = 2;

const TRADE_META: Record<VouTradeType, { label: string; cls: string }> = {
  over4:  { label: "OVER 4",  cls: "border-emerald-500/60 text-emerald-400 bg-emerald-500/10" },
  over3:  { label: "OVER 3",  cls: "border-chart-3/60 text-chart-3 bg-chart-3/10"             },
  under5: { label: "UNDER 5", cls: "border-violet-500/60 text-violet-400 bg-violet-500/10"    },
  under6: { label: "UNDER 6", cls: "border-sky-500/60 text-sky-400 bg-sky-500/10"             },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: VouTradeType }) {
  const m = TRADE_META[type];
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase shrink-0 ${m.cls}`}>
      {m.label}
    </Badge>
  );
}

function DigitPill({ d }: { d: number }) {
  const isLow  = d <= 4;
  const isHigh = d >= 5;
  return (
    <span className={`font-mono text-[10px] w-5 h-5 rounded flex items-center justify-center font-bold shrink-0 ${
      isLow  ? "bg-emerald-500/20 text-emerald-400" :
      isHigh ? "bg-violet-500/20 text-violet-400"  :
               "bg-muted text-muted-foreground"
    }`}>{d}</span>
  );
}

function TradeRow({ trade, isNew }: { trade: VouTrade; isNew: boolean }) {
  const win = trade.result === "win";
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[10px] ${
      isNew
        ? win ? "border-primary/30 bg-primary/5" : "border-rose-500/20 bg-rose-500/5"
        : "border-border/30 bg-transparent"
    }`}>
      {win
        ? <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
        : <XCircle      className="h-3 w-3 text-rose-400 shrink-0" />}
      <TypeBadge type={trade.type} />
      <span className="text-muted-foreground">→</span>
      <span className={`font-bold ${win ? "text-foreground" : "text-rose-400"}`}>{trade.actualDigit}</span>
      <span className={`ml-auto font-bold tabular-nums ${trade.pnl >= 0 ? "text-primary" : "text-rose-400"}`}>
        {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}
      </span>
    </div>
  );
}

// ─── Market card ──────────────────────────────────────────────────────────────

function MarketCard({ m }: { m: VirtualMarketState }) {
  const isTrading  = m.status === "trading";
  const isMaxLoss  = m.status === "max-losses";
  const isWatching = m.status === "watching";
  const isBuffering = m.status === "buffering" || m.status === "disabled";
  const pnlPos     = m.totalPnl > 0;
  const pnlZero    = m.totalPnl === 0;
  const newTrade   = m.trades[0];

  return (
    <div className={`rounded-lg border p-2.5 transition-all duration-300 ${
      isMaxLoss   ? "border-rose-500/40 bg-rose-500/5"
      : isTrading && m.mode === "over"  ? "border-emerald-500/40 bg-emerald-500/5"
      : isTrading && m.mode === "under" ? "border-violet-500/40 bg-violet-500/5"
      : isWatching ? "border-border/40 bg-muted/10"
      : "border-border/20 bg-transparent"
    }`}>
      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="font-mono text-[10px] font-bold text-foreground truncate flex-1 min-w-0">{m.label}</span>
        {isBuffering && <Loader2 className="h-2.5 w-2.5 text-muted-foreground/40 animate-spin shrink-0" />}
        {isWatching  && <span className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />}
        {isTrading   && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />}
        {isMaxLoss   && <AlertTriangle className="h-2.5 w-2.5 text-rose-400 shrink-0" />}
      </div>

      {/* Recent digits */}
      <div className="flex items-center gap-0.5 mb-2 min-h-5">
        {m.recentDigits.slice(-8).map((d, i) => (
          <DigitPill key={i} d={d} />
        ))}
        {m.recentDigits.length === 0 && (
          <span className="font-mono text-[9px] text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Trade type + stake */}
      <div className="flex items-center gap-1.5 min-h-5">
        {m.currentType && <TypeBadge type={m.currentType} />}
        {isTrading && (
          <span className="font-mono text-[9px] text-muted-foreground ml-auto shrink-0">
            ${m.currentStake.toFixed(2)}
            {m.phase === "recovery" && (
              <span className="text-rose-400 ml-1">rec×{m.consecutiveLosses}</span>
            )}
          </span>
        )}
        {isMaxLoss && (
          <span className="font-mono text-[9px] text-rose-400 ml-auto shrink-0">
            {m.consecutiveLosses} losses
          </span>
        )}
        {!isTrading && !isMaxLoss && (
          <span className={`font-mono text-[9px] tabular-nums ml-auto shrink-0 ${
            pnlZero ? "text-muted-foreground/40" : pnlPos ? "text-primary" : "text-rose-400"
          }`}>
            {m.totalPnl !== 0 ? (pnlPos ? "+" : "") + m.totalPnl.toFixed(2) : "—"}
          </span>
        )}
      </div>

      {/* Latest trade */}
      {newTrade && (
        <div className="mt-2">
          <TradeRow trade={newTrade} isNew />
        </div>
      )}
    </div>
  );
}

// ─── Config form ──────────────────────────────────────────────────────────────

type Cfg = { stake: string; maxProfit: string; maxLosses: string };

function ConfigScreen({ form, setForm, onStart }: {
  form:    Cfg;
  setForm: React.Dispatch<React.SetStateAction<Cfg>>;
  onStart: () => void;
}) {
  const stakeVal  = parseFloat(form.stake);
  const profitVal = parseFloat(form.maxProfit);
  const lossesVal = parseInt(form.maxLosses);
  const canStart  = stakeVal > 0 && profitVal > 0 && lossesVal >= 1;

  // Martingale preview
  const recoveryStakes: number[] = [stakeVal];
  for (let i = 0; i < Math.min(lossesVal - 1, 5); i++) {
    recoveryStakes.push(
      parseFloat((recoveryStakes[recoveryStakes.length - 1]! * MARTINGALE).toFixed(2)),
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Strategy summary */}
      <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 space-y-1">
          <div className="font-bold text-emerald-400 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> OVER SIDE
          </div>
          <div className="text-muted-foreground">Entry: last <span className="text-emerald-400">4 digits ≤4</span></div>
          <div className="text-muted-foreground">Trade → <span className="text-emerald-400">Over 4</span></div>
          <div className="text-muted-foreground/70">Loss → <span className="text-chart-3">Over 3</span> ×2 no skip</div>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-1">
          <div className="font-bold text-violet-400 flex items-center gap-1">
            <TrendingDown className="h-3 w-3" /> UNDER SIDE
          </div>
          <div className="text-muted-foreground">Entry: last <span className="text-violet-400">4 digits ≥5</span></div>
          <div className="text-muted-foreground">Trade → <span className="text-violet-400">Under 5</span></div>
          <div className="text-muted-foreground/70">Loss → <span className="text-sky-400">Under 6</span> ×2 no skip</div>
        </div>
      </div>

      <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
        Monitors <span className="text-foreground font-bold">all 10 volatility indices</span> simultaneously.
        When any market shows 4 consecutive digits all ≤4 or all ≥5, a trade is placed immediately.
        Each market runs independently with its own martingale recovery chain.
      </p>

      <div className="space-y-3">
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
            type="number" min="0.01" step="0.01" placeholder="e.g. 20.00"
            value={form.maxProfit}
            onChange={(e) => setForm((f) => ({ ...f, maxProfit: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
          <p className="font-mono text-[10px] text-muted-foreground">Combined profit across all markets stops new entries.</p>
        </div>

        {/* Max consecutive losses */}
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ShieldX className="h-3 w-3" /> Max Consecutive Losses (per market)
          </Label>
          <Input
            type="number" min="1" max="15" step="1" placeholder="e.g. 4"
            value={form.maxLosses}
            onChange={(e) => setForm((f) => ({ ...f, maxLosses: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
          <p className="font-mono text-[10px] text-muted-foreground">Each market stops independently when this limit is hit.</p>
        </div>
      </div>

      {/* Martingale preview */}
      {stakeVal > 0 && lossesVal >= 1 && (
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Recovery Martingale Preview (×{MARTINGALE})</div>
          <div className="flex flex-wrap gap-1.5">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
              Entry ${stakeVal.toFixed(2)}
            </span>
            {recoveryStakes.map((s, i) => (
              <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-chart-3/40 text-chart-3 bg-chart-3/10">
                Rec #{i + 1} ${s.toFixed(2)}
              </span>
            ))}
            {lossesVal > 6 && <span className="font-mono text-[10px] text-muted-foreground">…</span>}
          </div>
        </div>
      )}

      <Button
        className="w-full font-mono text-xs h-9 gap-1.5"
        onClick={onStart}
        disabled={!canStart}
      >
        <Play className="h-3.5 w-3.5" />
        Start Virtual Over Under (All Markets)
      </Button>
    </div>
  );
}

// ─── Engine ───────────────────────────────────────────────────────────────────

function BotEngine({ cfg, onStop }: { cfg: Cfg; onStop: () => void }) {
  const baseStake = parseFloat(cfg.stake);
  const maxProfit = parseFloat(cfg.maxProfit);
  const maxLosses = parseInt(cfg.maxLosses);

  const {
    markets,
    totalPnl,
    totalWins,
    totalLosses,
    activeCount,
    readyCount,
    isMaxProfit,
  } = useVirtualOverUnder(baseStake, maxProfit, maxLosses, true);

  const pnlPos  = totalPnl > 0;
  const pnlZero = totalPnl === 0;
  const totalTrades = totalWins + totalLosses;

  return (
    <div className="space-y-3 animate-in fade-in duration-300">

      {/* ── Global stats bar ── */}
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
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Active</div>
          <div className={`font-mono text-sm font-bold ${activeCount > 0 ? "text-primary animate-pulse" : "text-foreground"}`}>{activeCount}</div>
        </div>
        <div className={`rounded-lg border p-2 text-center ${
          pnlZero      ? "border-border/50 bg-muted/20"
          : pnlPos      ? "border-primary/30 bg-primary/5"
          : "border-rose-500/30 bg-rose-500/5"
        }`}>
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide mb-1">P&L</div>
          <div className={`font-mono text-sm font-bold tabular-nums ${
            pnlZero ? "text-foreground" : pnlPos ? "text-primary" : "text-rose-400"
          }`}>
            {pnlPos ? "+" : ""}{totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* ── Max-profit banner ── */}
      {isMaxProfit && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <Trophy className="h-4 w-4 text-primary shrink-0" />
          <div className="font-mono text-xs flex-1">
            <span className="font-bold text-primary">Profit target reached!</span>
            <span className="text-muted-foreground ml-2">No new entries — active recoveries continue.</span>
          </div>
          <Button size="sm" variant="outline" className="font-mono text-xs h-7 shrink-0" onClick={onStop}>
            Reset
          </Button>
        </div>
      )}

      {/* ── Status bar + stop ── */}
      {!isMaxProfit && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-[10px] border-primary/40 text-primary bg-primary/10 uppercase">
              <Zap className="h-2.5 w-2.5 mr-1" />
              {readyCount}/10 ready
            </Badge>
            {activeCount > 0 && (
              <Badge variant="outline" className="font-mono text-[10px] border-violet-500/40 text-violet-400 bg-violet-500/10 uppercase animate-pulse">
                {activeCount} trading
              </Badge>
            )}
            {totalTrades > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {totalTrades} trade{totalTrades !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <Button size="sm" variant="destructive" className="font-mono text-xs h-7 gap-1 shrink-0" onClick={onStop}>
            <Square className="h-3 w-3" /> Stop All
          </Button>
        </div>
      )}

      {/* ── Market grid ── */}
      <div className="space-y-1.5">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
          All Markets — Live Monitor
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {markets.map((m) => (
            <MarketCard key={m.symbol} m={m} />
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 flex-wrap font-mono text-[9px] text-muted-foreground px-0.5">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-500/20 shrink-0" /> digits 0–4
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-violet-500/20 shrink-0" /> digits 5–9
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" /> trading
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" /> watching
        </span>
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function VirtualOverUnderInline() {
  const [cfg, setCfg]   = useState<Cfg | null>(null);
  const [form, setForm] = useState<Cfg>({
    stake:     "1",
    maxProfit: "20",
    maxLosses: "4",
  });

  return (
    <section className="max-w-md mx-auto space-y-5 animate-in fade-in duration-500 px-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/60" />
              <span className="h-2.5 w-2.5 rounded-sm bg-violet-500/60"  />
              <span className="h-2.5 w-2.5 rounded-sm bg-chart-3/60"     />
              <span className="h-2.5 w-2.5 rounded-sm bg-sky-500/60"     />
            </div>
          </div>
          {cfg && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background animate-ping" />
          )}
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">VIRTUAL OVER UNDER</h2>
          <p className="font-mono text-xs text-muted-foreground">4-digit streak · All markets · ×2 recovery</p>
        </div>
        <Badge variant="outline" className="font-mono text-[9px] border-primary/40 text-primary bg-primary/10 uppercase ml-auto shrink-0">
          Multi-Market
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
