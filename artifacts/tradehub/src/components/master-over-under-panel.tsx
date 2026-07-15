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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Square,
  Crown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Hash,
  TrendingUp,
  TrendingDown,
  Eye,
} from "lucide-react";
import {
  useMasterOverUnder,
  MARTINGALE,
  type StrategyStatus,
  type OverUnderTrade,
} from "@/hooks/use-master-over-under";

const SYMBOLS = [
  { id: "R_10", label: "Volatility 10" },
  { id: "R_25", label: "Volatility 25" },
  { id: "R_50", label: "Volatility 50" },
  { id: "R_75", label: "Volatility 75" },
  { id: "R_100", label: "Volatility 100" },
  { id: "1HZ10V", label: "Vol 10 (1s)" },
  { id: "1HZ25V", label: "Vol 25 (1s)" },
  { id: "1HZ50V", label: "Vol 50 (1s)" },
  { id: "1HZ75V", label: "Vol 75 (1s)" },
  { id: "1HZ100V", label: "Vol 100 (1s)" },
] as const;

function StatusBadge({ status }: { status: StrategyStatus }) {
  const map: Record<StrategyStatus, { label: string; cls: string }> = {
    idle: { label: "IDLE", cls: "border-muted-foreground/40 text-muted-foreground bg-muted/20" },
    buffering: { label: "BUFFERING…", cls: "border-chart-3/50 text-chart-3 bg-chart-3/10" },
    watching: { label: "WATCHING", cls: "border-primary/50 text-primary bg-primary/10" },
    trading: { label: "TRADING", cls: "border-primary/80 text-primary bg-primary/20" },
    recovering: { label: "RECOVERING", cls: "border-chart-3/70 text-chart-3 bg-chart-3/15" },
    "max-losses": { label: "MAX LOSSES", cls: "border-destructive/60 text-destructive bg-destructive/10" },
  };
  const { label, cls } = map[status];
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase ${cls}`}>
      {label}
    </Badge>
  );
}

function TradeRow({ trade, fresh }: { trade: OverUnderTrade; fresh: boolean }) {
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
      {trade.side === "over" ? (
        <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
      ) : (
        <TrendingDown className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 flex items-center gap-2 flex-wrap">
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

function DigitBar({ digits }: { digits: number[] }) {
  const counts = new Array(10).fill(0) as number[];
  for (const d of digits) counts[d]++;
  const max = Math.max(...counts, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {counts.map((c, i) => (
        <div key={i} className="flex flex-col items-center flex-1">
          <div
            className={`w-full rounded-sm transition-all duration-300 ${
              i <= 2 ? "bg-destructive/60" : i >= 7 ? "bg-primary" : c === max ? "bg-chart-3" : "bg-muted-foreground/30"
            }`}
            style={{ height: `${(c / max) * 28}px` }}
          />
          <span className="font-mono text-[8px] text-muted-foreground leading-none mt-0.5">{i}</span>
        </div>
      ))}
    </div>
  );
}

type ConfigForm = {
  symbol: string;
  stake: string;
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
  const lossesVal = parseInt(form.maxLosses);
  const canStart = stakeVal > 0 && lossesVal >= 1;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Runs two independent digit strategies at once. <span className="text-foreground font-bold">Over 2</span>: after 2+
        digits ≤2 followed by a digit of exactly 3, buys Digit Over 2. <span className="text-foreground font-bold">Under 7</span>:
        after 2+ digits ≥7 followed by a digit &lt;6, buys Digit Under 7. On a loss either side immediately recovers every
        tick — no condition — on <span className="text-foreground font-bold">Over 4</span> / <span className="text-foreground font-bold">Under 5</span> respectively,
        with <span className="text-foreground font-bold">×{MARTINGALE} martingale</span> until it wins.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground uppercase">Market</Label>
          <Select value={form.symbol} onValueChange={(v) => setForm((f) => ({ ...f, symbol: v }))}>
            <SelectTrigger className="font-mono text-xs h-8 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map((s) => (
                <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
        </div>

        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground uppercase">Max Consecutive Losses (per side)</Label>
          <Input
            type="number"
            min="1"
            max="20"
            step="1"
            placeholder="e.g. 6"
            value={form.maxLosses}
            onChange={(e) => setForm((f) => ({ ...f, maxLosses: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
          <p className="text-[10px] text-muted-foreground">Each side (Over / Under) stops independently after this many losses in a row.</p>
        </div>
      </div>

      {stakeVal > 0 && lossesVal >= 1 && (
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="text-[10px] text-muted-foreground uppercase mb-2">Martingale Stake Preview</div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(lossesVal, 8) }, (_, i) => {
              const s = stakeVal * Math.pow(MARTINGALE, i);
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
        Start Master Over 2 Under 7
      </Button>
    </div>
  );
}

function BotEngine({ cfg, onStop }: { cfg: ConfigForm; onStop: () => void }) {
  const baseStake = parseFloat(cfg.stake) || 1;
  const maxLosses = parseInt(cfg.maxLosses) || 6;

  const { wsStatus, tickCount, recentDigits, over, under, trades } = useMasterOverUnder(
    cfg.symbol,
    baseStake,
    maxLosses,
    true,
  );

  const bothStopped = over.status === "max-losses" && under.status === "max-losses";
  const freshIds = new Set(trades.slice(0, 1).map((t) => t.id));

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground uppercase flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Over 2
            </span>
            <StatusBadge status={over.status} />
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">Stake</span>
            <span className="font-bold text-foreground">${over.stake.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">Losses</span>
            <span className={`font-bold ${over.consecutiveLosses > 0 ? "text-destructive" : "text-foreground"}`}>
              {over.consecutiveLosses}/{maxLosses}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground uppercase flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Under 7
            </span>
            <StatusBadge status={under.status} />
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">Stake</span>
            <span className="font-bold text-foreground">${under.stake.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">Losses</span>
            <span className={`font-bold ${under.consecutiveLosses > 0 ? "text-destructive" : "text-foreground"}`}>
              {under.consecutiveLosses}/{maxLosses}
            </span>
          </div>
        </div>
      </div>

      {recentDigits.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            <Hash className="h-3 w-3" />
            Last 20 Ticks — Digit Frequency
          </div>
          <DigitBar digits={recentDigits} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {wsStatus === "open" && !bothStopped && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {tickCount} ticks
            </span>
          )}
        </div>
        {bothStopped ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Both sides hit max losses
            </span>
            <Button size="sm" variant="outline" className="font-mono text-xs h-7" onClick={onStop}>Reset</Button>
          </div>
        ) : (
          <Button size="sm" variant="destructive" className="font-mono text-xs h-7" onClick={onStop}>
            <Square className="h-3 w-3 mr-1" /> Stop
          </Button>
        )}
      </div>

      {trades.length > 0 ? (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Trade Log</div>
          {trades.map((t) => (
            <TradeRow key={t.id} trade={t} fresh={freshIds.has(t.id)} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-4 text-center">
          <Eye className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
          <p className="font-mono text-xs text-muted-foreground">
            {tickCount < 3 ? `Buffering ticks… ${tickCount}/3` : "Watching for entry conditions on both sides…"}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Inline (full-page) version
───────────────────────────────────────────────────────────────────────── */
export function MasterOverUnderInline() {
  const [cfg, setCfg] = useState<ConfigForm | null>(null);
  const [form, setForm] = useState<ConfigForm>({
    symbol: "R_100", stake: "1", maxLosses: "6",
  });

  return (
    <section className="max-w-md mx-auto space-y-5 animate-in fade-in duration-500 px-1">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          {cfg && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background animate-ping" />
          )}
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">MASTER OVER 2 UNDER 7</h2>
          <p className="font-mono text-xs text-muted-foreground">Dual digit strategy · instant recovery · ×1.8 martingale</p>
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
export function MasterOverUnderPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<ConfigForm | null>(null);
  const [form, setForm] = useState<ConfigForm>({
    symbol: "R_100", stake: "1", maxLosses: "6",
  });

  function handleClose() {
    setCfg(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md font-mono border-border bg-background">
        <DialogHeader>
          <DialogTitle className="font-mono text-base font-bold flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            MASTER OVER 2 UNDER 7
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
