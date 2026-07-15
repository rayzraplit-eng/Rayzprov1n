import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2 } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPWAButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) setInstalled(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (installed) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] border border-primary/40 bg-primary/10 text-primary">
        <CheckCircle2 className="h-3 w-3" />
        Installed
      </div>
    );
  }

  if (!deferred) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 font-mono text-xs gap-1.5 border-primary/50 text-primary hover:bg-primary/10"
      onClick={async () => {
        try {
          await deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice.outcome === "accepted") setInstalled(true);
          setDeferred(null);
        } catch {
          /* ignore */
        }
      }}
      data-testid="button-install-pwa"
    >
      <Download className="h-3 w-3" />
      Install App
    </Button>
  );
}
