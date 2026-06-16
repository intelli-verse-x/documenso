# Intelliverse / Toba Tech contract templates

Reusable contract templates that are built to PDF and loaded into Documenso as
e-signable templates (see `../scripts/build-pdfs.ts` and
`../scripts/load-templates.ts`).

## IMPORTANT - legal disclaimer

These documents are AI-drafted starting points whose clause structure was
verified against current public US/India standards via automated research
(firecrawl). They are NOT legal advice and are NOT certified as legally binding.

Before any real use you MUST have each template reviewed, customized, and
approved by a licensed attorney in the applicable jurisdiction (United States
and/or India). Statutory references (e.g., Indian Contract Act 1872 s.27, the
2025 Labour Codes, Payment of Gratuity Act 1972, POSH Act 2013, IRS worker
classification, US at-will doctrine) change over time and vary by state.

Every template carries a "DRAFT - review by counsel" notice at the top.

## Templates

Client-facing (US + India variants):

| File | Purpose |
| --- | --- |
| `client/mutual-nda-us.md` / `client/mutual-nda-in.md` | Mutual NDA |
| `client/msa-us.md` / `client/msa-in.md` | Master Services Agreement |
| `client/sow-us.md` / `client/sow-in.md` | Statement of Work (under an MSA) |
| `client/project-proposal-us.md` / `client/project-proposal-in.md` | Project Proposal (pre-sales offer) |
| `client/ip-assignment-piia-us.md` / `client/ip-assignment-piia-in.md` | IP Assignment + Confidentiality (PIIA) |

People (jurisdiction-specific):

| File | Purpose |
| --- | --- |
| `people/employee-us.md` | US employment offer/agreement (at-will) |
| `people/contractor-us.md` | US independent contractor agreement |
| `people/employee-in.md` | India employment agreement |
| `people/contractor-in.md` | India consultant/contractor agreement |

## Adding a new template (end to end)

Every template flows through the same pipeline for both companies:

1. **Write the markdown** in `client/` (client-facing) or `people/` (HR), with
   `{{Placeholder}}` values and a dedicated signature page (a
   `<div style="page-break-before: always"></div>` before the `## Signature Page`).
   Add US/India variants (`-us.md` / `-in.md`) to match the suite.
2. **Register it** for both companies in `templates.manifest.json`
   (`orgUrl` intelliverse + toba-tech; `teamUrl` `clients`/`contracts` for client
   docs, `people` for HR docs) and in `packages/prisma/seed/setup-contract-templates.ts`
   (`CLIENT_DOCS` or `PEOPLE_DOCS`).
3. **Add sample values** for any new placeholders in
   `intelliverse/scripts/build-sample-site.ts` (`BASE`, plus `INDIA` overrides).
4. **Rebuild + publish** the shareable read-only site:
   `npx tsx intelliverse/scripts/build-sample-site.ts` then
   `aws s3 sync intelliverse/contracts/sample-dist s3://contract-templates.intelli-verse-x.ai`.
5. **Load it live** (idempotent — only missing titles are created) by running the
   seed against each database with `COMPANY=intelliverse|toba-tech` set (see the
   root `intelliverse/README.md`).

Templates are fully editable afterwards in the Documenso UI (content, fields,
recipients) per team, so each company can customise its own copy.

## Conventions

- `{{Placeholder}}` = a value the sender fills in (party legal name, dates, fees)
  before sending, in the Documenso editor.
- The final page is a dedicated signature page (forced via a page break). The
  loader overlays Name / Signature / Date e-sign fields there for two parties:
  the Company (Intelliverse or Toba Tech) and the Counterparty.
- `recipients.json` in each folder maps template -> default signer roles + which
  org/team it belongs to.
