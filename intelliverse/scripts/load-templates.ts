/**
 * Load the built contract PDFs into a running Documenso instance as e-signable
 * templates via the v2 REST API. For each manifest entry it:
 *   1. POST /api/v2/template/create        (uploads the PDF, creates the template)
 *   2. POST /api/v2/template/recipient/create-many  (Company + Counterparty signers)
 *   3. POST /api/v2/template/field/create-many       (Name/Signature/Date per signer
 *      on the last/signature page)
 *   4. POST /api/v2/template/direct/create (optional, when directLink=true)
 *
 * Documenso API tokens are TEAM-SCOPED, so provide a token per team. The script
 * resolves the token for a manifest entry's teamUrl from, in order:
 *   DOCUMENSO_TOKEN_<TEAMURL>  (e.g. DOCUMENSO_TOKEN_CLIENTS, DOCUMENSO_TOKEN_PEOPLE)
 *   DOCUMENSO_API_TOKEN        (fallback)
 *
 * Build the PDFs first (build-pdfs.ts). Requires pdf-lib:
 *   npm i -D pdf-lib
 *
 * Usage (from repo root):
 *   DOCUMENSO_API_URL=https://contracts.intelli-verse-x.ai \
 *   DOCUMENSO_TOKEN_CLIENTS=api_xxx DOCUMENSO_TOKEN_PEOPLE=api_yyy \
 *     npx tsx intelliverse/scripts/load-templates.ts
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

import { pdfSlug } from './build-pdfs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = resolve(SCRIPT_DIR, '../contracts');
const DIST_DIR = join(CONTRACTS_DIR, 'dist');

const API_URL = (process.env.DOCUMENSO_API_URL ?? '').replace(/\/$/, '');

type ManifestEntry = {
  file: string;
  title: string;
  orgUrl: string;
  teamUrl: string;
  counterpartyRole: string;
  directLink?: boolean;
};

type Manifest = { templates: ManifestEntry[] };

// Field layout on the signature page (percentages, top-left origin).
const FIELD_LAYOUT = {
  company: {
    name: { pageX: 12, pageY: 30, width: 35, height: 5 },
    signature: { pageX: 12, pageY: 38, width: 35, height: 9 },
    date: { pageX: 60, pageY: 38, width: 26, height: 5 },
  },
  counterparty: {
    name: { pageX: 12, pageY: 62, width: 35, height: 5 },
    signature: { pageX: 12, pageY: 70, width: 35, height: 9 },
    date: { pageX: 60, pageY: 70, width: 26, height: 5 },
  },
};

const tokenForTeam = (teamUrl: string): string => {
  const key = `DOCUMENSO_TOKEN_${teamUrl.toUpperCase().replace(/-/g, '_')}`;
  const token = process.env[key] ?? process.env.DOCUMENSO_API_TOKEN;

  if (!token) {
    throw new Error(`No API token for team "${teamUrl}". Set ${key} or DOCUMENSO_API_TOKEN.`);
  }

  return token;
};

const api = async <T>(token: string, path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`POST ${path} failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
};

const createTemplate = async (token: string, entry: ManifestEntry, pdf: Uint8Array): Promise<number> => {
  const form = new FormData();
  form.append(
    'payload',
    JSON.stringify({
      title: entry.title,
      type: 'PRIVATE',
      publicTitle: entry.title.slice(0, 50),
      publicDescription: `Generated template - review by counsel before use.`.slice(0, 256),
    }),
  );
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), `${pdfSlug(entry.file)}.pdf`);

  const response = await fetch(`${API_URL}/api/v2/template/create`, {
    method: 'POST',
    headers: { Authorization: token },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Create template "${entry.title}" failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { id: number; envelopeId: string };
  return data.id;
};

const main = async () => {
  if (!API_URL) {
    throw new Error('DOCUMENSO_API_URL is required (e.g. https://contracts.intelli-verse-x.ai).');
  }

  const manifest = JSON.parse(await readFile(join(CONTRACTS_DIR, 'templates.manifest.json'), 'utf8')) as Manifest;

  for (const entry of manifest.templates) {
    const token = tokenForTeam(entry.teamUrl);
    const pdfPath = join(DIST_DIR, `${pdfSlug(entry.file)}.pdf`);
    const pdfBytes = await readFile(pdfPath);

    const pageCount = (await PDFDocument.load(pdfBytes)).getPageCount();
    const signaturePage = pageCount; // last page

    console.log(`\n${entry.title} (team=${entry.teamUrl}, pages=${pageCount})`);

    const templateId = await createTemplate(token, entry, pdfBytes);
    console.log(`  created template id=${templateId}`);

    // Two placeholder signers: Company (signs first) + Counterparty.
    const { recipients } = await api<{ recipients: { id: number; email: string }[] }>(
      token,
      '/api/v2/template/recipient/create-many',
      {
        templateId,
        recipients: [
          { email: 'recipient.1@documenso.com', name: 'Company', role: 'SIGNER', signingOrder: 1 },
          { email: 'recipient.2@documenso.com', name: entry.counterpartyRole, role: 'SIGNER', signingOrder: 2 },
        ],
      },
    );

    const companyId = recipients[0].id;
    const counterpartyId = recipients[1].id;

    const fieldFor = (
      recipientId: number,
      type: string,
      box: { pageX: number; pageY: number; width: number; height: number },
    ) => ({
      recipientId,
      type,
      pageNumber: signaturePage,
      pageX: box.pageX,
      pageY: box.pageY,
      width: box.width,
      height: box.height,
    });

    await api(token, '/api/v2/template/field/create-many', {
      templateId,
      fields: [
        fieldFor(companyId, 'NAME', FIELD_LAYOUT.company.name),
        fieldFor(companyId, 'SIGNATURE', FIELD_LAYOUT.company.signature),
        fieldFor(companyId, 'DATE', FIELD_LAYOUT.company.date),
        fieldFor(counterpartyId, 'NAME', FIELD_LAYOUT.counterparty.name),
        fieldFor(counterpartyId, 'SIGNATURE', FIELD_LAYOUT.counterparty.signature),
        fieldFor(counterpartyId, 'DATE', FIELD_LAYOUT.counterparty.date),
      ],
    });
    console.log('  added Name/Signature/Date fields for both signers');

    if (entry.directLink) {
      try {
        const link = await api<{ token: string }>(token, '/api/v2/template/direct/create', {
          templateId,
          directRecipientId: counterpartyId,
        });
        console.log(`  direct link: ${API_URL}/d/${link.token}`);
      } catch (error) {
        console.warn(`  direct link skipped: ${(error as Error).message}`);
      }
    }
  }

  console.log('\nDone loading templates.');
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
