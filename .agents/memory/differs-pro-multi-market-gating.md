---
name: Multi-market bot kill-switch pattern
description: How to synchronously gate new trade entries across N independent per-symbol hooks (e.g. max-profit stop) without render-lag bugs
---

When a bot runs one independent per-symbol hook instance for each of the fixed volatility
symbols (pattern used by `use-master-trader.ts`, `use-virtual-over-under.ts`,
`use-differs-pro.ts`, etc.) and needs a global stop condition — such as "stop all new
entries once combined profit across all markets hits a target" — deriving the gate from
React state (e.g. `useState` + a `useEffect` snapshot of the aggregate) introduces a
one-render lag: other markets can still fire a new entry in the window between crossing
the target and the aggregate state re-rendering.

**Fix:** create a single `useRef` in the aggregator hook and pass the *same ref* into
every per-symbol hook call. Each symbol mutates `sharedRef.current` synchronously the
instant it settles a trade, and checks `sharedRef.current` against the target at the top
of its own tick-processing effect, before any entry logic (including recovery/resume
entries). Because JS is single-threaded, this makes the gate effectively instantaneous
across all symbols — no render-cycle dependency. Keep a separate React-state aggregate
(recomputed from each symbol's own state) purely for UI display; never use it for gating.

**Why:** Confirmed via code review on the Differs Pro bot — the state+effect snapshot
approach failed review twice for a "some markets can still open a trade after the
profit target is crossed" gap; switching to a shared ref passed into each symbol hook
passed review on the third pass.

**How to apply:** Any new "Pro" multi-market bot with a global max-profit/stop-loss
target across N per-symbol hook instances should use this shared-ref pattern from the
start, rather than a `useState` aggregate + `useEffect` sync.
