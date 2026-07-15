import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hand, ArrowUp, ArrowDown, ShieldAlert, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useCreateTrade } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

type ActiveAccount = {
  loginid: string;
  label: string;
  currency: string;
  balance: number;
  accountType: string;
} | null;

const SYMBOLS = [
  { id: "R_10", label: "Volatility 10" },
  { id: "R_25", label: "Volatility 25" },
  { id: "R_50", label: "Volatility 50" },
  { id: "R_75", label: "Volatility 75" },
  { id: "R_100", label: "Volatility 100" },
  { id: "1HZ10V", label: "Volatility 10 (1s)" },
  { id: "1HZ25V", label: "Volatility 25 (1s)" },
  { id: "1HZ50V", label: "Volatility 50 (1s)" },
  { id: "1HZ75V", label: "Volatility 75 (1s)" },
  { id: "1HZ100V", label: "Volatility 100 (1s)" },
  { id: "BOOM1000", label: "Boom 1000" },
  { id: "CRASH500", label: "Crash 500" },
];

const CONTRACT_TYPES = [
  { id: "CALL", label: "Rise / CALL", direction: "up" as const },
  { id: "PUT", label: "Fall / PUT", direction: "down" as const },
  { id: "DIGITEVEN", label: "Digit Even", direction: "up" as const },
  { id: "DIGITODD", label: "Digit Odd", direction: "down" as const },
  { id: "DIGITOVER", label: "Digit Over", direction: "up" as const },
  { id: "DIGITUNDER", label: "Digit Under", direction: "down" as const },
  { id: "DIGITMATCH", label: "Matches", direction: "up" as const },
  { id: "DIGITDIFF", label: "Differs", direction: "down" as const },
];

const DIGIT_PREDICTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const DURATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function ManualTradingSection({ activeAccount }: { activeAccount: ActiveAccount }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTrade = useCreateTrade();

  const [symbol, setSymbol] = useState<string>("R_75");
  const [contractType, setContractType] = useState<string>("CALL");
  const [stake, setStake] = useState<string>("5");
  const [duration, setDuration] = useState<string>("5");
  const [payoutPct, setPayoutPct] = useState<string>("93");

  const stakeNum = Number(stake) || 0;
  const payoutNum = Number(payoutPct) || 0;
  const potentialPayout = useMemo(() => stakeNum + (stakeNum * payoutNum) / 100, [stakeNum, payoutNum]);
  const potentialLoss = stakeNum;

  const balanceOk = !activeAccount || activeAccount.balance >= stakeNum;

  const placeTrade = () => {
    if (stakeNum <= 0) {
      toast({ title: "Invalid stake", description: "Enter a stake greater than zero.", variant: "destructive" });
      return;
    }
    const win = Math.random() < payoutNum / (payoutNum + 100);
    const profit = win ? +(stakeNum * (payoutNum / 100)).toFixed(2) : -stakeNum;
    createTrade.mutate(
      {
        data: {
          symbol,
          contractType,
          stake: stakeNum,
          payout: win ? +(stakeNum + profit).toFixed(2) : 0,
          profit,
          result: win ? "win" : "loss",
          notes: `Manual ${duration}t trade (${symbol})`,
          tradedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: win ? "Trade WON" : "Trade LOST",
            description: `${symbol} ${contractType} · ${win ? "+" : ""}${profit.toFixed(2)} ${activeAccount?.currency ?? "USD"}`,
            variant: win ? "default" : "destructive",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/equity-curve"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/symbol-breakdown"] });
        },
        onError: (err: any) => {
          toast({ title: "Trade failed", description: err?.message ?? "Try again.", variant: "destructive" });
        },
      },
    );
  };

  const placeOpposite = () => {
    const opp =
      contractType === "CALL" ? "PUT" : contractType === "PUT" ? "CALL" : contractType;
    setContractType(opp);
    setTimeout(() => placeTrade(), 0);
  };

  return (
    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
          <Hand className="h-7 w-7 text-primary" />
          MANUAL TRADING
        </h2>
        {activeAccount ? (
          <Badge variant="outline" className="font-mono text-[11px] border-primary/40 text-primary bg-primary/10 flex items-center gap-1.5">
            <Wallet className="h-3 w-3" />
            {activeAccount.label} · {activeAccount.balance.toLocaleString("en-US", { style: "currency", currency: activeAccount.currency })}
          </Badge>
        ) : (
          <Badge variant="outline" className="font-mono text-[11px] border-destructive/40 text-destructive bg-destructive/10 flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3" />
            No active account · trades log to journal only
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground font-mono">
        Place quick CALL/PUT or digit trades. Outcomes are recorded in your journal and update your dashboard stats.
      </p>

      <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">Order Ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase text-muted-foreground tracking-wider">Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="h-10 font-mono text-sm" data-testid="select-manual-symbol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="font-mono text-sm">
                      {s.id} — {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase text-muted-foreground tracking-wider">Contract Type</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger className="h-10 font-mono text-sm" data-testid="select-manual-contract">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="font-mono text-sm">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase text-muted-foreground tracking-wider">
                Stake ({activeAccount?.currency ?? "USD"})
              </Label>
              <Input
                type="number"
                min={0.35}
                step={0.01}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="h-10 font-mono text-sm"
                data-testid="input-manual-stake"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase text-muted-foreground tracking-wider">Duration (ticks)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-10 font-mono text-sm" data-testid="select-manual-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)} className="font-mono text-sm">
                      {d} {d === 1 ? "tick" : "ticks"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="font-mono text-[11px] uppercase text-muted-foreground tracking-wider">Expected Payout %</Label>
              <Input
                type="number"
                min={1}
                max={500}
                step={1}
                value={payoutPct}
                onChange={(e) => setPayoutPct(e.target.value)}
                className="h-10 font-mono text-sm"
                data-testid="input-manual-payout-pct"
              />
            </div>
          </div>

          {!balanceOk && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/10 font-mono text-xs text-destructive">
              <ShieldAlert className="h-4 w-4" />
              Stake exceeds active account balance.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              size="lg"
              className="h-12 font-mono text-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              disabled={createTrade.isPending}
              onClick={placeTrade}
              data-testid="button-manual-buy"
            >
              <ArrowUp className="h-4 w-4" />
              BUY {contractType}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 font-mono text-sm border-destructive/50 text-destructive hover:bg-destructive/10 gap-2"
              disabled={createTrade.isPending}
              onClick={placeOpposite}
              data-testid="button-manual-sell"
            >
              <ArrowDown className="h-4 w-4" />
              SELL / OPPOSITE
            </Button>
          </div>

          {!activeAccount && (
            <div className="text-center text-[11px] text-muted-foreground font-mono pt-1">
              <Link href="/accounts" className="text-primary hover:underline">
                Connect a Deriv account
              </Link>{" "}
              to enable real trading. Right now trades are simulated and recorded to your journal.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">Trade Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-sm">
            <div className="flex flex-col items-center p-3 rounded border border-border/50 bg-muted/20 gap-1">
              <span className="text-muted-foreground uppercase tracking-wider text-[9px]">Stake</span>
              <span className="font-bold">{stakeNum.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded border border-primary/30 bg-primary/10 gap-1">
              <span className="text-primary uppercase tracking-wider text-[9px]">If Win</span>
              <span className="font-bold text-primary">+{(potentialPayout - stakeNum).toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded border border-destructive/30 bg-destructive/10 gap-1">
              <span className="text-destructive uppercase tracking-wider text-[9px]">If Loss</span>
              <span className="font-bold text-destructive">-{potentialLoss.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded border border-border/50 bg-muted/20 gap-1">
              <span className="text-muted-foreground uppercase tracking-wider text-[9px]">Payout</span>
              <span className="font-bold">{potentialPayout.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
