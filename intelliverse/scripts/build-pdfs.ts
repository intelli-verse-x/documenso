/**
 * Render each contract markdown in contracts/templates.manifest.json to a PDF in
 * contracts/dist/. The final page of each markdown is a dedicated signature page
 * (forced via a `page-break-before` div) so the loader can overlay e-sign fields
 * there.
 *
 * Requires md-to-pdf (bundles a headless Chromium):
 *   npm i -D md-to-pdf
 *
 * Usage (from repo root):
 *   npx tsx intelliverse/scripts/build-pdfs.ts
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = resolve(SCRIPT_DIR, '../contracts');
const DIST_DIR = join(CONTRACTS_DIR, 'dist');

type Manifest = { templates: { file: string; title: string }[] };

export const pdfSlug = (file: string): string => file.replace(/\.md$/, '').replace(/[\\/]/g, '-');

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
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10pt; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  [style*="page-break-before"] { page-break-before: always; }
`;

const main = async () => {
  const manifestRaw = await readFile(join(CONTRACTS_DIR, 'templates.manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw) as Manifest;

  await mkdir(DIST_DIR, { recursive: true });

  for (const template of manifest.templates) {
    const mdPath = join(CONTRACTS_DIR, template.file);
    const content = await readFile(mdPath, 'utf8');

    const pdf = await mdToPdf(
      { content },
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
      throw new Error(`Failed to render ${template.file}`);
    }

    const outPath = join(DIST_DIR, `${pdfSlug(template.file)}.pdf`);
    await writeFile(outPath, pdf.content);
    console.log(`Rendered ${template.file} -> ${outPath}`);
  }

  console.log(`\nDone. ${manifest.templates.length} PDFs in ${DIST_DIR}`);
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
