---
  name: rebrand-touchpoints
  description: Where TradeHub->RAYZ PRO branding lives; use as a checklist for future rebrands of this app.
  ---

  Branding touchpoints for the tradehub artifact's app name/logo, so a future rename doesn't miss spots:
  - Header text/logo: TabbedApp.tsx (main header) AND AppShell.tsx (sub-page header) — two separate header components, both need updating.
  - index.html: <title> and favicon <link>.
  - vite.config.ts: VitePWA manifest (id, name, short_name, icons) and workbox runtimeCaching cacheName strings.
  - artifact.toml title — must go through verifyAndReplaceArtifactToml, never edit directly.
  - replit.md project overview line.

  **Why:** these are scattered across ~6 files with no single source of truth for the app name; missing one leaves stale branding visible in the browser tab, PWA install prompt, or a secondary page header.
  