import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb, StandardFonts } from '@cantoo/pdf-lib';
import { incrementTemplateId } from '@documenso/lib/server-only/envelope/increment-id';
import {
  FIELD_DATE_META_DEFAULT_VALUES,
  FIELD_SIGNATURE_META_DEFAULT_VALUES,
  FIELD_TEXT_META_DEFAULT_VALUES,
} from '@documenso/lib/types/field-meta';
import { prefixedId } from '@documenso/lib/universal/id';

import { prisma } from '..';
import {
  DocumentDataType,
  DocumentSource,
  EnvelopeType,
  FieldType,
  Prisma,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '../client';

const CONTRACTS_DIR = path.join(__dirname, '../../../intelliverse/contracts');

type TemplateSpec = {
  file: string;
  title: string;
  teamUrl: string;
  orgUrl: string;
  counterpartyRole: string;
};

type DocSpec = { file: string; title: string; counterpartyRole: string };

// Full contract set mirrored across both companies (kept in sync with
// intelliverse/contracts/templates.manifest.json). Client-facing docs live in
// Intelliverse "clients" / Toba "contracts"; people/HR docs live in each org's
// "people" team. Both companies get the complete set (US + India variants).
type OrgTeam = { orgUrl: string; teamUrl: string };

const CLIENT_DOCS: DocSpec[] = [
  { file: 'client/mutual-nda-us.md', title: 'Mutual NDA (US)', counterpartyRole: 'Counterparty' },
  { file: 'client/mutual-nda-in.md', title: 'Mutual NDA (India)', counterpartyRole: 'Counterparty' },
  { file: 'client/msa-us.md', title: 'Master Services Agreement (US)', counterpartyRole: 'Client' },
  { file: 'client/msa-in.md', title: 'Master Services Agreement (India)', counterpartyRole: 'Client' },
  { file: 'client/sow-us.md', title: 'Statement of Work (US)', counterpartyRole: 'Client' },
  { file: 'client/sow-in.md', title: 'Statement of Work (India)', counterpartyRole: 'Client' },
  { file: 'client/project-proposal-us.md', title: 'Project Proposal (US)', counterpartyRole: 'Client' },
  { file: 'client/project-proposal-in.md', title: 'Project Proposal (India)', counterpartyRole: 'Client' },
];

const PEOPLE_DOCS: DocSpec[] = [
  {
    file: 'client/ip-assignment-piia-us.md',
    title: 'IP Assignment + Confidentiality / PIIA (US)',
    counterpartyRole: 'Signer',
  },
  {
    file: 'client/ip-assignment-piia-in.md',
    title: 'Confidentiality + IP Assignment (India)',
    counterpartyRole: 'Signer',
  },
  { file: 'people/employee-us.md', title: 'Employment Offer & Agreement - At-Will (US)', counterpartyRole: 'Employee' },
  { file: 'people/contractor-us.md', title: 'Independent Contractor Agreement (US)', counterpartyRole: 'Contractor' },
  { file: 'people/employee-in.md', title: 'Employment Agreement (India)', counterpartyRole: 'Employee' },
  {
    file: 'people/contractor-in.md',
    title: 'Consultancy / Contractor Agreement (India)',
    counterpartyRole: 'Consultant',
  },
];

// Each org's client-facing team url (Intelliverse uses "clients", Toba "contracts").
const ORG_CLIENT_TEAM: OrgTeam[] = [
  { orgUrl: 'intelliverse', teamUrl: 'clients' },
  { orgUrl: 'toba-tech', teamUrl: 'contracts' },
];
const ORG_PEOPLE_TEAM: OrgTeam[] = [
  { orgUrl: 'intelliverse', teamUrl: 'people' },
  { orgUrl: 'toba-tech', teamUrl: 'people' },
];

const SPECS: TemplateSpec[] = [
  ...ORG_CLIENT_TEAM.flatMap(({ orgUrl, teamUrl }) => CLIENT_DOCS.map((doc) => ({ ...doc, orgUrl, teamUrl }))),
  ...ORG_PEOPLE_TEAM.flatMap(({ orgUrl, teamUrl }) => PEOPLE_DOCS.map((doc) => ({ ...doc, orgUrl, teamUrl }))),
];

// Company-constant placeholder values that are baked into the PDF (never become
// fillable fields) because they are the same for every document the company
// sends. Everything else stays a {{placeholder}} and becomes a sender-fillable
// TEXT field. Keyed by org url, then jurisdiction (us/in).
type Profile = Record<string, string>;

const COMPANY_PROFILE: Record<string, { us: Profile; in: Profile }> = {
  intelliverse: {
    us: {
      CompanyLegalName: 'Intelliverse, Inc.',
      CompanyState: 'Delaware',
      CompanyEntityType: 'corporation',
      CompanyAddress: '548 Market Street, Suite 95, San Francisco, CA 94104, USA',
      GoverningState: 'California',
      Venue: 'San Francisco County, California',
      Jurisdiction: 'San Francisco County, California',
      StateStatuteNotice: 'California Labor Code Section 2870 applies to this Agreement.',
    },
    in: {
      CompanyLegalName: 'Intelliverse Technologies Private Limited',
      CompanyAddress: 'No. 42, 4th Floor, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038, India',
      PlaceOfExecution: 'Bengaluru, Karnataka',
      ArbitrationSeat: 'Bengaluru, Karnataka',
      Jurisdiction: 'Bengaluru, Karnataka',
    },
  },
  'toba-tech': {
    us: {
      CompanyLegalName: 'Toba Tech, Inc.',
      CompanyState: 'Delaware',
      CompanyEntityType: 'corporation',
      CompanyAddress: '2261 Market Street, Suite 5120, San Francisco, CA 94114, USA',
      GoverningState: 'California',
      Venue: 'San Francisco County, California',
      Jurisdiction: 'San Francisco County, California',
      StateStatuteNotice: 'California Labor Code Section 2870 applies to this Agreement.',
    },
    in: {
      CompanyLegalName: 'Toba Tech Private Limited',
      CompanyAddress: 'WeWork Galaxy, 43 Residency Road, Bengaluru, Karnataka 560025, India',
      PlaceOfExecution: 'Bengaluru, Karnataka',
      ArbitrationSeat: 'Bengaluru, Karnataka',
      Jurisdiction: 'Bengaluru, Karnataka',
    },
  },
};

export const bakeFor = (orgUrl: string, file: string): Profile => {
  const profile = COMPANY_PROFILE[orgUrl];
  if (!profile) {
    return {};
  }
  return file.endsWith('-in.md') ? profile.in : profile.us;
};

const stripMarkdown = (md: string): string =>
  md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*]\s+/gm, '\u2022 ')
    .replace(/\|/g, '  ')
    .replace(/^-{3,}$/gm, '')
    .replace(/\r/g, '');

const humanizeLabel = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/\bDesc\b/g, 'Description')
    .replace(/\bResp\b/g, 'Responsibilities')
    .trim();

const blankWidthFor = (name: string): number => {
  const n = name.toLowerCase();
  if (/address/.test(n)) {
    return 230;
  }
  if (
    /(summary|background|objectives|assumptions|nextsteps|scope|desc|acceptance|dependency|resp|requirements|contingencies|service|invoicing|pricingmodel|benefits|leavepolicy|bonus|outofscope|deliverable)/.test(
      n,
    )
  ) {
    return 260;
  }
  if (/date/.test(n)) {
    return 95;
  }
  if (/(fees|salary|ctc|rates|amount)/.test(n)) {
    return 110;
  }
  if (/(days|months|rate|number|cap|period|validity)/.test(n)) {
    return 70;
  }
  if (/(name|manager|lead|sponsor)/.test(n)) {
    return 150;
  }
  return 130;
};

type PlacedField = {
  name: string;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

type RenderResult = { bytes: string; pageCount: number; fields: PlacedField[] };

export const renderPdf = async (markdown: string, title: string, bake: Profile): Promise<RenderResult> => {
  // Bake company-constant values into the text first; remaining {{...}} are fields.
  let text = markdown;
  for (const [key, value] of Object.entries(bake)) {
    text = text.replaceAll(`{{${key}}}`, value);
  }
  text = stripMarkdown(text);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  const fontSize = 10;
  const lineHeight = 14;
  const spaceWidth = font.widthOfTextAtSize(' ', fontSize);

  const fields: PlacedField[] = [];
  let page = pdf.addPage([pageWidth, pageHeight]);
  let pageNumber = 1;
  let y = pageHeight - margin;

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    pageNumber += 1;
    y = pageHeight - margin;
  };

  type Item = { type: 'text'; word: string } | { type: 'fill'; name: string; width: number };

  const tokenize = (line: string): Item[] => {
    const items: Item[] = [];
    for (const part of line.split(/(\{\{[A-Za-z0-9_]+\}\})/)) {
      const match = part.match(/^\{\{([A-Za-z0-9_]+)\}\}$/);
      if (match) {
        items.push({ type: 'fill', name: match[1], width: Math.min(blankWidthFor(match[1]), maxWidth) });
      } else {
        for (const word of part.split(/\s+/)) {
          if (word) {
            items.push({ type: 'text', word });
          }
        }
      }
    }
    return items;
  };

  const drawParagraph = (items: Item[]) => {
    if (y < margin + lineHeight) {
      newPage();
    }
    let x = margin;
    let firstOnLine = true;

    for (const item of items) {
      const itemWidth = item.type === 'fill' ? item.width : font.widthOfTextAtSize(item.word, fontSize);
      const needed = (firstOnLine ? 0 : spaceWidth) + itemWidth;

      if (!firstOnLine && x + needed > margin + maxWidth) {
        y -= lineHeight;
        if (y < margin + lineHeight) {
          newPage();
        }
        x = margin;
        firstOnLine = true;
      }

      if (!firstOnLine) {
        x += spaceWidth;
      }

      if (item.type === 'fill') {
        const topFromBottom = y + fontSize * 0.85;
        const heightPt = fontSize + 4;
        fields.push({
          name: item.name,
          page: pageNumber,
          positionX: (x / pageWidth) * 100,
          positionY: ((pageHeight - topFromBottom) / pageHeight) * 100,
          width: (itemWidth / pageWidth) * 100,
          height: (heightPt / pageHeight) * 100,
        });
        page.drawLine({
          start: { x, y: y - 2 },
          end: { x: x + itemWidth, y: y - 2 },
          thickness: 0.5,
          color: rgb(0.62, 0.64, 0.72),
        });
      } else {
        page.drawText(item.word, { x, y, size: fontSize, font, color: rgb(0.06, 0.09, 0.16) });
      }

      x += itemWidth;
      firstOnLine = false;
    }

    y -= lineHeight;
    if (y < margin + lineHeight) {
      newPage();
    }
  };

  // Title.
  page.drawText(title, { x: margin, y, size: 14, font: bold, color: rgb(0.06, 0.09, 0.16) });
  y -= lineHeight + 12;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();

    if (/page-break-before/.test(line)) {
      newPage();
      continue;
    }
    if (!line.trim()) {
      y -= lineHeight / 2;
      continue;
    }

    drawParagraph(tokenize(line));
  }

  const bytes = await pdf.saveAsBase64();
  return { bytes, pageCount: pdf.getPageCount(), fields };
};

// Signature/date field layout on the last (signature) page, percentages, top-left.
const SIGNATURE_LAYOUT = {
  company: {
    signature: { x: 12, y: 30, w: 35, h: 8 },
    date: { x: 60, y: 30, w: 26, h: 5 },
  },
  counterparty: {
    signature: { x: 12, y: 62, w: 35, h: 8 },
    date: { x: 60, y: 62, w: 26, h: 5 },
  },
};

const main = async () => {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@documenso.com').toLowerCase();
  const admin = await prisma.user.findFirstOrThrow({ where: { email: adminEmail } });

  // Each company runs as its own deployment + database; scope to one org when
  // COMPANY is set (e.g. COMPANY=toba-tech against the Toba DB).
  const only = process.env.COMPANY?.toLowerCase();
  // REBUILD=1 replaces existing templates (needed when the field layout changes).
  const rebuild = process.env.REBUILD === '1' || process.env.REBUILD === 'true';
  const specs = only ? SPECS.filter((spec) => spec.orgUrl === only) : SPECS;

  for (const spec of specs) {
    const team = await prisma.team.findFirst({
      where: { url: spec.teamUrl, organisation: { url: spec.orgUrl } },
    });

    if (!team) {
      console.log(`SKIP (no team) ${spec.orgUrl}/${spec.teamUrl}: ${spec.title}`);
      continue;
    }

    const existing = await prisma.envelope.findFirst({
      where: { teamId: team.id, type: EnvelopeType.TEMPLATE, title: spec.title },
    });

    if (existing && !rebuild) {
      console.log(`EXISTS ${spec.orgUrl}/${spec.teamUrl}: ${spec.title}`);
      continue;
    }

    if (existing && rebuild) {
      await prisma.envelope.delete({ where: { id: existing.id } });
    }

    const md = fs.readFileSync(path.join(CONTRACTS_DIR, spec.file), 'utf8');
    const { bytes, pageCount, fields } = await renderPdf(md, spec.title, bakeFor(spec.orgUrl, spec.file));

    const documentData = await prisma.documentData.create({
      data: { type: DocumentDataType.BYTES_64, data: bytes, initialData: bytes },
    });

    const templateId = await incrementTemplateId();
    const documentMeta = await prisma.documentMeta.create({ data: {} });

    const companyName = bakeFor(spec.orgUrl, spec.file).CompanyLegalName ?? 'Company';

    const template = await prisma.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId: templateId.formattedTemplateId,
        internalVersion: 1,
        type: EnvelopeType.TEMPLATE,
        title: spec.title,
        source: DocumentSource.TEMPLATE,
        documentMetaId: documentMeta.id,
        userId: admin.id,
        teamId: team.id,
        envelopeItems: {
          create: {
            id: prefixedId('envelope_item'),
            title: spec.title,
            documentDataId: documentData.id,
            order: 1,
          },
        },
        recipients: {
          create: [
            {
              email: 'recipient.1@documenso.com',
              name: companyName,
              token: prefixedId('recipient'),
              sendStatus: SendStatus.NOT_SENT,
              signingStatus: SigningStatus.NOT_SIGNED,
              readStatus: ReadStatus.NOT_OPENED,
              role: RecipientRole.SIGNER,
              signingOrder: 1,
            },
            {
              email: 'recipient.2@documenso.com',
              name: spec.counterpartyRole,
              token: prefixedId('recipient'),
              sendStatus: SendStatus.NOT_SENT,
              signingStatus: SigningStatus.NOT_SIGNED,
              readStatus: ReadStatus.NOT_OPENED,
              role: RecipientRole.SIGNER,
              signingOrder: 2,
            },
          ],
        },
      },
      include: { recipients: { orderBy: { signingOrder: 'asc' } }, envelopeItems: true },
    });

    const companyRecipient = template.recipients[0];
    const counterpartyRecipient = template.recipients[1];
    const item = template.envelopeItems[0];

    // Sender (Company) fills every {{placeholder}} text field before the
    // counterparty signs, so the counterparty receives a fully completed document.
    const textFields = fields.map((field) => ({
      page: field.page,
      type: FieldType.TEXT,
      inserted: false,
      customText: '',
      positionX: new Prisma.Decimal(field.positionX.toFixed(3)),
      positionY: new Prisma.Decimal(field.positionY.toFixed(3)),
      width: new Prisma.Decimal(field.width.toFixed(3)),
      height: new Prisma.Decimal(field.height.toFixed(3)),
      recipientId: companyRecipient.id,
      envelopeId: template.id,
      envelopeItemId: item.id,
      fieldMeta: {
        ...FIELD_TEXT_META_DEFAULT_VALUES,
        label: humanizeLabel(field.name),
        placeholder: humanizeLabel(field.name),
        required: true,
      },
    }));

    const signatureField = (recipientId: number, box: { x: number; y: number; w: number; h: number }) => ({
      page: pageCount,
      type: FieldType.SIGNATURE,
      inserted: false,
      customText: '',
      positionX: new Prisma.Decimal(box.x),
      positionY: new Prisma.Decimal(box.y),
      width: new Prisma.Decimal(box.w),
      height: new Prisma.Decimal(box.h),
      recipientId,
      envelopeId: template.id,
      envelopeItemId: item.id,
      fieldMeta: FIELD_SIGNATURE_META_DEFAULT_VALUES,
    });

    const dateField = (recipientId: number, box: { x: number; y: number; w: number; h: number }) => ({
      page: pageCount,
      type: FieldType.DATE,
      inserted: false,
      customText: '',
      positionX: new Prisma.Decimal(box.x),
      positionY: new Prisma.Decimal(box.y),
      width: new Prisma.Decimal(box.w),
      height: new Prisma.Decimal(box.h),
      recipientId,
      envelopeId: template.id,
      envelopeItemId: item.id,
      fieldMeta: FIELD_DATE_META_DEFAULT_VALUES,
    });

    await prisma.field.createMany({
      data: [
        ...textFields,
        signatureField(companyRecipient.id, SIGNATURE_LAYOUT.company.signature),
        dateField(companyRecipient.id, SIGNATURE_LAYOUT.company.date),
        signatureField(counterpartyRecipient.id, SIGNATURE_LAYOUT.counterparty.signature),
        dateField(counterpartyRecipient.id, SIGNATURE_LAYOUT.counterparty.date),
      ],
    });

    const verb = existing && rebuild ? 'REBUILT' : 'CREATED';
    console.log(
      `${verb} ${spec.orgUrl}/${spec.teamUrl}: ${spec.title} (${pageCount}p, ${textFields.length} fill fields)`,
    );
  }
};

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
