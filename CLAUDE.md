# CLAUDE.md — TimeClock

White-label construction time clock by Co-oppetition Consulting. Read
`docs/ARCHITECTURE.md` before structural changes.

## Rules
- All data access goes through `Repository` (`src/lib/data/repository.ts`).
  Never import a database client in pages, actions or services.
- Business rules belong in `src/lib/services/`, and pure calculations in
  `src/lib/domain/` (unit-tested in `domain.test.ts`). Pages stay thin.
- Permissions live in two places that must agree: `src/lib/domain/permissions.ts`
  and `supabase/migrations/*_rls_policies.sql`. Change both together and
  extend `supabase/tests/rls.test.sql`.
- Domain types (`src/lib/domain/types.ts`) mirror the SQL schema. Change both together.
- Punches are never edited. Fix them with a correction punch or a void with a
  reason, and audit every change.
- Every tenant row has `company_id`, and every query is scoped by it.
- White-label: use `bg-brand`, `text-brand` and `bg-accent`, never hard-coded
  brand colours.
- No secrets in the repo. Env var names belong in `.env.example`; values go
  in Vercel and Supabase Vault.
- External integrations stay scaffolded (no live calls) until the owner
  asks to connect one.

## Checks before committing
`npm test`, `npm run typecheck` and `npm run build`. For SQL changes, apply
the migrations to a scratch Postgres and run `supabase/tests/rls.test.sql`.

## Git
Branch per task. Commit prefixes: `app:`, `db:`, `integrations:`, `docs:`.
