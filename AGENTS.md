# Agent Guidelines for Documenso

## Build/Test/Lint Commands

- `npm run build` - Build all packages
- `npm run lint` - Lint all packages
- `npm run lint:fix` - Auto-fix linting issues
- `npm run test:e2e` - Run E2E tests with Playwright
- `npm run test:dev -w @documenso/app-tests` - Run single E2E test in dev mode
- `npm run test-ui:dev -w @documenso/app-tests` - Run E2E tests with UI
- `npm run format` - Format code with Biome
- `npm run dev` - Start development server for Remix app

**Important:** Do not run `npm run build` to verify changes unless explicitly asked. Builds take a long time (~2 minutes). Use `npx tsc --noEmit` for type checking specific packages if needed.

## Code Style Guidelines

- Use TypeScript for all code; prefer `type` over `interface`
- Use functional components with `const Component = () => {}`
- Never use classes; prefer functional/declarative patterns
- Use descriptive variable names with auxiliary verbs (isLoading, hasError)
- Directory names: lowercase with dashes (auth-wizard)
- Use named exports for components
- Never use 'use client' directive
- Never use 1-line if statements
- Structure files: exported component, subcomponents, helpers, static content, types

## Error Handling & Validation

- Use custom AppError class when throwing errors
- When catching errors on the frontend use `const error = AppError.parse(error)` to get the error code
- Use early returns and guard clauses
- Use Zod for form validation and react-hook-form for forms
- Use error boundaries for unexpected errors

## UI & Styling

- Use Shadcn UI, Radix, and Tailwind CSS with mobile-first approach
- Use `<Form>` `<FormItem>` elements with fieldset having `:disabled` attribute when loading
- Use Lucide icons with longhand names (HomeIcon vs Home)

## TRPC Routes

- Each route in own file: `routers/teams/create-team.ts`
- Associated types file: `routers/teams/create-team.types.ts`
- Request/response schemas: `Z[RouteName]RequestSchema`, `Z[RouteName]ResponseSchema`
- Only use GET and POST methods in OpenAPI meta
- Deconstruct input argument on its own line
- Prefer route names such as get/getMany/find/create/update/delete
- "create" routes request schema should have the ID and data in the top level
- "update" routes request schema should have the ID in the top level and the data in a nested "data" object

## Translations & Remix

- Use `<Trans>string</Trans>` for JSX translations from `@lingui/react/macro`
- Use `t\`string\`` macro for TypeScript translations
- Use `(params: Route.Params)` and `(loaderData: Route.LoaderData)` for routes
- Directly return data from loaders, don't use `json()`
- Use `superLoaderJson` when sending complex data through loaders such as dates or prisma decimals

<!-- graphify-code-memory:begin -->
## Code memory (Graphify) — use this before grepping

This repo is registered for Graphify AST code-memory (tier **p2**).
There is no dedicated HTTP MCP yet — use the offline / S3 path below (MCP is optional later).

### Without MCP (primary for this tier)

1. **In-repo:** read `graphify-out/GRAPH_REPORT.md` when present.
2. **S3:**
   ```bash
   aws s3 cp s3://ivx-graphify-graphs/graphs/documenso/GRAPH_REPORT.md graphify-out/GRAPH_REPORT.md
   aws s3 cp s3://ivx-graphify-graphs/graphs/documenso/graph.json graphify-out/graph.json   # optional
   ```
3. **Local rebuild:**
   ```bash
   uv tool install graphifyy
   graphify update . --no-cluster && graphify cluster-only . --no-viz --no-label
   ```
4. **Last resort:** normal `rg` / IDE search / vector RAG.

| | |
|---|---|
| **In-repo** | `graphify-out/GRAPH_REPORT.md` |
| **S3 graph** | `s3://ivx-graphify-graphs/graphs/documenso/graph.json` |
| **S3 report** | `s3://ivx-graphify-graphs/graphs/documenso/GRAPH_REPORT.md` |
| **Future MCP** | `https://graphify-documenso.intelli-verse-x.ai/mcp` (not deployed for this tier yet) |

### Ops

- CI: `.github/workflows/graphify.yml` (if present) dispatches org extract
- Org playbook: `intelli-verse-kube-infra/.agents/skills/graphify-code-memory/SKILL.md`
- Enable MCP later via `serve_mcp: true` in `graphify/repos.yaml` (kube-infra)
<!-- graphify-code-memory:end -->
