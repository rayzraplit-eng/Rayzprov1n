import { useListTrades, useCreateTrade, useDeleteTrade, getListTradesQueryKey, getGetDashboardSummaryQueryKey, getGetSymbolBreakdownQueryKey, getGetEquityCurveQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Trash2, TrendingUp, TrendingDown, Minus, Filter, CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { BotBacktestSection } from "@/components/bot-backtest-section";

const tradeSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  contractType: z.string().min(1, "Contract type is required"),
  stake: z.coerce.number().min(0.01, "Stake must be positive"),
  payout: z.coerce.number().min(0, "Payout must be positive"),
  profit: z.coerce.number(),
  result: z.enum(["win", "loss", "breakeven"]),
  botId: z.coerce.number().optional().or(z.literal(0)),
  notes: z.string().optional(),
  tradedAt: z.string().optional()
});

export default function Journal() {
  const [filterResult, setFilterResult] = useState<"win" | "loss" | "breakeven" | "all">("all");
  const { data: trades, isLoading } = useListTrades(
    filterResult === "all" ? {} : { result: filterResult }
  );
  
  const createTrade = useCreateTrade();
  const deleteTrade = useDeleteTrade();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const form = useForm<z.infer<typeof tradeSchema>>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      symbol: "",
      contractType: "CALL",
      stake: 10,
      payout: 19.5,
      profit: 9.5,
      result: "win",
      notes: ""
    }
  });

  // Watch stake and payout to auto-calculate profit and result if possible
  const watchStake = form.watch("stake");
  const watchPayout = form.watch("payout");

  const handleAutoCalc = () => {
    const profit = Number((watchPayout - watchStake).toFixed(2));
    form.setValue("profit", profit);
    if (profit > 0) form.setValue("result", "win");
    else if (profit < 0) form.setValue("result", "loss");
    else form.setValue("result", "breakeven");
  };

  const onSubmit = (data: z.infer<typeof tradeSchema>) => {
    createTrade.mutate({ 
      data: {
        ...data,
        botId: data.botId || null,
        tradedAt: data.tradedAt || new Date().toISOString()
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSymbolBreakdownQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetEquityCurveQueryKey() });
        toast({ title: "Trade logged successfully" });
        setIsAddOpen(false);
        form.reset();
      },
      onError: (error: any) => {
        toast({ title: "Failed to log trade", description: error.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this trade record?")) return;
    deleteTrade.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSymbolBreakdownQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetEquityCurveQueryKey() });
        toast({ title: "Trade deleted" });
      }
    });
  };

  const totals = useMemo(() => {
    if (!trades) return { profit: 0, wins: 0, losses: 0, total: 0, winRate: 0 };
    let profit = 0, wins = 0, losses = 0;
    trades.forEach(t => {
      profit += t.profit;
      if (t.result === 'win') wins++;
      if (t.result === 'loss') losses++;
    });
    const total = trades.length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { profit, wins, losses, total, winRate };
  }, [trades]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="h-8 w-8 text-primary" />
          TRADE JOURNAL
        </h1>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-card border border-border/50 p-1">
            <Filter className="h-4 w-4 text-muted-foreground ml-2" />
            <Select value={filterResult} onValueChange={(val: any) => setFilterResult(val)}>
              <SelectTrigger className="w-[140px] font-mono text-xs border-none bg-transparent shadow-none focus:ring-0">
                <SelectValue placeholder="Filter Result" />
              </SelectTrigger>
              <SelectContent className="font-mono text-xs rounded-none border-border">
                <SelectItem value="all">All Trades</SelectItem>
                <SelectItem value="win">Wins Only</SelectItem>
                <SelectItem value="loss">Losses Only</SelectItem>
                <SelectItem value="breakeven">Breakeven</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono gap-2 rounded-none shadow-[2px_2px_0px_0px_hsl(var(--primary-border))] border border-primary shrink-0">
                <Plus className="h-4 w-4" />
                LOG TRADE
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-card/95 backdrop-blur-xl rounded-none border-l-4 border-l-primary sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle className="font-mono font-bold uppercase tracking-wider">Log Manual Trade</DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  Record a trade not caught by your automated bots.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="symbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Symbol</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Volatility 75" className="font-mono rounded-none" {...field} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contractType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Contract Type</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. CALL, PUT" className="font-mono rounded-none uppercase" {...field} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="stake"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Stake ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" className="font-mono rounded-none" {...field} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Payout ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" className="font-mono rounded-none" {...field} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs" />
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-col justify-end">
                      <Button type="button" variant="outline" onClick={handleAutoCalc} className="font-mono text-xs rounded-none h-10">
                        AUTO CALC
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                    <FormField
                      control={form.control}
                      name="profit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Net Profit ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" className="font-mono rounded-none bg-muted/20" {...field} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="result"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Result</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="font-mono rounded-none bg-muted/20">
                                <SelectValue placeholder="Select result" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="font-mono rounded-none">
                              <SelectItem value="win">Win</SelectItem>
                              <SelectItem value="loss">Loss</SelectItem>
                              <SelectItem value="breakeven">Breakeven</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="font-mono text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Notes (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Strategy rationale, emotional state, etc." className="font-mono rounded-none" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={createTrade.isPending} className="w-full font-mono rounded-none mt-4">
                    {createTrade.isPending ? "SAVING..." : "SAVE TRADE RECORD"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-l-4 border-l-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="font-mono text-[10px] text-primary uppercase tracking-wider mb-1">Net P/L</div>
            <div className={`font-mono text-2xl font-bold ${totals.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {totals.profit >= 0 ? '+' : ''}{totals.profit.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none">
          <CardContent className="p-4">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Win Rate</div>
            <div className="font-mono text-2xl font-bold">{totals.winRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none">
          <CardContent className="p-4">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Trades</div>
            <div className="font-mono text-2xl font-bold">{totals.total}</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none">
          <CardContent className="p-4">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">W / L</div>
            <div className="font-mono text-2xl font-bold text-muted-foreground">
              <span className="text-primary">{totals.wins}</span> / <span className="text-destructive">{totals.losses}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <BotBacktestSection />

      <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : trades && trades.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50">
                  <TableHead className="font-mono text-xs font-bold text-foreground">Date</TableHead>
                  <TableHead className="font-mono text-xs font-bold text-foreground">Asset</TableHead>
                  <TableHead className="font-mono text-xs font-bold text-foreground">Contract</TableHead>
                  <TableHead className="text-right font-mono text-xs font-bold text-foreground">Stake</TableHead>
                  <TableHead className="text-right font-mono text-xs font-bold text-foreground">Payout</TableHead>
                  <TableHead className="text-right font-mono text-xs font-bold text-foreground">Net P/L</TableHead>
                  <TableHead className="text-right font-mono text-xs font-bold text-foreground"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id} className="border-border/50 hover:bg-muted/30 transition-colors group">
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(trade.tradedAt), 'MMM dd, HH:mm:ss')}
                    </TableCell>
                    <TableCell className="font-mono font-medium text-sm">
                      {trade.symbol}
                      {trade.botId && (
                        <Badge variant="outline" className="ml-2 font-mono text-[9px] border-primary/30 text-primary px-1 py-0 h-4">BOT</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {trade.contractType}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">${trade.stake.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">${trade.payout.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                      <div className={`flex items-center justify-end gap-1 ${trade.profit > 0 ? 'text-primary' : trade.profit < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {trade.profit > 0 ? <TrendingUp className="h-3 w-3" /> : trade.profit < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-none opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(trade.id)}
                        disabled={deleteTrade.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-20 text-center flex flex-col items-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-mono text-sm">No trades found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}