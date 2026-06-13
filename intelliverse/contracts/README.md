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
| `client/ip-assignment-piia-us.md` / `client/ip-assignment-piia-in.md` | IP Assignment + Confidentiality (PIIA) |

People (jurisdiction-specific):

| File | Purpose |
| --- | --- |
| `people/employee-us.md` | US employment offer/agreement (at-will) |
| `people/contractor-us.md` | US independent contractor agreement |
| `people/employee-in.md` | India employment agreement |
| `people/contractor-in.md` | India consultant/contractor agreement |

## Conventions

- `{{Placeholder}}` = a value the sender fills in (party legal name, dates, fees)
  before sending, in the Documenso editor.
- The final page is a dedicated signature page (forced via a page break). The
  loader overlays Name / Signature / Date e-sign fields there for two parties:
  the Company (Intelliverse or Toba Tech) and the Counterparty.
- `recipients.json` in each folder maps template -> default signer roles + which
  org/team it belongs to.
