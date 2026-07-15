import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDerivTicks } from "@/hooks/useDerivTicks";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ title, value, loading }: { title: string, value: string | number, loading: boolean }) {
  return (
    <Card className="rounded-sm border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-mono tracking-tight text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-[100px] rounded-sm" />
        ) : (
          <div className="text-2xl font-mono font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { ticks, connected } = useDerivTicks("R_100");

  const lastTick = ticks[ticks.length - 1];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-4">
        <StatCard title="TOTAL_PROFIT" value={`$${stats?.totalProfit?.toFixed(2) || '0.00'}`} loading={statsLoading} />
        <StatCard title="WIN_RATE" value={`${stats?.winRate?.toFixed(1) || 0}%`} loading={statsLoading} />
        <StatCard title="TOTAL_TRADES" value={stats?.totalTrades || 0} loading={statsLoading} />
        <StatCard title="RUNNING_BOTS" value={stats?.runningBots || 0} loading={statsLoading} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1 rounded-sm bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-mono flex items-center justify-between">
              <span>LIVE_QUOTE (R_100)</span>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-primary' : 'bg-destructive'}`} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-4">
              <div className="text-5xl font-mono font-bold tracking-tighter">
                {lastTick ? lastTick.quote.toFixed(2) : "0000.00"}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {lastTick ? `EPOCH: ${lastTick.epoch}` : "AWAITING TICK..."}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
