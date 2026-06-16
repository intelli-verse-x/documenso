# Intelliverse + Toba Tech Documenso

End-to-end runbook for deploying a deeply-branded, multi-tenant Documenso
e-signature platform and loading the contract templates.

Two branded hostnames are served from one deployment:

- `https://contracts.intelli-verse-x.ai` -> Intelliverse
- `https://contracts.toba-tech.ai` -> Toba Tech

> **Legal disclaimer:** the contract templates in `contracts/` are AI-drafted
> starting points, verified against current public US/India standards via
> automated research. They are NOT legal advice and NOT certified legally
> binding. Have each reviewed and approved by a licensed attorney in the US and
> India before any real use. See `contracts/README.md`.

## What's in here

| Path | Purpose |
| --- | --- |
| `build-and-push-image.sh` | Manual/break-glass build + push of the branded image to ECR |
| `scripts/setup-orgs.ts` | Create Intelliverse + Toba orgs/teams + per-tenant branding |
| `scripts/build-pdfs.ts` | Render contract markdown -> PDF |
| `scripts/load-templates.ts` | Load PDFs as Documenso templates via the v2 API |
| `contracts/` | Contract markdown + manifest |

Branding code changes live in the app source:
`apps/remix/app/utils/branding/`, `apps/remix/app/providers/brand.tsx`,
`apps/remix/app/root.tsx`, the logo components, `packages/ui/styles/theme.css`.

K8s manifests live in the `intelli-verse-kube-infra` repo under `documenso/`.

---

## Step 1 - Build and push the branded image

**Automated (preferred).** Every commit to `main` is built and deployed by the
CI/CD pipeline — see [CI/CD](#cicd-continuous-deployment) below. You normally do
not run anything here.

**Manual / break-glass.** Build and push to ECR locally:

```bash
aws sso login   # or have AWS creds in the environment
./intelliverse/build-and-push-image.sh v1
```

This builds from the repo (with the Intelliverse/Toba branding) and pushes
`970547373533.dkr.ecr.us-east-1.amazonaws.com/documenso:v1` (+ `:latest` and the
git SHA). Roll out with
`kubectl set image deployment/documenso documenso=<ecr>/documenso:v1 -n documenso`.

## Step 2 - Generate secrets and the signing certificate

```bash
# App secrets
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -base64 32   # NEXT_PRIVATE_ENCRYPTION_KEY
openssl rand -base64 32   # NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY
openssl rand -base64 24   # POSTGRES_PASSWORD
```

Create the signing `cert.p12` per
`intelli-verse-kube-infra/documenso/signing-cert-secret.md`.

Fill in `intelli-verse-kube-infra/documenso/secrets-template.yaml` (or create the
secrets imperatively) with SMTP credentials, the DB URL, and
`NEXT_PUBLIC_FEATURE_BILLING_ENABLED=false` (this unlocks white-label branding
and disables team limits).

## Step 3 - Apply the Kubernetes manifests

Follow the apply order in `intelli-verse-kube-infra/documenso/README.md`:
namespace -> secrets (app + postgres + signing cert) -> postgres ->
app -> ingresses. The app runs `prisma migrate deploy` on startup. (ECR images
pull via the node IAM role, so no registry pull-secret is required.)

Verify:

```bash
curl -fsS https://contracts.intelli-verse-x.ai/api/health
curl -fsS https://contracts.toba-tech.ai/api/health
```

Open each host and confirm the brand-specific logo, primary color, favicon, and
title (Intelliverse indigo vs Toba teal).

## Step 4 - Create the first admin user

Sign up the first account (public sign-up is disabled by default; temporarily set
`NEXT_PUBLIC_DISABLE_SIGNUP=false`, create the user, then re-enable), or create
it via the Documenso CLI/seed. Promote it to admin:

```bash
kubectl -n documenso exec deploy/documenso -- \
  npx prisma studio   # or update User.roles to include ADMIN in the DB
```

## Step 5 - Create orgs, teams, and per-tenant branding

Run against the app's database (set the same `NEXT_PRIVATE_DATABASE_URL`). From
the repo root:

```bash
ADMIN_EMAIL=you@intelli-verse-x.ai npx tsx intelliverse/scripts/setup-orgs.ts
```

This creates:

- **Intelliverse** org with teams **Clients** (`clients`) and
  **Employees & Contractors** (`people`)
- **Toba Tech** org with teams **Contracts** (`contracts`) and
  **Employees & Contractors** (`people`)

and sets per-tenant signing/email branding (brand color, company details, brand
URL). Upload each org's logo image once via Settings -> Branding.

## Step 6 - Create API tokens (per team)

Documenso API tokens are team-scoped. In the app, for each team that will hold
templates, create an API token (Settings -> API tokens). Both orgs now have a
`people` team, so tokens are resolved by `DOCUMENSO_TOKEN_<ORG>_<TEAM>` (the
loader falls back to `DOCUMENSO_TOKEN_<TEAM>` then `DOCUMENSO_API_TOKEN`):

- Intelliverse / Clients -> `DOCUMENSO_TOKEN_INTELLIVERSE_CLIENTS`
- Intelliverse / Employees & Contractors -> `DOCUMENSO_TOKEN_INTELLIVERSE_PEOPLE`
- Toba Tech / Contracts -> `DOCUMENSO_TOKEN_TOBA_TECH_CONTRACTS`
- Toba Tech / Employees & Contractors -> `DOCUMENSO_TOKEN_TOBA_TECH_PEOPLE`

## Step 7 - Build the contract PDFs

```bash
npm i -D md-to-pdf pdf-lib
npx tsx intelliverse/scripts/build-pdfs.ts
```

PDFs are written to `intelliverse/contracts/dist/`.

## Step 8 - Load the templates

```bash
DOCUMENSO_API_URL=https://contracts.intelli-verse-x.ai \
DOCUMENSO_TOKEN_INTELLIVERSE_CLIENTS=api_aaa \
DOCUMENSO_TOKEN_INTELLIVERSE_PEOPLE=api_bbb \
DOCUMENSO_TOKEN_TOBA_TECH_CONTRACTS=api_ccc \
DOCUMENSO_TOKEN_TOBA_TECH_PEOPLE=api_ddd \
  npx tsx intelliverse/scripts/load-templates.ts
```

Each template is created with two placeholder signers (Company + Counterparty)
and Name/Signature/Date fields on the signature page. NDAs get a direct link
(`/d/<token>`) for client self-serve. The manifest publishes the full set to
both companies (Intelliverse `clients`/`people` and Toba Tech
`contracts`/`people`); the loader is one deployment, so a single
`DOCUMENSO_API_URL` works for every team token.

## Using a template

In the app, open a template and "Use" it: fill the `{{Placeholder}}` values
(party names, dates, fees), set the real signer emails, and send. Or share an
NDA direct link.

---

## CI/CD (continuous deployment)

Future commits ship automatically. The heavy build + deploy logic lives in the
infra repo (house convention); this repo just gates on CI and triggers it.

```
push to main (this repo)
   │
   ▼
"Continuous Integration" (.github/workflows/ci.yml: build app + docker)
   │ success
   ▼
intelliverse-deploy.yml  ──repository_dispatch (documenso-deploy)──▶
   │
   ▼
intelli-verse-kube-infra/.github/workflows/documenso-build.yml
   • docker build -f docker/Dockerfile @ this commit  →  ECR :latest + :<sha>
   • kubectl apply manifests + set image deployment/documenso=…:<sha>
   • rollout (DB migrations run on boot) → /api/health smoke test
```

**Required secret (this repo):** `INFRA_DISPATCH_TOKEN` — a GitHub PAT with
`repo` scope on `intelli-verse-x/intelli-verse-kube-infra`, used to fire the
deploy dispatch. The infra repo already holds `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, and `GH_PAT`.

**Manual deploy:** run **Build & Deploy Documenso** from the infra repo's
Actions tab with a `ref`, or **Intelliverse Deploy Trigger** from this repo's
Actions tab.

## Notes and limitations

- **Counsel review is required** before any contract is used. The drafts carry a
  visible "DRAFT - review by counsel" notice.
- App-shell strings are localized; some deep internal strings may still read
  "Documenso". The visible brand surfaces (logo, colors, favicon, titles, email
  footer, signing "Powered by") are rebranded and hostname-aware.
- The signing-page/email branding per client follows the org/team branding set in
  Step 5, independent of which hostname is used to author.
- Field coordinates in `load-templates.ts` (`FIELD_LAYOUT`) assume the generated
  signature-page layout. If you change the contract markdown signature section,
  re-check the overlay positions.
