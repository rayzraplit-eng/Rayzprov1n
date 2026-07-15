import { useState, useRef } from "react";
import { LayoutDashboard, Brain, BarChart2, Hand, BookOpen, Zap, ChevronDown, ArrowLeftRight, Layers } from "lucide-react";
import { useListAccounts } from "@workspace/api-client-react";
import { InstallPWAButton } from "@/components/install-pwa-button";
import Dashboard from "@/pages/dashboard";
import Journal from "@/pages/journal";
import { MatchesFixerInline } from "@/components/matches-fixer-panel";
import { ReverseOverUnderInline } from "@/components/reverse-over-under-panel";
import { Over2Under7ProInline }  from "@/components/over2-under7-pro-panel";
import { Under8Over1ProInline }    from "@/components/under8-over1-pro-panel";
import { VirtualOverUnderInline }  from "@/components/virtual-over-under-panel";
import { AnalisisToolSection } from "@/components/analisis-tool-section";
import { ManualTradingSection } from "@/components/manual-trading-section";
import { Badge } from "@/components/ui/badge";
import { AccountStatus } from "@/components/account-status";
import logo from "@assets/logo_1783185010505.png";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "master",    label: "Master Bot", icon: Brain           },
  { id: "analisis",  label: "Analisis",   icon: BarChart2       },
  { id: "trading",   label: "Trading",    icon: Hand            },
  { id: "journal",   label: "Journal",    icon: BookOpen        },
] as const;

type TabId = typeof TABS[number]["id"];

type BotEntry = {
  id:          string;
  label:       string;
  sublabel:    string;
  badge:       string;
  badgeCls:    string;
  icon:        React.ElementType;
  iconCls:     string;
  content:     React.ReactNode;
};

function buildBotList(activeAccount: any): BotEntry[] { return [
  {
    id:       "manual-trader",
    label:    "Manual Trader",
    sublabel: "10 markets · place trades yourself, on demand",
    badge:    "Manual",
    badgeCls: "border-primary/40 text-primary bg-primary/10",
    icon:     Hand,
    iconCls:  "text-primary",
    content:  <ManualTradingSection activeAccount={activeAccount} />,
  },
  {
    id:       "matches-fixer",
    label:    "Matches Fixer",
    sublabel: "20-tick leading digit · ×1.3 martingale",
    badge:    "Live · Matches",
    badgeCls: "border-chart-3/40 text-chart-3 bg-chart-3/10",
    icon:     Zap,
    iconCls:  "text-chart-3",
    content:  <MatchesFixerInline />,
  },
  {
    id:       "reverse-ou",
    label:    "Reverse Over/Under",
    sublabel: "Digit transition · Over 2 & Under 7 entry",
    badge:    "Live · Digits",
    badgeCls: "border-purple-500/40 text-purple-400 bg-purple-500/10",
    icon:     ArrowLeftRight,
    iconCls:  "text-purple-400",
    content:  <ReverseOverUnderInline />,
  },
  {
    id:       "over2-under7-pro",
    label:    "Over 2 Under 7 Pro",
    sublabel: "2+ streak reversal · ×1.8 recovery martingale",
    badge:    "Live · Pro",
    badgeCls: "border-sky-500/40 text-sky-400 bg-sky-500/10",
    icon:     Layers,
    iconCls:  "text-sky-400",
    content:  <Over2Under7ProInline />,
  },
  {
    id:       "under8-over1-pro",
    label:    "Under 8 Over 1 Pro",
    sublabel: "Digit-pair bias · Under 8 & Over 1 entry · ×1.8 recovery",
    badge:    "Live · Pro",
    badgeCls: "border-violet-500/40 text-violet-400 bg-violet-500/10",
    icon:     Layers,
    iconCls:  "text-violet-400",
    content:  <Under8Over1ProInline />,
  },
  {
    id:       "virtual-over-under",
    label:    "Virtual Over Under",
    sublabel: "4-digit streak · all 10 markets · ×2 recovery · no tick skip",
    badge:    "Multi-Market",
    badgeCls: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    icon:     Layers,
    iconCls:  "text-emerald-400",
    content:  <VirtualOverUnderInline />,
  },
]; }

function MasterBotPanel({ activeAccount }: { activeAccount: any }) {
  const [openId, setOpenId] = useState<string | null>("manual-trader");
  const botList = buildBotList(activeAccount);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-3">
      {botList.map((bot) => {
        const isOpen = openId === bot.id;
        const Icon   = bot.icon;
        return (
          <div
            key={bot.id}
            className={`rounded-xl border transition-colors duration-200 overflow-hidden ${
              isOpen ? "border-primary/40 bg-card/60" : "border-border/60 bg-card/30"
            }`}
          >
            {/* ── Accordion header ── */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              onClick={() => toggle(bot.id)}
            >
              <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${
                isOpen ? "border-primary/40 bg-primary/10" : "border-border/50 bg-muted/30"
              }`}>
                <Icon className={`h-4 w-4 ${isOpen ? bot.iconCls : "text-muted-foreground"}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-bold text-foreground leading-none truncate">
                  {bot.label}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">
                  {bot.sublabel}
                </div>
              </div>

              <Badge variant="outline" className={`font-mono text-[9px] uppercase shrink-0 ${bot.badgeCls}`}>
                {bot.badge}
              </Badge>

              <ChevronDown
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* ── Accordion body ── */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-border/30">
                {bot.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TabbedApp() {
  const [active, setActive] = useState<number>(0);
  const touchStartX = useRef<number | null>(null);
  const { data: accounts } = useListAccounts();
  const activeAccount = accounts?.find((a: any) => a.isActive) ?? null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) < 50) return;
    if (delta > 0 && active < TABS.length - 1) setActive((a) => a + 1);
    if (delta < 0 && active > 0) setActive((a) => a - 1);
    touchStartX.current = null;
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden selection:bg-primary/30">
      <header className="h-13 border-b border-border bg-background flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-1.5">
          <img src={logo} alt="RAYZPRO" className="h-7 w-auto" />
          <h1 className="text-base font-mono font-bold text-primary tracking-tight">
            RAYZ<span className="text-foreground">PRO</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <InstallPWAButton />
          <AccountStatus account={activeAccount} />
        </div>
      </header>

      <div className="flex shrink-0 border-b border-border bg-background">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActive(i)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2.5 px-1 font-mono tracking-wider whitespace-nowrap transition-colors flex-1 border-b-2 ${
              active === i
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[9px] sm:text-[11px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      <div
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-in-out"
          style={{
            width: `${TABS.length * 100}%`,
            transform: `translateX(-${active * (100 / TABS.length)}%)`,
          }}
        >
          {TABS.map((tab) => (
            <div
              key={tab.id}
              className="overflow-y-auto h-full"
              style={{ width: `${100 / TABS.length}%` }}
            >
              <div className="mx-auto max-w-7xl p-4 md:p-6 pb-10">
                <PanelContent id={tab.id} activeAccount={activeAccount} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelContent({ id, activeAccount }: { id: TabId; activeAccount: any }) {
  switch (id) {
    case "dashboard": return <Dashboard />;
    case "master":    return <MasterBotPanel activeAccount={activeAccount} />;
    case "analisis":  return <AnalisisToolSection />;
    case "trading":   return <ManualTradingSection activeAccount={activeAccount} />;
    case "journal":   return <Journal />;
  }
}

