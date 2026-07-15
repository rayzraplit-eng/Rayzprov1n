---
name: Workspace frontend slug
description: The frontend package lives in artifacts/tradehub but the artifact is still registered under the rayzpro artifact ID
---

The React frontend package is `@workspace/tradehub` located at `artifacts/tradehub/`. However, the artifact system registration kept the original `artifacts/rayzpro` artifact ID (id field is immutable). The `artifacts/rayzpro/.replit-artifact/artifact.toml` was updated via `verifyAndReplaceArtifactToml` to point its dev/build commands at `@workspace/tradehub`.

**Why:** `createArtifact` would have failed with DUPLICATE_PREVIEW_PATH since `/` was already claimed by rayzpro. Rewiring the existing artifact's toml was the only viable path without destroying and recreating the artifact registration.

**How to apply:** When filtering pnpm commands for the frontend, always use `--filter @workspace/tradehub`. The managed workflow name remains `artifacts/rayzpro: web`. Do not create a second artifact at `/`.
