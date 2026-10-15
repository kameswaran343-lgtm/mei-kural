# Kural Saatchi

A source-grounded Tamil quotation verifier that compares claims against the Tirukkural and abstains when it cannot prove a match.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/kural-saatchi run dev` — run the web app
- `pnpm --filter @workspace/kural-saatchi run typecheck` — typecheck the web app
- `pnpm --filter @workspace/api-server run typecheck` — typecheck the API
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- No database is required; canonical corpus data is stored in `artifacts/api-server/data/`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + generated OpenAPI/Zod contracts
- Data: validated JSON corpus and configured decoys; no database
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Kural Saatchi

- Purpose: source-grounded Tamil quotation verification for the Tirukkural, with quote guarding, corpus search, browse, and benchmark tools.
- Run the API with `pnpm --filter @workspace/api-server run dev` and the app with `pnpm --filter @workspace/kural-saatchi run dev`.
- Canonical data is JSON under `artifacts/api-server/data/`; no database is used. OpenAPI contracts are defined in `lib/api-spec/openapi.yaml`; rerun codegen after edits.
- Verification verdicts must remain deterministic and corpus-backed. Fuzzy similarity is only a candidate-ranking aid; do not use it alone to declare a quote authentic.
- Only output canonical couplet text from the validated source corpus. On invalid or missing full-corpus data, use only the explicit seed fallback and show its demo warning.
- Keep configured decoys limited to the works and lines supplied for this app. Do not invent adhikaram titles.
