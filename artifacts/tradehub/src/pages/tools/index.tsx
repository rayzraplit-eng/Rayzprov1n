import { useListTools } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Calculator, ShieldAlert, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function ToolsList() {
  const { data: tools, isLoading } = useListTools();

  const getToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'calculator': return <Calculator className="h-8 w-8 text-primary" />;
      case 'shield': return <ShieldAlert className="h-8 w-8 text-primary" />;
      case 'trending-up': return <TrendingUp className="h-8 w-8 text-primary" />;
      default: return <Wrench className="h-8 w-8 text-primary" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <Wrench className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground">
          TRADING TOOLS
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
            <Skeleton className="h-48 w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
            <Skeleton className="h-48 w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
          </>
        ) : tools && tools.length > 0 ? (
          tools.map((tool) => (
            <Link key={tool.id} href={`/tools/${tool.id}`}>
              <Card className="rounded-none cursor-pointer group border-border/50 bg-card/50 hover:bg-muted/10 border-l-4 border-l-muted hover:border-l-primary transition-all overflow-hidden h-full">
                <CardHeader>
                  <div className="mb-4">
                    {getToolIcon(tool.icon)}
                  </div>
                  <CardTitle className="font-mono text-xl font-bold group-hover:text-primary transition-colors">
                    {tool.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="font-mono text-sm leading-relaxed">
                    {tool.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center border border-dashed border-border/50 rounded-none bg-card/30">
            <Wrench className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-mono text-lg font-bold text-muted-foreground">No tools available</h3>
            <p className="font-mono text-xs text-muted-foreground/70 mt-1">
              Trading tools could not be loaded at this time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}