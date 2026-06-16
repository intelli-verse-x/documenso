/**
 * Debug helper: render a few templates with the real seed renderer and draw a
 * red rectangle at each computed TEXT-field position, so we can visually confirm
 * the fields line up with the fill-in blanks before recreating live templates.
 *
 *   npx tsx intelliverse/scripts/debug-field-overlay.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb } from '@cantoo/pdf-lib';

import { bakeFor, renderPdf } from '../../packages/prisma/seed/setup-contract-templates';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = resolve(SCRIPT_DIR, '../contracts');
const OUT_DIR = join(CONTRACTS_DIR, 'sample-dist');

const SAMPLES: { file: string; title: string }[] = [
  { file: 'client/sow-us.md', title: 'Statement of Work (US)' },
  { file: 'people/employee-us.md', title: 'Employment Offer & Agreement - At-Will (US)' },
  { file: 'client/project-proposal-us.md', title: 'Project Proposal (US)' },
];

const main = async () => {
  for (const sample of SAMPLES) {
    const md = readFileSync(join(CONTRACTS_DIR, sample.file), 'utf8');
    const { bytes, fields } = await renderPdf(md, sample.title, bakeFor('intelliverse', sample.file));

    const pdf = await PDFDocument.load(Buffer.from(bytes, 'base64'));
    const pages = pdf.getPages();

    for (const field of fields) {
      const p = pages[field.page - 1];
      const W = p.getWidth();
      const H = p.getHeight();
      const x = (field.positionX / 100) * W;
      const topFromTop = (field.positionY / 100) * H;
      const w = (field.width / 100) * W;
      const h = (field.height / 100) * H;
      p.drawRectangle({
        x,
        y: H - topFromTop - h,
        width: w,
        height: h,
        borderColor: rgb(0.9, 0.1, 0.1),
        borderWidth: 0.8,
      });
    }

    const out = join(OUT_DIR, `_debug-${sample.file.replace(/[\\/]/g, '-').replace(/\.md$/, '')}.pdf`);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(out, Buffer.from(await pdf.save()));
    console.log(`Wrote ${out} (${fields.length} fields)`);
  }
};

main().then(() => process.exit(0));
