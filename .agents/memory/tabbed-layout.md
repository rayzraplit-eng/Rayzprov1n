---
name: Swipeable tab layout
description: How the main TradeHub app layout is structured as 5 horizontal swipeable panels
---

Route `/` renders `TabbedApp` (not `AppShell`). Sub-pages (Accounts, Bots, Tools) render inside `AppShell` which shows a back-arrow header.

**Why:** User requested the 5 main sections (Dashboard, Free Bots, Analisis, Trading, Journal) be horizontally slideable panels rather than sidebar-routed pages.

**How to apply:** When adding a new top-level section, add a tab entry to `TABS` in `TabbedApp.tsx` and a matching `case` in `PanelContent`. Do NOT add a new route for main sections — only sub-pages (detail views, tool sub-pages) get routes. All 5 panels are always mounted so WebSocket tick state is preserved across tab switches.
