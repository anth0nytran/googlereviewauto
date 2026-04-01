# Google Reviews Automation — Agent Instructions

## Project Context

This is a multi-tenant Google Reviews automation system for QuickLaunchWeb (Anthony's agency). Read `PRD.md` for the full product spec, schema, and architecture.

## Tech Stack

- **Framework:** Next.js (App Router) on Vercel
- **Database:** Supabase (Postgres + RLS)
  - Project ID: `ocmpzezhdelmiivgazte`
  - URL: `https://ocmpzezhdelmiivgazte.supabase.co`
- **Email:** Resend
- **Sheets:** Google Sheets API (service account)
- **Auth (admin):** .env-based username/password (same pattern as /demo route on existing projects)

## Build Status

Check `PRD.md` → "Build Phases" section for current progress. Update checkboxes as you complete items.

## Key Conventions

- Use Supabase MCP tools for all database operations (migrations, queries)
- Use `apply_migration` for DDL, `execute_sql` for queries
- All tables use UUIDs as primary keys via `gen_random_uuid()`
- RLS policies should scope data per `client_id` (future-proofing for client auth)
- API routes use Next.js App Router (`src/app/api/...`)
- Keep it simple — this is an MVP. Don't over-engineer

## Supabase MCP

The Supabase MCP server is configured. Use these tools:
- `mcp__supabase__apply_migration` — create tables, indexes, policies
- `mcp__supabase__execute_sql` — run queries
- `mcp__supabase__list_tables` — inspect schema
- Project ID for all calls: `ocmpzezhdelmiivgazte`

## File Structure

See `PRD.md` → "File Structure" section. Follow it when creating files.

## Environment Variables

See `PRD.md` → "Environment Variables" section. The user will set these up. Don't hardcode secrets.
