/**
 * Accounts page — connect Deriv accounts via OAuth (new PKCE flow) or API token.
 *
 * Deriv uses TWO separate ID systems:
 *   • OAuth client_id  (alphanumeric, e.g. 33JNdPHf5VZwRTrlSAsG7)
 *     → used only in the OAuth authorize URL (new developers.deriv.com registration)
 *   • WebSocket app_id (numeric, e.g. 36544)
 *     → required for all wss://ws.derivws.com connections (market data, trading)
 *     → register at https://app.deriv.com/account/apps
 *
 * Login flow (new-tab OAuth):
 *   1. User clicks "LOGIN WITH DERIV" — opens Deriv's auth page in a new tab.
 *      (Opening in a new tab avoids X-Frame-Options issues when inside the
 *       Replit preview iframe, and works on mobile too.)
 *   2. User authorises on Deriv.
 *   3. Deriv redirects the new tab to /callback?code=<auth_code>.
 *   4. The callback page exchanges the code, saves accounts, writes
 *      "deriv_oauth_done" to localStorage, then closes the tab.
 *   5. This page detects the localStorage change via the `storage` event
 *      and refreshes the account list — no page reload needed.
 */

import {
  useListAccounts, useConnectAccount, useUpdateAccount,
  useDisconnectAccount, useRefreshAccountBalance,
  getListAccountsQueryKey, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, Trash2, CheckCircle2, Clock, AlertCircle,
  LogIn, ExternalLink, KeyRound, RefreshCw, Loader2, Copy, Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Deriv OAuth client_id (alphanumeric) — from developers.deriv.com */
const DERIV_OAUTH_CLIENT_ID =
  (import.meta.env.VITE_DERIV_APP_ID as string | undefined) ?? "";

/** localStorage keys — shared with the callback page */
export const DERIV_PKCE_VERIFIER_KEY = "deriv_pkce_verifier";
export const DERIV_PKCE_REDIRECT_KEY = "deriv_pkce_redirect";
export const DERIV_PKCE_STATE_KEY    = "deriv_pkce_state";
/** Written by the callback page to signal success to any open tab */
export const DERIV_OAUTH_DONE_KEY    = "deriv_oauth_done";

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateVerifier(): string {
  const arr = new Uint8Array(48);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function deriveChallenge(verifier: string): Promise<string> {
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Callback URL helper ───────────────────────────────────────────────────────

function getCallbackUrl(): string {
  // origin + base + /callback — must match exactly what is registered
  // in the Deriv developer portal (https://developers.deriv.com).
  // BASE_URL is "/" in production (root deploy) but may differ in sub-path deploys.
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/callback`;
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const connectSchema = z.object({
  label:    z.string().min(1, "Label is required"),
  apiToken: z.string().min(8, "API token must be at least 8 characters"),
});

// ── Main component ────────────────────────────────────────────────────────────

export default function Accounts() {
  const { data: accounts, isLoading } = useListAccounts();
  const connectAccount                = useConnectAccount();
  const updateAccount                 = useUpdateAccount();
  const disconnectAccount             = useDisconnectAccount();
  const refreshBalance                = useRefreshAccountBalance();
  const queryClient                   = useQueryClient();
  const { toast }                     = useToast();

  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [oauthPending,  setOauthPending]  = useState(false);
  const [copied,        setCopied]        = useState(false);

  const form = useForm<z.infer<typeof connectSchema>>({
    resolver: zodResolver(connectSchema),
    defaultValues: { label: "", apiToken: "" },
  });

  // ── Cross-tab OAuth signal ──────────────────────────────────────────────────
  // The callback page writes `deriv_oauth_done` to localStorage after it saves
  // accounts. The `storage` event fires in ALL other tabs on the same origin,
  // so we refresh the account list automatically when the tab closes.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DERIV_OAUTH_DONE_KEY || !e.newValue) return;
      localStorage.removeItem(DERIV_OAUTH_DONE_KEY);
      setOauthPending(false);
      try {
        const { count } = JSON.parse(e.newValue) as { count: number };
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: `✓ ${count} account${count !== 1 ? "s" : ""} connected!` });
      } catch {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      }
    };

    // Also listen for postMessage from the callback popup
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "deriv_oauth_success") return;
      setOauthPending(false);
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: `✓ ${(e.data.count as number)} account${(e.data.count as number) !== 1 ? "s" : ""} connected!` });
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
    };
  }, [queryClient, toast]);

  // ── OAuth login ────────────────────────────────────────────────────────────
  const loginWithDeriv = async () => {
    if (!DERIV_OAUTH_CLIENT_ID) {
      toast({
        title:       "OAuth not configured",
        description: "Set VITE_DERIV_APP_ID to your Deriv client_id from developers.deriv.com",
        variant:     "destructive",
      });
      return;
    }

    const verifier    = generateVerifier();
    const challenge   = await deriveChallenge(verifier);
    const state       = generateVerifier().slice(0, 32); // CSRF token
    const redirectUri = getCallbackUrl();

    localStorage.setItem(DERIV_PKCE_VERIFIER_KEY, verifier);
    localStorage.setItem(DERIV_PKCE_REDIRECT_KEY,  redirectUri);
    localStorage.setItem(DERIV_PKCE_STATE_KEY,     state);

    // New Deriv API endpoint (auth.deriv.com) — required for apps registered
    // at api.deriv.com. The old oauth.deriv.com endpoint is legacy-only.
    const url =
      `https://auth.deriv.com/oauth2/auth` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(DERIV_OAUTH_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=trade` +
      `&state=${encodeURIComponent(state)}` +
      `&code_challenge=${encodeURIComponent(challenge)}` +
      `&code_challenge_method=S256`;

    // Open in a new tab — avoids X-Frame-Options issues inside Replit preview
    // iframe, and works on mobile too. The callback page signals back via:
    //   • localStorage storage event (always works — survives tab close)
    //   • postMessage to window.opener (immediate — requires no "noopener")
    // NOTE: do NOT pass "noopener" — it severs window.opener so postMessage
    //       from the callback tab will never reach this page.
    const tab = window.open(url, "_blank");
    if (!tab) {
      // Popup blocked — navigate current window
      window.location.href = url;
      return;
    }
    setOauthPending(true);
    // Auto-cancel the pending state after 5 minutes in case the user closed
    // the tab without completing the OAuth flow.
    setTimeout(() => setOauthPending(false), 5 * 60 * 1000);
  };

  // ── Token form submit ──────────────────────────────────────────────────────
  const onSubmit = (data: z.infer<typeof connectSchema>) => {
    connectAccount.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Account connected successfully" });
        setIsConnectOpen(false);
        form.reset();
      },
      onError: (error: any) => {
        toast({
          title:       "Failed to connect account",
          description: error.message ?? "Unknown error",
          variant:     "destructive",
        });
      },
    });
  };

  const handleSetActive = (id: number) => {
    updateAccount.mutate({ id, data: { isActive: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Active account updated" });
      },
    });
  };

  const handleDisconnect = (id: number) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;
    disconnectAccount.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Account disconnected" });
      },
    });
  };

  const handleRefreshBalance = (id: number) => {
    refreshBalance.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Balance updated" });
      },
      onError: (error: any) => {
        toast({
          title:       "Failed to refresh balance",
          description: error.message ?? "Unknown error",
          variant:     "destructive",
        });
      },
    });
  };

  const handleCopyCallback = () => {
    navigator.clipboard.writeText(getCallbackUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const callbackUrl = getCallbackUrl();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
          <Wallet className="h-8 w-8 text-primary" />
          ACCOUNTS
        </h1>

        <div className="flex items-center gap-2">
          {/* Login with Deriv — new PKCE OAuth flow */}
          <Button
            variant="default"
            disabled={oauthPending}
            className="font-mono gap-2 rounded-none rounded-br-lg rounded-tl-lg shadow-[2px_2px_0px_0px_hsl(var(--primary-border))] border border-primary hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_0px_hsl(var(--primary-border))] transition-all"
            onClick={loginWithDeriv}
          >
            {oauthPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> WAITING…</>
              : <><LogIn className="h-4 w-4" /> LOGIN WITH DERIV</>
            }
          </Button>

          {/* Manual API token */}
          <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="font-mono gap-2 rounded-none rounded-br-lg rounded-tl-lg border-border/60 text-muted-foreground hover:text-foreground"
              >
                <KeyRound className="h-4 w-4" />
                API TOKEN
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-card/95 backdrop-blur-xl rounded-none border-l-4 border-l-primary">
              <DialogHeader>
                <DialogTitle className="font-mono font-bold uppercase tracking-wider">Connect via API Token</DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  Go to{" "}
                  <a
                    href="https://app.deriv.com/account/api-token"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5"
                  >
                    app.deriv.com/account/api-token <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                  {" "}and create a token with <strong>Read</strong> + <strong>Trade</strong> scopes.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Account Label</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Main Real, Demo Tests" className="font-mono rounded-none bg-background/50" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">API Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" className="font-mono rounded-none bg-background/50" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={connectAccount.isPending} className="w-full font-mono rounded-none mt-4">
                    {connectAccount.isPending ? "CONNECTING…" : "CONNECT"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── OAuth setup card ── */}
      <Card className="border-primary/30 bg-primary/5 rounded-none border-l-4 border-l-primary">
        <CardContent className="py-4 px-4 space-y-3">

          {/* Title row */}
          <div className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-primary shrink-0" />
            <p className="font-mono text-sm font-semibold text-foreground">
              Deriv OAuth Setup
            </p>
            {DERIV_OAUTH_CLIENT_ID && (
              <Badge variant="outline" className="font-mono text-[9px] border-primary/40 text-primary ml-auto">
                client_id: {DERIV_OAUTH_CLIENT_ID}
              </Badge>
            )}
          </div>

          {/* Steps */}
          <ol className="font-mono text-xs text-muted-foreground space-y-1 list-none pl-0">
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">1.</span>
              <span>
                Go to{" "}
                <a
                  href="https://api.deriv.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-0.5"
                >
                  api.deriv.com <ExternalLink className="h-2.5 w-2.5" />
                </a>
                {" "}→ Register App → set OAuth redirect URL
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">2.</span>
              <span>
                Set the <strong className="text-foreground">Redirect URL</strong> to this exact address
                (copy it, paste it verbatim — no trailing slash):
              </span>
            </li>
          </ol>

          {/* Callback URL — the key info the user needs */}
          <div className="flex items-center gap-2 bg-background/70 border border-primary/30 rounded px-3 py-2">
            <code className="font-mono text-xs text-foreground flex-1 select-all break-all">
              {callbackUrl}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={handleCopyCallback}
              title="Copy to clipboard"
            >
              {copied
                ? <Check className="h-3.5 w-3.5 text-primary" />
                : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </Button>
          </div>

          <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
            After registering, copy your alphanumeric <strong className="text-foreground/70">client_id</strong> and
            save it as the <code className="bg-muted/50 px-1 rounded">VITE_DERIV_APP_ID</code> secret in Replit.
            {oauthPending && (
              <span className="text-primary ml-1 font-medium">
                ↗ Waiting for you to complete login in the new tab…
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ── Account cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
            <Skeleton className="h-48 w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
          </>
        ) : accounts && accounts.length > 0 ? (
          accounts.map((account) => (
            <Card
              key={account.id}
              className={`rounded-none border-l-4 relative overflow-hidden transition-all ${
                account.isActive
                  ? "border-l-primary bg-primary/5 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.1)] border-t border-r border-b border-primary/20"
                  : "border-l-muted-foreground/30 bg-card/50 border-t border-r border-b border-border/50"
              }`}
            >
              {account.isActive && (
                <div className="absolute top-0 right-0 p-2">
                  <Badge variant="default" className="font-mono text-[10px] rounded-none">ACTIVE</Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-lg flex items-center gap-2">{account.label}</CardTitle>
                <CardDescription className="font-mono text-xs flex items-center gap-2">
                  {account.loginid}
                  <Badge variant="outline" className="font-mono text-[9px] rounded-none h-4 px-1 py-0 border-muted-foreground/30">
                    {account.accountType}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-mono font-bold tracking-tight text-foreground">
                    {account.balance.toLocaleString("en-US", {
                      style: "currency", currency: account.currency,
                    })}
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary rounded-none shrink-0"
                    onClick={() => handleRefreshBalance(account.id)}
                    disabled={refreshBalance.isPending && refreshBalance.variables?.id === account.id}
                    title="Refresh balance"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${
                      refreshBalance.isPending && refreshBalance.variables?.id === account.id
                        ? "animate-spin" : ""
                    }`} />
                  </Button>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mt-2">
                  <Clock className="h-3 w-3" />
                  Connected {formatDistanceToNow(new Date(account.connectedAt))} ago
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-4 border-t border-border/50 bg-background/30 px-4 py-3">
                <Button
                  variant="ghost" size="sm"
                  className={`font-mono text-xs rounded-none h-8 ${
                    account.isActive ? "text-primary/50 cursor-not-allowed" : "hover:text-primary"
                  }`}
                  onClick={() => handleSetActive(account.id)}
                  disabled={account.isActive || updateAccount.isPending}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  SET ACTIVE
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 font-mono text-xs rounded-none h-8"
                  onClick={() => handleDisconnect(account.id)}
                  disabled={disconnectAccount.isPending || account.isActive}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border border-dashed border-border/50 rounded-none bg-card/30 gap-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <h3 className="font-mono text-lg font-bold text-muted-foreground">No accounts connected</h3>
              <p className="font-mono text-xs text-muted-foreground/70 mt-1 max-w-sm">
                Use <strong>LOGIN WITH DERIV</strong> for one-click setup, or paste an API token manually.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button className="font-mono gap-2" onClick={loginWithDeriv} disabled={oauthPending}>
                {oauthPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Waiting…</>
                  : <><LogIn className="h-4 w-4" /> Login with Deriv</>
                }
              </Button>
              <Button variant="outline" className="font-mono gap-2" onClick={() => setIsConnectOpen(true)}>
                <KeyRound className="h-4 w-4" /> Use API Token
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
