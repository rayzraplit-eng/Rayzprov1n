import { Link } from "wouter";
import { LogIn, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccountStatus({ account }: { account: any }) {
  if (account) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 border border-border">
        <div
          className={`h-2 w-2 rounded-full shrink-0 ${
            account.accountType === "real" ? "bg-primary" : "bg-chart-3"
          }`}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-mono font-medium leading-none truncate">
            {account.balance.toLocaleString("en-US", { style: "currency", currency: account.currency })}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground leading-none mt-0.5 truncate">
            {account.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <a href="https://deriv.com/signup" target="_blank" rel="noopener noreferrer">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 gap-1 font-mono text-[10px] rounded-none border-border/60 text-muted-foreground hover:text-foreground"
        >
          <UserPlus className="h-3 w-3" />
          SIGN UP
        </Button>
      </a>
      <Link href="/accounts">
        <Button
          size="sm"
          className="h-7 px-2.5 gap-1 font-mono text-[10px] rounded-none"
        >
          <LogIn className="h-3 w-3" />
          LOGIN
        </Button>
      </Link>
    </div>
  );
}
