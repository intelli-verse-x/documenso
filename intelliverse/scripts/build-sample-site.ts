/**
 * Build a shareable static site of the contract templates filled with realistic
 * SAMPLE data (fake names, positions, fees, dates) so they are easy to read and
 * understand. For each manifest entry it:
 *   1. reads the markdown
 *   2. replaces every {{Placeholder}} with sample/test data
 *   3. renders it to a PDF in contracts/sample-dist/
 * and then writes an index.html (+ 404.html) that lets you browse and read every
 * template in the browser.
 *
 * These are SAMPLES for demonstration only - not legal advice, not executed
 * agreements. Every sample carries the same "DRAFT" notice as the source.
 *
 * Requires md-to-pdf (bundles a headless Chromium):
 *   npm i -D md-to-pdf
 *
 * Usage (from repo root):
 *   npx tsx intelliverse/scripts/build-sample-site.ts
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = resolve(SCRIPT_DIR, '../contracts');
const DIST_DIR = join(CONTRACTS_DIR, 'sample-dist');

const pdfSlug = (file: string): string => file.replace(/\.md$/, '').replace(/[\\/]/g, '-');

type ManifestEntry = {
  file: string;
  title: string;
  orgUrl: string;
  teamUrl: string;
  counterpartyRole: string;
  directLink?: boolean;
};

type Manifest = { templates: ManifestEntry[] };

type SampleData = Record<string, string>;

// Base sample data (defaults to the US scenario). Indian templates get currency,
// jurisdiction and party overrides via INDIA below.
const BASE: SampleData = {
  // Dates
  EffectiveDate: 'March 3, 2026',
  OfferDate: 'March 3, 2026',
  StartDate: 'April 1, 2026',
  MSADate: 'January 15, 2026',

  // Company (Intelliverse - US default)
  CompanyLegalName: 'Intelliverse, Inc.',
  CompanyState: 'Delaware',
  CompanyEntityType: 'corporation',
  CompanyAddress: '548 Market Street, Suite 95, San Francisco, CA 94104, USA',

  // Governing law / venue (US default)
  GoverningState: 'California',
  Venue: 'San Francisco County, California',
  Jurisdiction: 'San Francisco County, California',
  ArbitrationSeat: 'San Francisco, California',
  PlaceOfExecution: 'San Francisco, California',

  // Employee (US)
  EmployeeName: 'Jordan A. Carter',
  EmployeeFirstName: 'Jordan',
  EmployeeAddress: '1242 Elm Avenue, Apt 7B, San Jose, CA 95128, USA',
  JobTitle: 'Senior Software Engineer',
  Manager: 'Priya Desai, VP of Engineering',
  WorkLocation: 'San Francisco, CA (hybrid - 2 days on-site)',
  BaseSalary: '$165,000',
  ExemptOrNonExempt: 'Exempt',
  BonusTerms: 'Target annual bonus of up to 15% of base salary, based on company and individual performance.',
  BenefitsSummary:
    'Medical, dental, and vision coverage; 401(k) with a 4% company match; 20 days PTO plus 11 paid holidays.',
  Contingencies: 'a standard background check and reference verification',

  // Contractor (US)
  ContractorName: 'Taylor Brooks',
  ContractorEntityOrIndividual: 'an individual',
  InsuranceRequirements:
    'commercial general liability of at least $1,000,000 per occurrence and professional liability (E&O) of at least $1,000,000',

  // Signer (PIIA - US)
  SignerName: 'Jordan A. Carter',
  StateStatuteNotice:
    'California Labor Code Section 2870 applies to inventions developed entirely on the Signer\u2019s own time without Company resources.',

  // Client (US)
  ClientLegalName: 'Globex Solutions, LLC',
  ClientState: 'New York',
  ClientEntityType: 'limited liability company',
  CounterpartyLegalName: 'Northwind Traders, Inc.',
  CounterpartyAddress: '200 Park Avenue, 18th Floor, New York, NY 10166, USA',

  // Commercial terms
  Fees: '$120 per hour, not to exceed $24,000 per month',
  Rates: '$150 - $220 per hour depending on role and seniority',
  PaymentTermDays: '30',
  TerminationNoticeDays: '30',
  NonSolicitMonths: '12',
  NoticeDays: '60',
  ProbationMonths: '6',
  ProbationNoticeDays: '15',
  Term: '12 months',
  InterestRate: '1.5% per month',
  LiabilityCapMonths: '12',
  AcceptancePeriodDays: '10',
  DisclosurePeriod: 'two (2) years',
  ConfidentialityTerm: 'three (3) years',
  PricingModel: 'Time and materials with a not-to-exceed cap',
  InvoicingTerms: 'invoiced monthly in arrears, payable net 30',
  LeavePolicySummary:
    '18 days of earned leave, 12 casual/sick days, plus public holidays as per the applicable Shops & Establishments Act.',
  CTC: '$165,000',

  // SOW
  SOWNumber: 'SOW-2026-014',
  ProjectBackgroundAndObjectives:
    'Globex Solutions is modernizing its customer self-service portal. The objective of this engagement is to design and deliver a new React-based portal with single sign-on, a billing dashboard, and a support ticketing integration, launched to production within one quarter.',
  Service1: 'UX research, wireframes, and a component design system for the new portal',
  Service2: 'Front-end implementation (React) with SSO and billing dashboard integration',
  Service3: 'QA, accessibility (WCAG 2.1 AA) review, and production launch support',
  OutOfScope: 'native mobile apps, data migration from legacy systems, and 24/7 managed operations',
  Deliverable1: 'Design system & clickable prototype',
  Deliverable1Desc: 'Figma component library and an interactive prototype of all core portal screens',
  Deliverable1Acceptance: 'Client sign-off on prototype covering all in-scope screens',
  Deliverable2: 'Production portal release v1.0',
  Deliverable2Desc: 'Deployed React portal with SSO, billing dashboard, and ticketing integration',
  Deliverable2Acceptance: 'All P0/P1 acceptance tests pass in staging and production smoke test succeeds',
  Milestone1: 'Design & prototype approved',
  Milestone1Date: 'April 24, 2026',
  Milestone1Dependency: 'Client provides brand assets and portal access by April 3, 2026',
  Milestone2: 'Production launch',
  Milestone2Date: 'June 19, 2026',
  Milestone2Dependency: 'SSO and billing API credentials provided by May 15, 2026',
  ProviderLead: 'Sam Rivera, Engagement Lead',
  ProviderLeadResp: 'Delivery, staffing, and weekly status reporting',
  ClientSponsor: 'Dana Lee, Director of Digital Products',
  ClientSponsorResp: 'Approvals, access provisioning, and stakeholder coordination',
  Assumptions:
    'timely access to systems and stakeholders, one consolidated round of feedback per deliverable, and availability of a Client product owner',
};

// India-scenario overrides, applied to every *-in.md template.
const INDIA: SampleData = {
  CompanyLegalName: 'Intelliverse Technologies Private Limited',
  CompanyAddress: 'No. 42, 4th Floor, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038, India',
  PlaceOfExecution: 'Bengaluru, Karnataka',
  ArbitrationSeat: 'Bengaluru, Karnataka',
  Jurisdiction: 'Bengaluru, Karnataka',

  EmployeeName: 'Aarav Sharma',
  EmployeeFirstName: 'Aarav',
  EmployeeAddress: 'No. 14, 2nd Cross, Koramangala 5th Block, Bengaluru, Karnataka 560095, India',
  SignerName: 'Aarav Sharma',
  ConsultantName: 'Priya Nair',
  ConsultantEntityOrIndividual: 'an individual consultant',

  ClientLegalName: 'Acme Digital Private Limited',
  CounterpartyLegalName: 'Zephyr Labs Private Limited',
  CounterpartyAddress: 'Tower B, RMZ Ecospace, Outer Ring Road, Bellandur, Bengaluru, Karnataka 560103, India',

  CTC: 'INR 24,00,000 (Rupees Twenty-Four Lakh) per annum',
  BaseSalary: 'INR 24,00,000 per annum',
  Fees: 'INR 2,50,000 per month, plus applicable GST',
  Rates: 'INR 12,000 - INR 18,000 per day depending on role',
};

const overridesForFile = (file: string): SampleData => (file.endsWith('-in.md') ? { ...BASE, ...INDIA } : { ...BASE });

const fillTemplate = (markdown: string, data: SampleData): { content: string; missing: string[] } => {
  const missing = new Set<string>();
  const content = markdown.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => {
    if (data[key] === undefined) {
      missing.add(key);
      return `[${key}]`;
    }
    return data[key];
  });
  return { content, missing: [...missing] };
};

const STYLESHEET = `
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; font-size: 11pt; line-height: 1.5; }
  h1 { font-size: 20pt; margin: 0 0 12px; }
  h2 { font-size: 13pt; margin: 18px 0 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
  h3 { font-size: 11.5pt; margin: 12px 0 4px; }
  p, li { font-size: 11pt; }
  blockquote {
    border-left: 4px solid #b91c1c; background: #fef2f2; color: #7f1d1d;
    margin: 0 0 16px; padding: 8px 12px; font-size: 9.5pt; border-radius: 4px;
  }
  .sample-banner {
    border: 1px dashed #2563eb; background: #eff6ff; color: #1e3a8a;
    margin: 0 0 16px; padding: 8px 12px; font-size: 9.5pt; border-radius: 4px;
  }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10pt; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  [style*="page-break-before"] { page-break-before: always; }
`;

const SAMPLE_BANNER =
  '<div class="sample-banner"><strong>SAMPLE / ILLUSTRATIVE DATA.</strong> Names, dates, fees, and parties below are fictional, inserted only to make the template easy to read. This is not an executed agreement.</div>\n\n';

const jurisdictionOf = (file: string): 'US' | 'India' => (file.endsWith('-in.md') ? 'India' : 'US');
const categoryOf = (entry: ManifestEntry): 'People' | 'Client' => (entry.teamUrl === 'people' ? 'People' : 'Client');

type BuiltTemplate = {
  entry: ManifestEntry;
  slug: string;
  category: 'People' | 'Client';
  jurisdiction: 'US' | 'India';
  parties: string;
};

const partiesSummary = (entry: ManifestEntry, data: SampleData): string => {
  const company = data.CompanyLegalName;
  const byRole: Record<string, string | undefined> = {
    Employee: data.EmployeeName,
    Contractor: data.ContractorName,
    Consultant: data.ConsultantName,
    Signer: data.SignerName,
    Client: data.ClientLegalName,
    Counterparty: data.CounterpartyLegalName,
  };
  const other = byRole[entry.counterpartyRole] ?? data.ClientLegalName ?? data.CounterpartyLegalName ?? '';
  const showRole = ['Employee', 'Contractor', 'Consultant', 'Signer'].includes(entry.counterpartyRole);
  return showRole ? `${company} & ${other} (${entry.counterpartyRole})` : `${company} & ${other}`;
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderIndexHtml = (built: BuiltTemplate[]): string => {
  const groups: ('People' | 'Client')[] = ['People', 'Client'];

  const cardHtml = (b: BuiltTemplate): string => `
        <article class="card" data-category="${b.category}" data-jurisdiction="${b.jurisdiction}" data-title="${escapeHtml(b.entry.title.toLowerCase())}">
          <div class="card-head">
            <h3>${escapeHtml(b.entry.title)}</h3>
            <span class="badge badge-${b.jurisdiction === 'India' ? 'in' : 'us'}">${b.jurisdiction}</span>
          </div>
          <p class="parties">${escapeHtml(b.parties)}</p>
          <p class="meta">${b.category} &middot; ${b.jurisdiction}</p>
          <div class="actions">
            <a class="btn btn-primary" href="${b.slug}.pdf" target="preview">Read</a>
            <a class="btn" href="${b.slug}.pdf" download>Download</a>
          </div>
        </article>`;

  const sectionHtml = (group: 'People' | 'Client'): string => {
    const items = built.filter((b) => b.category === group);
    if (items.length === 0) {
      return '';
    }
    const label = group === 'People' ? 'People (Employees & Contractors)' : 'Clients';
    return `
      <section class="group">
        <h2>${label}</h2>
        <div class="grid">${items.map(cardHtml).join('')}</div>
      </section>`;
  };

  const firstPdf = built[0]?.slug;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Intelliverse - Sample Contract Templates</title>
  <meta name="robots" content="noindex" />
  <style>
    :root { --indigo: #4f46e5; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; --bg: #f8fafc; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: var(--ink); background: var(--bg); }
    header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 28px 32px; }
    header h1 { margin: 0 0 4px; font-size: 22px; }
    header p { margin: 0; opacity: 0.9; font-size: 14px; }
    .disclaimer { background: #fef2f2; color: #7f1d1d; border-bottom: 1px solid #fecaca; padding: 10px 32px; font-size: 13px; }
    .layout { display: grid; grid-template-columns: minmax(360px, 1fr) minmax(480px, 1.3fr); gap: 0; height: calc(100vh - 150px); }
    .panel-list { overflow-y: auto; padding: 20px 24px; border-right: 1px solid var(--line); }
    .panel-view { background: #525659; }
    .panel-view iframe { width: 100%; height: 100%; border: 0; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar input { flex: 1 1 180px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; }
    .toolbar select { padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; background: #fff; }
    .group { margin-bottom: 26px; }
    .group h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 12px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
    .card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; transition: box-shadow 0.15s, border-color 0.15s; }
    .card:hover { box-shadow: 0 6px 20px rgba(15,23,42,0.08); border-color: #c7d2fe; }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .card-head h3 { margin: 0; font-size: 15px; }
    .parties { margin: 6px 0 2px; font-size: 13px; color: var(--ink); }
    .meta { margin: 0 0 10px; font-size: 12px; color: var(--muted); }
    .badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
    .badge-us { background: #eff6ff; color: #1d4ed8; }
    .badge-in { background: #ecfdf5; color: #047857; }
    .actions { display: flex; gap: 8px; }
    .btn { display: inline-block; padding: 6px 12px; border-radius: 8px; font-size: 13px; text-decoration: none; border: 1px solid var(--line); color: var(--ink); background: #fff; cursor: pointer; }
    .btn:hover { background: #f1f5f9; }
    .btn-primary { background: var(--indigo); color: #fff; border-color: var(--indigo); }
    .btn-primary:hover { background: #4338ca; }
    .empty { color: var(--muted); font-size: 14px; padding: 20px 0; }
    @media (max-width: 880px) { .layout { grid-template-columns: 1fr; height: auto; } .panel-view { height: 70vh; } }
  </style>
</head>
<body>
  <header>
    <h1>Intelliverse - Sample Contract Templates</h1>
    <p>Browse and read each template, pre-filled with realistic sample data.</p>
  </header>
  <div class="disclaimer">
    <strong>Draft / sample only - not legal advice.</strong> Names, fees, and dates are fictional test data. Have each
    template reviewed by a licensed attorney in the applicable jurisdiction before any real use.
  </div>
  <div class="layout">
    <div class="panel-list">
      <div class="toolbar">
        <input id="search" type="search" placeholder="Search templates..." />
        <select id="filter-jur">
          <option value="">All regions</option>
          <option value="US">US</option>
          <option value="India">India</option>
        </select>
      </div>
      ${groups.map(sectionHtml).join('')}
      <p id="no-results" class="empty" style="display:none">No templates match your search.</p>
    </div>
    <div class="panel-view">
      <iframe name="preview" title="Template preview"${firstPdf ? ` src="${firstPdf}.pdf"` : ''}></iframe>
    </div>
  </div>
  <script>
    const search = document.getElementById('search');
    const filterJur = document.getElementById('filter-jur');
    const cards = Array.from(document.querySelectorAll('.card'));
    const noResults = document.getElementById('no-results');
    const apply = () => {
      const q = search.value.trim().toLowerCase();
      const jur = filterJur.value;
      let visible = 0;
      cards.forEach((card) => {
        const matchesText = !q || card.dataset.title.includes(q) || card.textContent.toLowerCase().includes(q);
        const matchesJur = !jur || card.dataset.jurisdiction === jur;
        const show = matchesText && matchesJur;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      document.querySelectorAll('.group').forEach((g) => {
        const anyVisible = Array.from(g.querySelectorAll('.card')).some((c) => c.style.display !== 'none');
        g.style.display = anyVisible ? '' : 'none';
      });
      noResults.style.display = visible === 0 ? '' : 'none';
    };
    search.addEventListener('input', apply);
    filterJur.addEventListener('change', apply);
  </script>
</body>
</html>`;
};

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Not found</title>
<style>body{font-family:Arial,sans-serif;text-align:center;padding:80px;color:#0f172a}a{color:#4f46e5}</style>
</head><body><h1>404 - Not found</h1><p><a href="/">Back to templates</a></p></body></html>`;

const main = async () => {
  const manifest = JSON.parse(await readFile(join(CONTRACTS_DIR, 'templates.manifest.json'), 'utf8')) as Manifest;

  await mkdir(DIST_DIR, { recursive: true });

  const built: BuiltTemplate[] = [];

  for (const entry of manifest.templates) {
    const data = overridesForFile(entry.file);
    const markdown = await readFile(join(CONTRACTS_DIR, entry.file), 'utf8');
    const { content, missing } = fillTemplate(markdown, data);

    if (missing.length > 0) {
      console.warn(`  ! ${entry.file}: no sample value for ${missing.join(', ')}`);
    }

    const withBanner = SAMPLE_BANNER + content;

    const pdf = await mdToPdf(
      { content: withBanner },
      {
        css: STYLESHEET,
        pdf_options: {
          format: 'Letter',
          margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
          printBackground: true,
        },
      },
    );

    if (!pdf?.content) {
      throw new Error(`Failed to render ${entry.file}`);
    }

    const slug = pdfSlug(entry.file);
    await writeFile(join(DIST_DIR, `${slug}.pdf`), pdf.content);

    built.push({
      entry,
      slug,
      category: categoryOf(entry),
      jurisdiction: jurisdictionOf(entry.file),
      parties: partiesSummary(entry, data),
    });

    console.log(`Rendered ${entry.file} -> ${slug}.pdf`);
  }

  await writeFile(join(DIST_DIR, 'index.html'), renderIndexHtml(built));
  await writeFile(join(DIST_DIR, '404.html'), NOT_FOUND_HTML);

  console.log(`\nDone. ${built.length} sample PDFs + index.html in ${DIST_DIR}`);
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
