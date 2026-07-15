---
name: Master Trader bot
description: How the Master Trader analysis engine works and key constraints for extending it
---

Only one bot in the DB ("Master Trader"). Strategy lives entirely in the browser via WebSocket ticks.

**Hook constraint:** React hook rules prevent calling hooks in a loop. `useMasterTrader` calls `useDerivTicks` individually for each of the 7 fixed symbols (R_10, R_25, R_50, R_75, R_100, 1HZ10V, 1HZ100V). Adding a new symbol requires adding a new explicit hook call.

**Strategy (in `use-master-trader.ts`):**
- PRIMARY: If market has ≥75% over (digits ≥5) in last 100 ticks → wait for 2+ consecutive digits ≤4 then current ≥5 → OVER4 signal
- PRIMARY: If market has ≥75% under (digits ≤4) in last 100 ticks → wait for 2+ consecutive digits ≥5 then current ≤4 → UNDER5 signal
- FALLBACK: If market has ≥75% even → wait for 3+ odd streak then current even → EVEN signal
- FALLBACK: If market has ≥75% odd → wait for 3+ even streak then current odd → ODD signal

**Why:** Reversion-to-bias strategy: pick a market with strong statistical bias, wait for a brief streak against the bias as the entry trigger.

**How to apply:** Signal detection runs on every tick update via `useMemo`. Signals appear/disappear live as conditions are met/broken. The "best signal" is the one with highest confidence (bias %).
