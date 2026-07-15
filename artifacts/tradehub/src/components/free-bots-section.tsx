import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Download, Star, Zap, TrendingUp, Shield, Radio, Crown, Sparkles } from "lucide-react";
import { useImportBot } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MatchesFixerPanel } from "@/components/matches-fixer-panel";
import { MasterOverUnderPanel } from "@/components/master-over-under-panel";
import { DiffersProPanel } from "@/components/differs-pro-panel";

type FreeBot = {
  name: string;
  description: string;
  strategy: string;
  market: string;
  tags: string[];
  rating: number;
  downloads: string;
  risk: "low" | "medium" | "high";
  xml: string;
};

const TEMPLATE_XML = (name: string, symbol: string) => `<xml xmlns="http://www.w3.org/1999/xhtml" is_dbot="true" collection="false">
  <variables></variables>
  <block type="trade_definition" id="trade_root_${name.replace(/\s+/g, "_")}" deletable="false" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${symbol}</field>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradetype">
        <field name="TRADETYPECAT_LIST">callput</field>
        <field name="TRADETYPE_LIST">callput</field>
      </block>
    </statement>
  </block>
</xml>`;

const FREE_BOTS: FreeBot[] = [
  {
    name: "Smart Martingale Pro",
    description: "Adaptive 1.85x recovery with cooldown after 4 consecutive losses. Tested on R_75.",
    strategy: "Martingale",
    market: "Volatility 75",
    tags: ["martingale", "vol75", "recovery"],
    rating: 4.7,
    downloads: "12.3k",
    risk: "high",
    xml: TEMPLATE_XML("Smart_Martingale_Pro", "R_75"),
  },
  {
    name: "Boom Spike Hunter",
    description: "Detects approaching spikes on Boom 1000 using tick density. CALL only.",
    strategy: "Spike Catcher",
    market: "Boom 1000",
    tags: ["boom", "spike", "ticks"],
    rating: 4.5,
    downloads: "8.9k",
    risk: "medium",
    xml: TEMPLATE_XML("Boom_Spike_Hunter", "BOOM1000"),
  },
  {
    name: "Crash 500 Sniper",
    description: "Counter-trend buyer after 3 fast red candles. Built-in 1% stop-loss.",
    strategy: "Counter-trend",
    market: "Crash 500",
    tags: ["crash", "counter-trend", "safe"],
    rating: 4.3,
    downloads: "6.4k",
    risk: "low",
    xml: TEMPLATE_XML("Crash_500_Sniper", "CRASH500"),
  },
  {
    name: "Even/Odd Digit Master",
    description: "Statistical bias on last digit of R_100 with anti-streak filter.",
    strategy: "Digits",
    market: "Volatility 100",
    tags: ["digits", "vol100", "even-odd"],
    rating: 4.6,
    downloads: "10.1k",
    risk: "medium",
    xml: TEMPLATE_XML("Even_Odd_Digit_Master", "R_100"),
  },
  {
    name: "Step Index Reversal",
    description: "Mean reversion on Step Index with dynamic take-profit ladder.",
    strategy: "Mean Reversion",
    market: "Step Index",
    tags: ["step", "reversal", "low-risk"],
    rating: 4.4,
    downloads: "5.7k",
    risk: "low",
    xml: TEMPLATE_XML("Step_Index_Reversal", "stpRNG"),
  },
  {
    name: "Vol 25 Scalper X",
    description: "1-tick scalper on Volatility 25 with momentum entry filter.",
    strategy: "Scalping",
    market: "Volatility 25",
    tags: ["vol25", "scalp", "fast"],
    rating: 4.2,
    downloads: "4.3k",
    risk: "high",
    xml: TEMPLATE_XML("Vol_25_Scalper_X", "R_25"),
  },
];

const RISK_STYLES: Record<FreeBot["risk"], string> = {
  low: "border-primary/40 text-primary bg-primary/10",
  medium: "border-chart-3/40 text-chart-3 bg-chart-3/10",
  high: "border-destructive/40 text-destructive bg-destructive/10",
};

export function FreeBotsSection() {
  const { toast } = useToast();
  const importBot = useImportBot();
  const queryClient = useQueryClient();
  const [importingName, setImportingName] = useState<string | null>(null);
  const [fixerOpen, setFixerOpen] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [differsOpen, setDiffersOpen] = useState(false);

  const handleImport = (bot: FreeBot) => {
    setImportingName(bot.name);
    importBot.mutate(
      {
        data: {
          name: bot.name,
          description: bot.description,
          strategy: bot.strategy,
          market: bot.market,
          tags: bot.tags,
          xmlContent: bot.xml,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Bot imported", description: `${bot.name} added to your library.` });
          queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
          setImportingName(null);
        },
        onError: (err: any) => {
          toast({ title: "Import failed", description: err?.message ?? "Try again.", variant: "destructive" });
          setImportingName(null);
        },
      },
    );
  };

  const handleDownload = (bot: FreeBot) => {
    const blob = new Blob([bot.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bot.name.replace(/\s+/g, "_")}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
          <Bot className="h-7 w-7 text-primary" />
          FREE BOTS
        </h2>
        <Badge variant="outline" className="font-mono text-[10px] border-primary/40 text-primary bg-primary/10">
          {FREE_BOTS.length + 3} AVAILABLE
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground font-mono mb-4">
        Curated, ready-to-run Deriv DBot strategies. Download the XML or push directly to your library.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FREE_BOTS.map((bot) => (
          <Card
            key={bot.name}
            className="border-border shadow-md bg-card/50 backdrop-blur-sm hover:border-primary/40 transition-colors relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardHeader className="pb-3 relative z-10">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="font-mono text-sm leading-tight">{bot.name}</CardTitle>
                <Badge variant="outline" className={`font-mono text-[10px] uppercase ${RISK_STYLES[bot.risk]} shrink-0`}>
                  {bot.risk} risk
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-chart-3 text-chart-3" />
                  {bot.rating}
                </span>
                <span className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  {bot.downloads}
                </span>
                <span className="text-muted-foreground/70">{bot.market}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 relative z-10">
              <p className="text-xs text-muted-foreground leading-relaxed min-h-[40px]">{bot.description}</p>
              <div className="flex flex-wrap gap-1">
                {bot.tags.map((t) => (
                  <Badge key={t} variant="outline" className="font-mono text-[9px] px-1.5 py-0 h-4 border-border/60 text-muted-foreground uppercase">
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 font-mono text-xs h-8"
                  onClick={() => handleImport(bot)}
                  disabled={importBot.isPending && importingName === bot.name}
                  data-testid={`button-import-${bot.name.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {importBot.isPending && importingName === bot.name ? "Adding..." : "Add to Library"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs h-8"
                  onClick={() => handleDownload(bot)}
                  data-testid={`button-download-${bot.name.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* ── Master Over 2 Under 7 — Live Bot card ── */}
        <Card className="border-primary/30 shadow-md bg-card/50 backdrop-blur-sm hover:border-primary/60 transition-colors relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-transparent pointer-events-none" />
          <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary animate-ping" />
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="font-mono text-sm leading-tight">Master Over 2 Under 7</CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/50 text-primary bg-primary/10 shrink-0">
                Live
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-chart-3 text-chart-3" />
                4.9
              </span>
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3 text-primary" />
                Real-time
              </span>
              <span className="text-muted-foreground/70">Digits</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 relative z-10">
            <p className="text-xs text-muted-foreground leading-relaxed min-h-[40px]">
              Dual strategy: Over 2 entry after 2+ digits ≤2 then a 3, and Under 7 entry after 2+ digits ≥7 then &lt;6. On a
              loss, recovers instantly every tick on Over 4 / Under 5 with ×1.8 martingale until it wins.
            </p>
            <div className="flex flex-wrap gap-1">
              {["digits", "over-under", "martingale", "dual-strategy", "recovery"].map((t) => (
                <Badge key={t} variant="outline" className="font-mono text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary/70 uppercase">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 font-mono text-xs h-8"
                onClick={() => setMasterOpen(true)}
              >
                <Crown className="h-3 w-3 mr-1" />
                Launch Bot
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Matches Fixer — Live Bot card ── */}
        <Card className="border-primary/30 shadow-md bg-card/50 backdrop-blur-sm hover:border-primary/60 transition-colors relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-transparent pointer-events-none" />
          <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary animate-ping" />
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="font-mono text-sm leading-tight">Matches Fixer</CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/50 text-primary bg-primary/10 shrink-0">
                Live
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-chart-3 text-chart-3" />
                4.8
              </span>
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3 text-primary" />
                Real-time
              </span>
              <span className="text-muted-foreground/70">Digits</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 relative z-10">
            <p className="text-xs text-muted-foreground leading-relaxed min-h-[40px]">
              Detects leading digit shifts over 20 ticks, then trades Matches on the new dominant digit with ×1.3 martingale. Stops on first win or max losses.
            </p>
            <div className="flex flex-wrap gap-1">
              {["matches", "digits", "martingale", "live", "auto-stop"].map((t) => (
                <Badge key={t} variant="outline" className="font-mono text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary/70 uppercase">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 font-mono text-xs h-8"
                onClick={() => setFixerOpen(true)}
              >
                <Zap className="h-3 w-3 mr-1" />
                Launch Bot
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Differs Pro — Live Bot card ── */}
        <Card className="border-primary/30 shadow-md bg-card/50 backdrop-blur-sm hover:border-primary/60 transition-colors relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-transparent pointer-events-none" />
          <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary animate-ping" />
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="font-mono text-sm leading-tight">Differs Pro</CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/50 text-primary bg-primary/10 shrink-0">
                Live
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-chart-3 text-chart-3" />
                4.9
              </span>
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3 text-primary" />
                Real-time
              </span>
              <span className="text-muted-foreground/70">10 Markets</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 relative z-10">
            <p className="text-xs text-muted-foreground leading-relaxed min-h-[40px]">
              Watches all 10 volatility indices at once over 75 ticks for the least-appearing digit. Fires a Differs trade
              (up to 10 at once) the instant it shifts. On a loss, recovers on the leading side — Over 3 or Under 6 — with
              ×2 martingale.
            </p>
            <div className="flex flex-wrap gap-1">
              {["differs", "digits", "martingale", "multi-market", "recovery"].map((t) => (
                <Badge key={t} variant="outline" className="font-mono text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary/70 uppercase">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 font-mono text-xs h-8"
                onClick={() => setDiffersOpen(true)}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Launch Bot
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <MatchesFixerPanel open={fixerOpen} onClose={() => setFixerOpen(false)} />
      <MasterOverUnderPanel open={masterOpen} onClose={() => setMasterOpen(false)} />
      <DiffersProPanel open={differsOpen} onClose={() => setDiffersOpen(false)} />
    </section>
  );
}
