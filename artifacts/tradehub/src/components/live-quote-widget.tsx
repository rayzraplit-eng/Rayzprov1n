import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useDerivTicks } from "@/hooks/use-deriv-ticks";
import type { DerivTickStatus } from "@/hooks/use-deriv-ticks";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

const SYMBOLS = [
  // Standard volatility indices
  { id: "R_10",    label: "Volatility 10"         },
  { id: "R_25",    label: "Volatility 25"         },
  { id: "R_50",    label: "Volatility 50"         },
  { id: "R_75",    label: "Volatility 75"         },
  { id: "R_100",   label: "Volatility 100"        },
  // 1-second volatility indices (new Deriv)
  { id: "1HZ10V",  label: "Volatility 10 (1s)"   },
  { id: "1HZ25V",  label: "Volatility 25 (1s)"   },
  { id: "1HZ50V",  label: "Volatility 50 (1s)"   },
  { id: "1HZ75V",  label: "Volatility 75 (1s)"   },
  { id: "1HZ100V", label: "Volatility 100 (1s)"  },
  // Boom & Crash
  { id: "BOOM1000",  label: "Boom 1000"           },
  { id: "BOOM500",   label: "Boom 500"            },
  { id: "CRASH1000", label: "Crash 1000"          },
  { id: "CRASH500",  label: "Crash 500"           },
];

function ConnectionBadge({ status }: { status: DerivTickStatus }) {
  if (status === "open") {
    return (
      <Badge variant="outline" className="font-mono text-[10px] border-primary/40 text-primary bg-primary/10 flex items-center gap-1">
        <Wifi className="h-3 w-3" />
        LIVE
      </Badge>
    );
  }
  if (status === "connecting") {
    return (
      <Badge variant="outline" className="font-mono text-[10px] border-chart-3/40 text-chart-3 bg-chart-3/10 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        CONNECTING
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-mono text-[10px] border-destructive/40 text-destructive bg-destructive/10 flex items-center gap-1">
      <WifiOff className="h-3 w-3" />
      {status.toUpperCase()}
    </Badge>
  );
}

export function LiveQuoteWidget() {
  const [symbol, setSymbol] = useState("R_75");
  const { ticks, status, last, direction } = useDerivTicks(symbol, { bufferSize: 120 });
  const pip = last?.pip_size ?? 2;
  const sparkline = useMemo(() => ticks.map((t, i) => ({ i, v: t.quote })), [ticks]);

  return (
    <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">
            Live Quote
          </CardTitle>
          <ConnectionBadge status={status} />
        </div>
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="h-8 font-mono text-xs mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((s) => (
              <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
                {s.id} — {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-5 text-center">
          <div className="font-mono text-[11px] uppercase text-muted-foreground tracking-widest">{symbol}</div>
          <div
            className={`font-mono text-5xl font-bold mt-3 transition-colors tabular-nums ${
              direction === "up"
                ? "text-primary"
                : direction === "down"
                ? "text-destructive"
                : "text-foreground"
            }`}
          >
            {last ? last.quote.toFixed(pip) : "—"}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
            {direction === "up" && <ArrowUp className="h-3 w-3 text-primary" />}
            {direction === "down" && <ArrowDown className="h-3 w-3 text-destructive" />}
            {!last && <span className="h-3 w-3 inline-block" />}
            {last ? `epoch ${last.epoch}` : "waiting for ticks…"}
          </div>
        </div>

        <div className="h-20">
          {sparkline.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={
                    direction === "down"
                      ? "hsl(var(--destructive))"
                      : "hsl(var(--primary))"
                  }
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-[10px] font-mono text-muted-foreground/50">
                Buffering ticks…
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="flex flex-col items-center p-2 rounded border border-border/50 bg-muted/20">
            <span className="text-muted-foreground uppercase tracking-wider text-[9px]">Ticks</span>
            <span className="font-bold text-sm">{ticks.length}</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded border border-border/50 bg-muted/20">
            <span className="text-muted-foreground uppercase tracking-wider text-[9px]">Pip Size</span>
            <span className="font-bold text-sm">{pip}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
