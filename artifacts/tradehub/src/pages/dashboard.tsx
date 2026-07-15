import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Percent, BarChart3, Zap } from "lucide-react";
import { LiveQuoteWidget } from "@/components/live-quote-widget";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Total Profit"
          value={summary?.totalProfit}
          icon={TrendingUp}
          isLoading={isLoadingSummary}
          formatter={(v: number) => (v >= 0 ? "+" : "") + v.toFixed(2)}
          valueClass={summary && summary.totalProfit >= 0 ? "text-primary" : "text-destructive"}
        />
        <StatsCard
          title="Win Rate"
          value={summary?.winRate}
          icon={Percent}
          isLoading={isLoadingSummary}
          formatter={(v: number) => v.toFixed(1) + "%"}
        />
        <StatsCard
          title="Total Trades"
          value={summary?.totalTrades}
          icon={BarChart3}
          isLoading={isLoadingSummary}
        />
        <StatsCard
          title="Running Bots"
          value={summary?.runningBots}
          icon={Zap}
          isLoading={isLoadingSummary}
          valueClass="text-chart-3"
        />
      </div>

      <LiveQuoteWidget />
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  isLoading,
  formatter = (v: any) => v,
  valueClass = "",
}: any) {
  return (
    <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10 px-4 pt-4">
        <CardTitle className="font-mono text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </CardHeader>
      <CardContent className="relative z-10 px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-7 w-20 bg-muted/50 mt-1" />
        ) : (
          <div className={`text-xl font-mono font-bold tracking-tight ${valueClass}`}>
            {value !== undefined && value !== null ? formatter(value) : "-"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
