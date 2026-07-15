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
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Hash,
  TrendingUp,
  Eye,
} from "lucide-react";
import { useMatchesFixer, type FixerStatus, type FixerTrade } from "@/hooks/use-matches-fixer";

const SYMBOLS = [
  { id: "R_10",     label: "Volatility 10"  },
  { id: "R_25",     label: "Volatility 25"  },
  { id: "R_50",     label: "Volatility 50"  },
  { id: "R_75",     label: "Volatility 75"  },
  { id: "R_100",    label: "Volatility 100" },
  { id: "1HZ10V",   label: "Vol 10 (1s)"   },
  { id: "1HZ25V",   label: "Vol 25 (1s)"   },
  { id: "1HZ50V",   label: "Vol 50 (1s)"   },
  { id: "1HZ75V",   label: "Vol 75 (1s)"   },
  { id: "1HZ100V",  label: "Vol 100 (1s)"  },
] as const;

const MARTINGALE = 1.3;

function StatusBadge({ status }: { status: FixerStatus }) {
  const map: Record<FixerStatus, { label: string; cls: string }> = {
    idle:          { label: "IDLE",       cls: "border-muted-foreground/40 text-muted-foreground bg-muted/20"      },
    buffering:     { label: "BUFFERING…", cls: "border-chart-3/50 text-chart-3 bg-chart-3/10"                     },
    watching:      { label: "WATCHING",   cls: "border-primary/50 text-primary bg-primary/10"                     },
    trading:       { label: "TRADING",    cls: "border-primary/80 text-primary bg-primary/20"                     },
    won:           { label: "WON ✓",      cls: "border-primary/80 text-primary bg-primary/20"                     },
    "max-losses":  { label: "MAX LOSSES", cls: "border-destructive/60 text-destructive bg-destructive/10"         },
  };
  const { label, cls } = map[status];
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase ${cls}`}>
      {label}
    </Badge>
  );
}

function TradeRow({ trade, fresh }: { trade: FixerTrade; fresh: boolean }) {
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
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground">Predict</span>
        <span className="font-bold text-foreground">{trade.targetDigit}</span>
        <span className="text-muted-foreground">· Got</span>
        <span className={`font-bold ${trade.result === "win" ? "text-primary" : "text-destructive"}`}>
          {trade.actualDigit}
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
            className={`w-full rounded-sm transition-all duration-300 ${c === max ? "bg-primary" : "bg-muted-foreground/30"}`}
            style={{ height: `${(c / max) * 28}px` }}
          />
          <span className="font-mono text-[8px] text-muted-foreground leading-none mt-0.5">{i}</span>
        </div>
      ))}
    </div>
  );
}

type ConfigForm = {
  symbol:    string;
  stake:     string;
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
  const stakeVal  = parseFloat(form.stake);
  const lossesVal = parseInt(form.maxLosses);
  const canStart  = stakeVal > 0 && lossesVal >= 1;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Tracks the most-appearing digit over <span className="text-foreground font-bold">20 ticks</span>. When the leading digit shifts,
        the bot trades <span className="text-foreground font-bold">Matches</span> on the new leading digit every tick using{" "}
        <span className="text-foreground font-bold">×{MARTINGALE} martingale</span> until it wins or hits max losses.
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
          <Label className="font-mono text-xs text-muted-foreground uppercase">Max Consecutive Losses</Label>
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
          <p className="text-[10px] text-muted-foreground">Bot stops automatically if this many losses occur in a row.</p>
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
        Start Matches Fixer
      </Button>
    </div>
  );
}

function BotEngine({ cfg, onStop }: { cfg: ConfigForm; onStop: () => void }) {
  const baseStake = parseFloat(cfg.stake) || 1;
  const maxLosses = parseInt(cfg.maxLosses) || 5;

  const {
    status, wsStatus, trades, leadingDigit, targetDigit,
    currentStake, consecutiveLosses, tickCount, recentDigits,
  } = useMatchesFixer(cfg.symbol, baseStake, maxLosses, true);

  const stopped  = status === "won" || status === "max-losses";
  const freshIds = new Set(trades.slice(0, 1).map((t) => t.id));

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Leading Digit</div>
          <div className="font-mono text-2xl font-bold text-foreground">{leadingDigit ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Target</div>
          <div className={`font-mono text-2xl font-bold ${targetDigit !== null ? "text-primary" : "text-muted-foreground"}`}>
            {targetDigit ?? "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Losses</div>
          <div className={`font-mono text-2xl font-bold ${consecutiveLosses > 0 ? "text-destructive" : "text-foreground"}`}>
            {consecutiveLosses}/{maxLosses}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Current Stake
        </div>
        <span className="font-mono text-sm font-bold text-foreground">
          ${currentStake.toFixed(2)}
          {consecutiveLosses > 0 && (
            <span className="text-muted-foreground text-[10px] ml-1">(×{MARTINGALE} ×{consecutiveLosses})</span>
          )}
        </span>
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
          <StatusBadge status={status} />
          {wsStatus === "open" && !stopped && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {tickCount} ticks
            </span>
          )}
        </div>
        {stopped ? (
          <div className="flex items-center gap-2">
            {status === "won" && (
              <span className="font-mono text-xs text-primary flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Bot won!
              </span>
            )}
            {status === "max-losses" && (
              <span className="font-mono text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Max losses hit
              </span>
            )}
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
            {status === "buffering"
              ? `Buffering ticks… ${tickCount}/20`
              : status === "watching"
              ? "Watching for leading digit shift…"
              : "Waiting for first trade…"}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Inline (full-page) version — used inside the Master Bot tab
───────────────────────────────────────────────────────────────────────── */
export function MatchesFixerInline() {
  const [cfg, setCfg] = useState<ConfigForm | null>(null);
  const [form, setForm] = useState<ConfigForm>({
    symbol: "R_100", stake: "1", maxLosses: "5",
  });

  return (
    <section className="max-w-md mx-auto space-y-5 animate-in fade-in duration-500 px-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          {cfg && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background animate-ping" />
          )}
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold tracking-tight text-foreground">MATCHES FIXER</h2>
          <p className="font-mono text-xs text-muted-foreground">Leading digit shift · ×1.3 martingale · auto-stop</p>
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
export function MatchesFixerPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<ConfigForm | null>(null);
  const [form, setForm] = useState<ConfigForm>({
    symbol: "R_100", stake: "1", maxLosses: "5",
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
            <Zap className="h-4 w-4 text-primary" />
            MATCHES FIXER
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
