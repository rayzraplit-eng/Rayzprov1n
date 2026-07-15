/**
 * OAuth callback page — the redirect_uri registered at api.deriv.com.
 *
 * Deriv redirects here after the user authorises with:
 *   ?code=<auth_code>   ← PKCE flow (new api.deriv.com registration)
 *
 * Two modes depending on how the OAuth flow was started:
 *
 *   POPUP MODE  (window.opener is set)
 *     This page runs in a new tab opened by accounts.tsx via window.open().
 *     On success: signals the opener via postMessage + localStorage, then
 *     closes this tab. If close() is blocked by the browser, shows a
 *     "Close this tab" button immediately — never leaves the user stuck.
 *
 *   SAME-WINDOW MODE  (window.opener is null — popup was blocked)
 *     accounts.tsx fell back to navigating the current window to Deriv.
 *     On success: navigate directly to /accounts. No tab to close.
 */

import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListAccountsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

const DERIV_PKCE_VERIFIER_KEY = "deriv_pkce_verifier";
const DERIV_PKCE_REDIRECT_KEY = "deriv_pkce_redirect";
const DERIV_OAUTH_DONE_KEY    = "deriv_oauth_done";

type Status =
  | { kind: "processing"; progress: string }
  | { kind: "success";    count: number; isPopup: boolean }
  | { kind: "error";      message: string; detail?: string; params?: Record<string, string> };

/** Signal success to the opener tab via both channels. */
function signalOpener(count: number) {
  const payload = JSON.stringify({ count, ts: Date.now() });

  // localStorage storage event — fires in ALL other tabs on the same origin
  try { localStorage.setItem(DERIV_OAUTH_DONE_KEY, payload); } catch { /* noop */ }

  // postMessage — immediate; requires window.open() without "noopener"
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: "deriv_oauth_success", count },
        window.location.origin,
      );
    }
  } catch { /* cross-origin or blocked */ }
}

export default function OAuthCallback() {
  const [status,         setStatus]         = useState<Status>({ kind: "processing", progress: "Reading authorisation response…" });
  const [tabCloseWorked, setTabCloseWorked] = useState(false);
  const [, navigate]                        = useLocation();
  const qc                                  = useQueryClient();
  const ranRef                              = useRef(false);

  // Detect mode immediately (before any async work)
  const isPopup = window.opener !== null;

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params  = new URLSearchParams(window.location.search);
    // Clear the code from the URL bar immediately
    window.history.replaceState({}, "", window.location.pathname);

    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
    const code    = params.get("code");

    // ── Error or empty redirect from Deriv ───────────────────────────────────
    if (!code) {
      const allParams: Record<string, string> = {};
      params.forEach((v, k) => { allParams[k] = v; });
      const paramCount = Object.keys(allParams).length;

      setStatus({
        kind:    "error",
        message: params.get("error_description") ?? params.get("error") ?? "No authorisation code returned by Deriv.",
        detail:  paramCount === 0
          ? "Deriv redirected here without any parameters. Make sure the Redirect URL registered at api.deriv.com matches exactly what is shown on the Accounts page."
          : `Deriv sent ${paramCount} param(s) but no auth code: ${JSON.stringify(allParams)}`,
        params: allParams,
      });
      return;
    }

    // ── PKCE code exchange ────────────────────────────────────────────────────
    const codeVerifier = localStorage.getItem(DERIV_PKCE_VERIFIER_KEY);
    const redirectUri  = localStorage.getItem(DERIV_PKCE_REDIRECT_KEY);
    localStorage.removeItem(DERIV_PKCE_VERIFIER_KEY);
    localStorage.removeItem(DERIV_PKCE_REDIRECT_KEY);

    if (!codeVerifier || !redirectUri) {
      setStatus({
        kind:    "error",
        message: "Session expired — PKCE verifier not found.",
        detail:  "The login session timed out or was opened in a different browser. Please try logging in again from the Accounts page.",
      });
      return;
    }

    setStatus({ kind: "processing", progress: "Exchanging code for tokens…" });

    fetch(`${apiBase}/api/oauth/exchange`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code, codeVerifier, redirectUri }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err?.error ?? `Token exchange failed (HTTP ${res.status})`);
        }
        return res.json() as Promise<{ count: number }>;
      })
      .then(({ count }) => {
        qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });

        setStatus({ kind: "success", count, isPopup });

        if (isPopup) {
          // Signal the opener, then try to close this tab
          signalOpener(count);
          try {
            window.close();
            // If we're still here after a tick, the close was blocked
            setTimeout(() => setTabCloseWorked(false), 300);
          } catch {
            setTabCloseWorked(false);
          }
        } else {
          // Same-window flow: the original accounts page is gone,
          // just navigate back to accounts directly
          setTimeout(() => { window.location.href = "/accounts"; }, 1200);
        }
      })
      .catch((err: Error) => {
        setStatus({ kind: "error", message: err.message });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const callbackUrl = `${window.location.origin}/callback`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">

        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-widest text-primary font-mono">RAYZPRO</span>
        </div>

        {/* Processing */}
        {status.kind === "processing" && (
          <>
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/10 border-b-primary/40 animate-spin [animation-direction:reverse] [animation-duration:1.4s]" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground font-mono">{status.progress}</p>
              <p className="text-xs text-muted-foreground font-mono">Connecting your Deriv account…</p>
            </div>
          </>
        )}

        {/* Success */}
        {status.kind === "success" && (
          <>
            <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center animate-in zoom-in duration-300">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-emerald-400 font-mono">
                {status.count} account{status.count !== 1 ? "s" : ""} connected!
              </p>
              {status.isPopup ? (
                <p className="text-xs text-muted-foreground font-mono">
                  You can close this tab and return to RAYZPRO.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground font-mono">
                  Returning to the app…
                </p>
              )}
            </div>

            {/* Always show buttons — window.close() is often blocked */}
            <div className="flex flex-col gap-2 w-full max-w-[220px]">
              {status.isPopup && (
                <button
                  onClick={() => {
                    try { window.close(); } catch { /* noop */ }
                    // If still here, navigate to accounts as fallback
                    setTimeout(() => { window.location.href = "/accounts"; }, 150);
                  }}
                  className="w-full py-2.5 font-mono text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-none"
                >
                  Close this tab ✕
                </button>
              )}
              <button
                onClick={() => { window.location.href = "/accounts"; }}
                className="w-full py-2 font-mono text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Go to Accounts →
              </button>
            </div>
          </>
        )}

        {/* Error */}
        {status.kind === "error" && (
          <>
            <div className="h-16 w-16 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center">
              <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <div className="w-full max-w-xs space-y-3">
              <p className="text-sm font-semibold text-foreground font-mono text-center">Login failed</p>
              <p className="text-xs text-destructive/80 font-mono leading-relaxed text-center">{status.message}</p>
              {status.detail && (
                <p className="text-[11px] text-muted-foreground font-mono leading-relaxed text-center">{status.detail}</p>
              )}

              {/* Always show the registered redirect URL for debugging */}
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                <p className="text-[10px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
                  Register this exact URL at api.deriv.com:
                </p>
                <code className="text-[11px] font-mono text-foreground/90 break-all select-all leading-relaxed block">
                  {callbackUrl}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(callbackUrl)}
                  className="text-[10px] font-mono text-amber-400 underline underline-offset-2"
                >
                  Copy
                </button>
              </div>

              {/* Show what Deriv actually sent for debugging */}
              {status.params && Object.keys(status.params).length > 0 && (
                <div className="rounded border border-border/40 bg-muted/20 p-3">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
                    Params Deriv sent:
                  </p>
                  {Object.entries(status.params).map(([k, v]) => (
                    <div key={k} className="text-[10px] font-mono flex gap-1">
                      <span className="text-primary shrink-0">{k}:</span>
                      <span className="text-foreground/70 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { window.location.href = "/accounts"; }}
                className="font-mono text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                ← Back to Accounts
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
