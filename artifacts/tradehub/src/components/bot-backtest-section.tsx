import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, TrendingUp, TrendingDown, Flame, Loader2 } from "lucide-react";
import { BACKTEST_BOTS, BACKTEST_DURATIONS, runBacktest, type BacktestBotId, type BacktestResult } from "@/lib/backtest-engine";
import { fetchHistoricalTicks } from "@/lib/fetch-history-ticks";
import { useToast } from "@/hooks/use-toast";

const SYMBOLS = [
  { id: "R_10",     label: "Volatility 10" },
  { id: "R_25",     label: "Volatility 25" },
  { id: "R_50",     label: "Volatility 50" },
  { id: "R_75",     label: "Volatility 75" },
  { id: "R_100",    label: "Volatility 100" },
  { id: "1HZ10V",   label: "Volatility 10 (1s)" },
  { id: "1HZ25V",   label: "Volatility 25 (1s)" },
  { id: "1HZ50V",   label: "Volatility 50 (1s)" },
  { id: "1HZ75V",   label: "Volatility 75 (1s)" },
  { id: "1HZ100V",  label: "Volatility 100 (1s)" },
];

export function BotBacktestSection() {
  const { toast } = useToast();
  const [botId, setBotId]     = useState<BacktestBotId>(BACKTEST_BOTS[0].id);
  const [symbol, setSymbol]   = useState("R_100");
  const [duration, setDuration] = useState<number>(BACKTEST_DURATIONS[1].id);
  const [stake, setStake]     = useState("1");
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<BacktestResult | null>(null);
  const [coverage, setCoverage] = useState<number | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const { quotes, pipSize } = await fetchHistoricalTicks(symbol, duration);
      if (quotes.length < 200) {
        toast({ title: "Not enough history", description: "Deriv returned too few ticks to evaluate this bot reliably.", variant: "destructive" });
        return;
      }
      const baseStake = Number(stake) || 1;
      const res = runBacktest(botId, quotes, pipSize, baseStake);
      setResult(res);
      setCoverage(quotes.length);
    } catch (err: any) {
      toast({ title: "Backtest failed", description: err.message || "Could not fetch historical data", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="font-mono flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-primary" /> BOT BACKTEST ENGINE
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          Replays a bot's real entry logic over actual historical ticks to show how it would have performed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase text-muted-foreground">Bot</label>
            <Select value={botId} onValueChange={(v) => setBotId(v as BacktestBotId)}>
              <SelectTrigger className="font-mono text-xs rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent className="font-mono text-xs rounded-none">
                {BACKTEST_BOTS.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase text-muted-foreground">Market</label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="font-mono text-xs rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent className="font-mono text-xs rounded-none">
                {SYMBOLS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase text-muted-foreground">Duration</label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger className="font-mono text-xs rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent className="font-mono text-xs rounded-none">
                {BACKTEST_DURATIONS.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase text-muted-foreground">Base Stake ($)</label>
            <Input value={stake} onChange={(e) => setStake(e.target.value)} type="number" step="0.01" className="font-mono text-xs rounded-none" />
          </div>
          <div className="flex flex-col justify-end">
            <Button onClick={run} disabled={running} className="font-mono text-xs rounded-none h-9 gap-2">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              {running ? "RUNNING…" : "RUN BACKTEST"}
            </Button>
          </div>
        </div>

        {result && (
          <div className="pt-2 border-t border-border/40 space-y-3">
            {coverage !== null && coverage < duration && (
              <div className="font-mono text-[10px] text-amber-400">
                Deriv only returned {coverage.toLocaleString()} of {duration.toLocaleString()} requested ticks (that's the full history it retains) — results reflect that window.
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Simulated Trades" value={result.totalTrades} />
              <Stat label="Win Rate" value={`${result.winRate.toFixed(1)}%`} accent={result.winRate >= 50 ? "up" : "down"} />
              <Stat label="Wins / Losses" value={<span><span className="text-primary">{result.wins}</span> / <span className="text-destructive">{result.losses}</span></span>} />
              <Stat label="Max Win Streak" value={result.maxWinStreak} accent="up" icon={<Flame className="h-3 w-3 text-primary" />} />
              <Stat label="Max Loss Streak" value={result.maxLossStreak} accent="down" icon={<Flame className="h-3 w-3 text-destructive" />} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">Simulated Net P/L:</span>
              <Badge variant="outline" className={`font-mono text-xs ${result.netPnl >= 0 ? "border-primary/40 text-primary bg-primary/10" : "border-destructive/40 text-destructive bg-destructive/10"}`}>
                {result.netPnl >= 0 ? "+" : ""}{result.netPnl.toFixed(2)}
              </Badge>
              {result.endingStreak.type !== "none" && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  · currently on a {result.endingStreak.count}-{result.endingStreak.type} streak at window end
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: React.ReactNode; accent?: "up" | "down"; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
      <div className="font-mono text-[9px] uppercase text-muted-foreground mb-1 flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={`font-mono text-lg font-bold flex items-center gap-1 ${accent === "up" ? "text-primary" : accent === "down" ? "text-destructive" : "text-foreground"}`}>
        {accent === "up" && <TrendingUp className="h-3.5 w-3.5" />}
        {accent === "down" && <TrendingDown className="h-3.5 w-3.5" />}
        {value}
      </div>
    </div>
  );
}
