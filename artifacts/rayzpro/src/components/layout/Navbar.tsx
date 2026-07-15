import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "DASHBOARD" },
    { href: "/master-bot", label: "MASTER_BOT" },
    { href: "/analysis", label: "ANALYSIS" },
    { href: "/trading", label: "TRADING" },
    { href: "/journal", label: "JOURNAL" },
  ];

  const rightLinks = [
    { href: "/bots", label: "BOTS" },
    { href: "/accounts", label: "ACCOUNTS" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4">
        <div className="mr-8 flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-mono text-xl font-bold text-primary tracking-tighter">RAYZPRO</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "transition-colors hover:text-foreground/80 font-mono tracking-tight",
                  location === link.href ? "text-foreground border-b-2 border-primary pb-[1.1rem] pt-4" : "text-foreground/60"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center space-x-6">
            <div className="h-4 w-px bg-border hidden md:block"></div>
            {rightLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "transition-colors hover:text-foreground/80 font-mono tracking-tight text-sm",
                  location === link.href ? "text-primary" : "text-foreground/60"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
