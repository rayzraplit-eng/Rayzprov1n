---
name: Stale process port conflicts on artifact workflows
description: EADDRINUSE on artifact-managed workflows after removing manually-created duplicate workflows
---

Artifact-managed workflows (e.g. "artifacts/<name>: <service>") bind to fixed ports. If a manually-created duplicate workflow was ever started for the same service, its process can keep holding the port even after the duplicate workflow entry is removed via removeWorkflow — the workflow removal does not guarantee the underlying process is killed.

**Why:** removeWorkflow only removes the workflow config/registration; it does not necessarily SIGKILL a still-running child process, especially if it was already detached or the tracking got out of sync from manual creation.

**How to apply:** If an artifact-managed workflow fails to restart with EADDRINUSE, run `ps aux | grep -E "node|vite|pnpm"` (or `lsof -i:<port>`) to find lingering processes bound to that port, `kill -9` them, then retry `restart_workflow`. Don't just keep retrying restart_workflow — it won't fix a stale process holding the port.
