# Repository Safety Guide

## Architecture Map
- `admin/frontend`: Vite React admin panel for store/admin operations, Shadi tabs, Shara tabs, and project integrations.
- `store/backend`: Node/Express store API, admin routes, order/accounting/payment logic, SQL schema and migrations.
- `store/frontend`: React customer storefront.
- `shadi/backend`: TypeScript backend for Shadi services and transactions.
- `shadi/frontend`: Vite React public Shadi site.
- `shara`: FastAPI Shara service and static/admin assets.
- `shared`: shared frontend layout components used across apps.

## Before Editing
- Read the directly affected files before changing them.
- Trace dependencies before touching shared components, hooks, styles, API clients, backend routes, schemas, or migrations.
- Search all usages with `rg` before changing shared names, props, routes, request/response shapes, CSS classes, helpers, or database columns.
- Reproduce or understand the bug first, then add or update the narrowest meaningful regression test before or alongside the fix.

## Edit Scope
- Make the smallest change that solves the task.
- Do not refactor, split large files, rename APIs, or clean unrelated code unless the task explicitly requires it.
- Do not intentionally change runtime website behavior when the task is only safety, tests, docs, or deployment.
- Keep admin/frontend API calls, backend routes, permission rules, SQL schema, migrations, and frontend state expectations synchronized.

## Store Invariants
- Preserve order status behavior unless the task explicitly changes it.
- Preserve accounting side effects for delivered, cancelled, paid, pending, and processing orders.
- Delivered accounting must be idempotent: do not duplicate supplier journal entries, client invoices, client payments, delivery vouchers, balances, stock movements, or customer links.
- Reversals must restore expected supplier/client balances and avoid deleting unrelated manual records.
- Preserve stock behavior for product variants and grouped line items.
- Preserve customer source behavior: manual, store, and mixed clients must not be reclassified accidentally.

## Security And Data
- Never commit `.env`, `.env.local`, credentials, keys, tokens, production database dumps, backups, uploads, generated PDFs, logs, caches, or runtime data.
- Example env files may contain variable names and safe placeholders only.
- Do not print private keys or tokens.
- Do not run destructive database cleanup during development unless the user explicitly asks for it.

## Database And cPanel
- For schema changes, update the migration, `store/backend/sql/schema.sql`, and `store/backend/sql/update-existing-db.sql` together.
- Add smoke tests for schema/migration consistency when feasible.
- Keep cPanel deploy scripts excluding dumps, uploads, dependencies, builds, and local runtime data unless a deploy artifact explicitly needs generated output.
- Do not declare deployment success from a reachable port alone; verify the relevant build, route, data flow, or UI behavior.

## Git In This Dirty Repo
- Do not use `git add -A`, `git add .`, or `git add --all`.
- Stage only explicit reviewed files or safe path groups.
- Preserve pre-existing dirty files, ignored local data, uploads, caches, and generated artifacts.
- Inspect `git diff --cached --stat`, `git diff --cached --check`, and staged file names before committing.
- Keep `main` unchanged unless the user explicitly asks to move it.

## Validation Commands
- Admin frontend: `cd admin/frontend && npm run build`
- Store backend: `cd store/backend && npm test && npm run build`
- Store frontend: `cd store/frontend && npm run build && CI=true npm test -- --watchAll=false`
- Shadi frontend: `cd shadi/frontend && npm run build && npm run lint`
- Shadi backend: `cd shadi/backend && npm run build`
- If a command is missing or fails because configuration is absent, report it exactly.

## Completion Report
- Report changed files, test/build commands run, pass/fail status, and known limitations.
- Mention any skipped validation and why.
- For data-sensitive work, state what was intentionally excluded.
