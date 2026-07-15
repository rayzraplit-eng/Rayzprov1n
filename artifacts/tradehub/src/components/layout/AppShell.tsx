import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useListAccounts } from "@workspace/api-client-react";
import { InstallPWAButton } from "@/components/install-pwa-button";
import { AccountStatus } from "@/components/account-status";
import logo from "@assets/logo_1783185010505.png";

function SubHeader() {
  const { data: accounts } = useListAccounts();
  const activeAccount = accounts?.find((a) => a.isActive);

  return (
    <header className="h-13 border-b border-border bg-background flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-mono text-xs transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </Link>
        <span className="text-border">|</span>
        <div className="flex items-center gap-1.5">
          <img src={logo} alt="RAYZPRO" className="h-6 w-auto" />
          <h1 className="text-sm font-mono font-bold text-primary tracking-tight">
            RAYZ<span className="text-foreground">PRO</span>
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <InstallPWAButton />
        <AccountStatus account={activeAccount} />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden selection:bg-primary/30">
      <SubHeader />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
