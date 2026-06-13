import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb, StandardFonts } from '@cantoo/pdf-lib';
import { incrementTemplateId } from '@documenso/lib/server-only/envelope/increment-id';
import { FIELD_DATE_META_DEFAULT_VALUES, FIELD_SIGNATURE_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
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
};

// Intelliverse set (from intelliverse/contracts/templates.manifest.json) plus a
// Toba Tech client set so both companies have signable contract templates.
const SPECS: TemplateSpec[] = [
  { file: 'client/mutual-nda-us.md', title: 'Mutual NDA (US)', orgUrl: 'intelliverse', teamUrl: 'clients' },
  { file: 'client/msa-us.md', title: 'Master Services Agreement (US)', orgUrl: 'intelliverse', teamUrl: 'clients' },
  { file: 'client/sow-us.md', title: 'Statement of Work (US)', orgUrl: 'intelliverse', teamUrl: 'clients' },
  { file: 'client/msa-in.md', title: 'Master Services Agreement (India)', orgUrl: 'intelliverse', teamUrl: 'clients' },
  {
    file: 'people/employee-us.md',
    title: 'Employment Offer & Agreement - At-Will (US)',
    orgUrl: 'intelliverse',
    teamUrl: 'people',
  },
  {
    file: 'people/contractor-us.md',
    title: 'Independent Contractor Agreement (US)',
    orgUrl: 'intelliverse',
    teamUrl: 'people',
  },
  { file: 'people/employee-in.md', title: 'Employment Agreement (India)', orgUrl: 'intelliverse', teamUrl: 'people' },
  {
    file: 'client/ip-assignment-piia-us.md',
    title: 'IP Assignment + Confidentiality / PIIA (US)',
    orgUrl: 'intelliverse',
    teamUrl: 'people',
  },
  { file: 'client/msa-us.md', title: 'Master Services Agreement (US)', orgUrl: 'toba-tech', teamUrl: 'contracts' },
  { file: 'client/mutual-nda-us.md', title: 'Mutual NDA (US)', orgUrl: 'toba-tech', teamUrl: 'contracts' },
  { file: 'client/sow-us.md', title: 'Statement of Work (US)', orgUrl: 'toba-tech', teamUrl: 'contracts' },
];

const stripMarkdown = (md: string): string =>
  md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\|/g, '  ')
    .replace(/^-{3,}$/gm, '')
    .replace(/\r/g, '');

const renderPdf = async (text: string, title: string): Promise<{ bytes: string; pageCount: number }> => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  const fontSize = 10;
  const lineHeight = 14;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const drawLine = (line: string, useBold = false) => {
    if (y < margin + lineHeight) {
      newPage();
    }
    page.drawText(line, {
      x: margin,
      y,
      size: useBold ? 12 : fontSize,
      font: useBold ? bold : font,
      color: rgb(0.06, 0.09, 0.16),
    });
    y -= useBold ? lineHeight + 6 : lineHeight;
  };

  const wrap = (paragraph: string): string[] => {
    const words = paragraph.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
        if (current) {
          lines.push(current);
        }
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) {
      lines.push(current);
    }
    return lines;
  };

  drawLine(title, true);
  y -= 6;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      y -= lineHeight / 2;
      continue;
    }
    for (const wrapped of wrap(line)) {
      drawLine(wrapped);
    }
  }

  const bytes = await pdf.saveAsBase64();
  return { bytes, pageCount: pdf.getPageCount() };
};

const main = async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { email: 'admin@documenso.com' } });

  for (const spec of SPECS) {
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

    if (existing) {
      console.log(`EXISTS ${spec.orgUrl}/${spec.teamUrl}: ${spec.title}`);
      continue;
    }

    const md = fs.readFileSync(path.join(CONTRACTS_DIR, spec.file), 'utf8');
    const { bytes, pageCount } = await renderPdf(stripMarkdown(md), spec.title);

    const documentData = await prisma.documentData.create({
      data: { type: DocumentDataType.BYTES_64, data: bytes, initialData: bytes },
    });

    const templateId = await incrementTemplateId();
    const documentMeta = await prisma.documentMeta.create({ data: {} });

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
          create: {
            email: 'signer@documenso.com',
            name: 'Signer',
            token: prefixedId('recipient'),
            sendStatus: SendStatus.NOT_SENT,
            signingStatus: SigningStatus.NOT_SIGNED,
            readStatus: ReadStatus.NOT_OPENED,
            role: RecipientRole.SIGNER,
            signingOrder: 1,
          },
        },
      },
      include: { recipients: true, envelopeItems: true },
    });

    const recipient = template.recipients[0];
    const item = template.envelopeItems[0];

    await prisma.field.createMany({
      data: [
        {
          page: pageCount,
          type: FieldType.SIGNATURE,
          inserted: false,
          customText: '',
          positionX: new Prisma.Decimal(10),
          positionY: new Prisma.Decimal(82),
          width: new Prisma.Decimal(32),
          height: new Prisma.Decimal(8),
          recipientId: recipient.id,
          envelopeId: template.id,
          envelopeItemId: item.id,
          fieldMeta: FIELD_SIGNATURE_META_DEFAULT_VALUES,
        },
        {
          page: pageCount,
          type: FieldType.DATE,
          inserted: false,
          customText: '',
          positionX: new Prisma.Decimal(58),
          positionY: new Prisma.Decimal(82),
          width: new Prisma.Decimal(26),
          height: new Prisma.Decimal(6),
          recipientId: recipient.id,
          envelopeId: template.id,
          envelopeItemId: item.id,
          fieldMeta: FIELD_DATE_META_DEFAULT_VALUES,
        },
      ],
    });

    console.log(`CREATED ${spec.orgUrl}/${spec.teamUrl}: ${spec.title} (${pageCount}p)`);
  }
};

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
