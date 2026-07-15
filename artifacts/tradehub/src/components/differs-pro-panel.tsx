import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Play,
  Square,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shuffle,
  Eye,
} from "lucide-react";
import {
  useDiffersPro,
  DIFFERS_MARTINGALE,
  DIFFER_WINDOW,
  type DifferStatus,
  type DifferTrade,
  type DifferMarket,
} from "@/hooks/use-differs-pro";

function StatusBadge({ status }: { status: DifferStatus }) {
  const map: Record<DifferStatus, { label: string; cls: string }> = {
    idle: { label: "IDLE", cls: "border-muted-foreground/40 text-muted-foreground bg-muted/20" },
    buffering: { label: "BUFFERING…", cls: "border-chart-3/50 text-chart-3 bg-chart-3/10" },
    watching: { label: "WATCHING", cls: "border-primary/50 text-primary bg-primary/10" },
    recovering: { label: "RECOVERING", cls: "border-chart-3/70 text-chart-3 bg-chart-3/15" },
    "max-losses": { label: "MAX LOSSES", cls: "border-destructive/60 text-destructive bg-destructive/10" },
    "max-profit": { label: "PROFIT HIT", cls: "border-primary/60 text-primary bg-primary/15" },
  };
  const { label, cls } = map[status];
  return (
    <Badge variant="outline" className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0 h-4 ${cls}`}>
      {label}
    </Badge>
  );
}

function TradeRow({ trade, fresh }: { trade: DifferTrade; fresh: boolean }) {
  const icon =
    trade.side === "differ" ? (
      <Shuffle className="h-3 w-3 text-muted-foreground shrink-0" />
    ) : trade.side === "over3" ? (
      <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
    ) : (
      <TrendingDown className="h-3 w-3 text-muted-foreground shrink-0" />
    );

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs font-mono transition-all duration-500 ${
        fresh
          ? trade.result === "win"
            ? "border-primary/40 bg-primary/5"
            : "border-destructive/30 bg-destructive/5"
          : "border-border/40 bg-transparent"
      }`}
    >
      {trade.result === "win" ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
      )}
      {icon}
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground">{trade.symbol}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{trade.contract}</span>
        <span className="font-bold text-foreground">{trade.barrier}</span>
        {trade.recovery && (
          <Badge variant="outline" className="font-mono text-[8px] px-1 py-0 h-3.5 border-chart-3/40 text-chart-3 uppercase">
            recovery
          </Badge>
        )}
        <span className="text-muted-foreground">· Digit</span>
        <span className={`font-bold ${trade.result === "win" ? "text-primary" : "text-destructive"}`}>
          {trade.digit}
        </span>
        <span className="text-muted-foreground">· Stake</span>
        <span className="text-foreground">${trade.stake.toFixed(2)}</span>
      </div>
      <Badge
        variant="outline"
        className={`font-mono text-[9px] uppercase shrink-0 ${
          trade.result === "win"
            ? "border-primary/50 text-primary bg-primary/10"
            : "border-destructive/40 text-destructive bg-destructive/10"
        }`}
      >
        {trade.result}
      </Badge>
    </div>
  );
}

function MarketTile({ market }: { market: DifferMarket }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[10px] font-bold text-foreground truncate">{market.label}</span>
        <StatusBadge status={market.status} />
      </div>
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className="text-muted-foreground">
          {market.status === "recovering" ? market.recoverySide ?? "—" : `least: ${market.leastDigit ?? "—"}`}
        </span>
        <span className="font-bold text-foreground">${market.currentStake.toFixed(2)}</span>
      </div>
      {market.consecutiveLosses > 0 && (
        <div className="text-[9px] text-destructive font-mono">{market.consecutiveLosses} loss(es) in recovery</div>
      )}
    </div>
  );
}

type ConfigForm = {
  stake: string;
  maxProfit: string;
  maxLosses: string;
};

function ConfigScreen({
  form,
  setForm,
  onStart,
}: {
  form: ConfigForm;
  setForm: React.Dispatch<React.SetStateAction<ConfigForm>>;
  onStart: () => void;
}) {
  const stakeVal = parseFloat(form.stake);
  const profitVal = parseFloat(form.maxProfit);
  const lossesVal = parseInt(form.maxLosses);
  const canStart = stakeVal > 0 && profitVal > 0 && lossesVal >= 1;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Watches all <span className="text-foreground font-bold">10 volatility indices</span> at once over the last{" "}
        <span className="text-foreground font-bold">{DIFFER_WINDOW} ticks</span>, tracking each market's{" "}
        <span className="text-foreground font-bold">least-appearing digit</span>. The instant that digit shifts on any
        market, it fires a <span className="text-foreground font-bold">Differs</span> trade against the new
        least-appearing digit — if several markets shift on the same tick, it can fire up to{" "}
        <span className="text-foreground font-bold">10 trades at once</span>. On a loss, that market switches to the
        leading side (Over 3 / Under 6) and recovers with a{" "}
        <span className="text-foreground font-bold">×{DIFFERS_MARTINGALE} martingale</span> until it wins.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground uppercase">Base Stake ($)</Label>
          <Input
            type="number"
            min="0.35"
            step="0.01"
            placeholder="e.g. 1.00"
            value={form.stake}
            onChange={(e) => setForm((f) => ({ ...f, stake: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
          <p className="text-[10px] text-muted-foreground">Applied per-market — each of the 10 markets trades independently at this stake.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground uppercase">Max Profit ($)</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 10.00"
            value={form.maxProfit}
            onChange={(e) => setForm((f) => ({ ...f, maxProfit: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
          <p className="text-[10px] text-muted-foreground">Combined profit across all 10 markets. New trades stop once this is reached.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground uppercase">Max Consecutive Losses (per market)</Label>
          <Input
            type="number"
            min="1"
            max="20"
            step="1"
            placeholder="e.g. 5"
            value={form.maxLosses}
            onChange={(e) => setForm((f) => ({ ...f, maxLosses: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
          <p className="text-[10px] text-muted-foreground">Each market stops independently after this many recovery losses in a row.</p>
        </div>
      </div>

      {stakeVal > 0 && lossesVal >= 1 && (
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="text-[10px] text-muted-foreground uppercase mb-2">Recovery Martingale Preview</div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(lossesVal, 8) }, (_, i) => {
              const s = stakeVal * Math.pow(DIFFERS_MARTINGALE, i);
              return (
                <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border/40 text-muted-foreground">
                  #{i + 1} ${s.toFixed(2)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <Button className="w-full font-mono text-xs h-9" onClick={onStart} disabled={!canStart}>
        <Play className="h-3.5 w-3.5 mr-1.5" />
        Start Differs Pro
      </Button>
    </div>
  );
}

function BotEngine({ cfg, onStop }: { cfg: ConfigForm; onStop: () => void }) {
  const baseStake = parseFloat(cfg.stake) || 1;
  const maxProfit = parseFloat(cfg.maxProfit) || 0;
  const maxLosses = parseInt(cfg.maxLosses) || 5;

  const {
    markets,
    allTrades,
    totalPnl,
    activeCount,
    recoveringCount,
    maxedOutCount,
    readyCount,
    liveCount,
    isMaxProfit,
  } = useDiffersPro(baseStake, maxProfit, maxLosses, true);

  const allMaxed = maxedOutCount === markets.length;
  const isStopped = isMaxProfit || allMaxed;
  const freshIds = new Set(allTrades.slice(0, 1).map((t) => t.id));

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="rounded-lg border border-border/40 bg-muted/10 p-3 flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground uppercase">Combined P&amp;L</span>
        <span className={`font-mono text-base font-bold ${totalPnl >= 0 ? "text-primary" : "text-destructive"}`}>
          {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} <span className="text-[10px] text-muted-foreground">/ ${maxProfit.toFixed(2)} target</span>
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2 text-center">
          <div className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Live</div>
          <div className="font-mono text-lg font-bold text-foreground">{liveCount}/10</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2 text-center">
          <div className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Ready</div>
          <div className="font-mono text-lg font-bold text-foreground">{readyCount}/10</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2 text-center">
          <div className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Recovering</div>
          <div className={`font-mono text-lg font-bold ${recoveringCount > 0 ? "text-chart-3" : "text-foreground"}`}>
            {recoveringCount}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2 text-center">
          <div className="font-mono text-[9px] text-muted-foreground uppercase mb-1">Maxed Out</div>
          <div className={`font-mono text-lg font-bold ${maxedOutCount > 0 ? "text-destructive" : "text-foreground"}`}>
            {maxedOutCount}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {markets.map((m) => (
          <MarketTile key={m.symbol} market={m} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          {activeCount > 0 && !isStopped && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {activeCount} market(s) active
            </span>
          )}
        </div>
        {isMaxProfit ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-primary flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Profit target reached
            </span>
            <Button size="sm" variant="outline" className="font-mono text-xs h-7" onClick={onStop}>Reset</Button>
          </div>
        ) : allMaxed ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> All markets hit max losses
            </span>
            <Button size="sm" variant="outline" className="font-mono text-xs h-7" onClick={onStop}>Reset</Button>
          </div>
        ) : (
          <Button size="sm" variant="destructive" className="font-mono text-xs h-7" onClick={onStop}>
            <Square className="h-3 w-3 mr-1" /> Stop
          </Button>
        )}
      </div>

      {allTrades.length > 0 ? (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Trade Log (all markets)</div>
          {allTrades.map((t) => (
            <TradeRow key={t.id} trade={t} fresh={freshIds.has(t.id)} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-4 text-center">
          <Eye className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
          <p className="font-mono text-xs text-muted-foreground">
            Buffering ticks across 10 markets ({readyCount}/10 ready · needs {DIFFER_WINDOW} ticks each)…
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Inline (full-page) version — used inside the Master Bot tab
───────────────────────────────────────────────────────────────────────── */
export function DiffersProInline() {
  const [cfg, setCfg] = useState<ConfigForm | null>(null);
  const [form, setForm] = useState<ConfigForm>({ stake: "1", maxProfit: "10", maxLosses: "5" });

  return (
    <section className="max-w-md mx-auto space-y-5 animate-in fade-in duration-500 px-1">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          {cfg && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background animate-ping" />
          )}
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">DIFFERS PRO</h2>
          <p className="font-mono text-xs text-muted-foreground">10 markets at once · least-digit shift · ×{DIFFERS_MARTINGALE} recovery</p>
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

/* ─────────────────────────────────────────────────────────────────────────
   Dialog version — used from the Free Bots card in the Bots Library
───────────────────────────────────────────────────────────────────────── */
export function DiffersProPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<ConfigForm | null>(null);
  const [form, setForm] = useState<ConfigForm>({ stake: "1", maxProfit: "10", maxLosses: "5" });

  function handleClose() {
    setCfg(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg font-mono border-border bg-background max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-base font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            DIFFERS PRO
            <Badge variant="outline" className="font-mono text-[9px] border-primary/40 text-primary bg-primary/10 uppercase ml-auto">
              Live Bot
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {cfg === null ? (
          <ConfigScreen form={form} setForm={setForm} onStart={() => setCfg({ ...form })} />
        ) : (
          <BotEngine cfg={cfg} onStop={() => setCfg(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
