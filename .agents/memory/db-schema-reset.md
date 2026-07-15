---
name: DB schema reset on import
description: How to handle drizzle-kit push interactive prompts when column names change significantly between schema versions
---

When importing a project whose DB schema has different column names than what's already in Postgres, `drizzle-kit push` blocks on interactive prompts asking whether columns were renamed or created new.

**Why:** drizzle-kit detects the mismatch and requires human confirmation to avoid accidental data loss.

**How to apply:** If there is no real data to preserve (dev/import scenario), drop all tables via `psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS trades CASCADE; DROP TABLE IF EXISTS bots CASCADE; DROP TABLE IF EXISTS accounts CASCADE;"` before running push. This lets drizzle-kit create the tables fresh with no ambiguity.

For production with real data: handle column renames manually via `ALTER TABLE` SQL before running push, so drizzle sees the columns already in the expected state.
