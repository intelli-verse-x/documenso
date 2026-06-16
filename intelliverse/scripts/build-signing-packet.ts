/**
 * End-to-end verification helper: create a real "signing packet" = ONE envelope
 * (document) that bundles a Project Proposal PDF plus mandatory attached
 * templates (NDA + MSA) as multiple envelope items, with a signer + token, in
 * PENDING state. Prints the /sign/<token> URL so the packet can be signed on the
 * live site, which then seals it into a single binding PDF (certificate + audit).
 *
 * Uses the already-rendered, sample-filled PDFs in contracts/sample-dist so the
 * packet reads like a real contract.
 *
 *   E2E_EMAIL=admin@intelli-verse-x.ai E2E_ORG_URL=intelliverse E2E_TEAM_URL=clients \
 *   E2E_JURISDICTION=us npx tsx intelliverse/scripts/build-signing-packet.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';
import { incrementDocumentId } from '@documenso/lib/server-only/envelope/increment-id';
import { FIELD_DATE_META_DEFAULT_VALUES, FIELD_SIGNATURE_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import { prefixedId } from '@documenso/lib/universal/id';

import { prisma } from '../../packages/prisma';
import {
  DocumentDataType,
  DocumentSource,
  DocumentStatus,
  EnvelopeType,
  FieldType,
  Prisma,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '../../packages/prisma/client';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(SCRIPT_DIR, '../contracts/sample-dist');

const EMAIL = (process.env.E2E_EMAIL || 'admin@intelli-verse-x.ai').toLowerCase();
const ORG_URL = process.env.E2E_ORG_URL || 'intelliverse';
const TEAM_URL = process.env.E2E_TEAM_URL || 'clients';
const JURIS = (process.env.E2E_JURISDICTION || 'us').toLowerCase();

const PACKET = [
  { slug: `client-project-proposal-${JURIS}`, title: `Project Proposal (${JURIS.toUpperCase()})`, primary: true },
  { slug: `client-mutual-nda-${JURIS}`, title: `Mutual NDA (${JURIS.toUpperCase()})`, primary: false },
  { slug: `client-msa-${JURIS}`, title: `Master Services Agreement (${JURIS.toUpperCase()})`, primary: false },
];

const main = async () => {
  const user = await prisma.user.findFirstOrThrow({ where: { email: EMAIL } });
  const team = await prisma.team.findFirstOrThrow({
    where: { url: TEAM_URL, organisation: { url: ORG_URL } },
  });

  const title = `Engagement Packet - ${JURIS.toUpperCase()} (Proposal + NDA + MSA)`;

  // Load the sample-filled PDFs as the packet's documents.
  const items = PACKET.map((entry) => {
    const bytes = readFileSync(join(DIST_DIR, `${entry.slug}.pdf`));
    return { ...entry, base64: bytes.toString('base64') };
  });

  // Page count of the primary doc (Proposal) so we put fields on its signature page.
  const primary = items.find((item) => item.primary)!;
  const primaryPageCount = (await PDFDocument.load(Buffer.from(primary.base64, 'base64'))).getPageCount();

  const documentMeta = await prisma.documentMeta.create({ data: {} });
  const { formattedDocumentId } = await incrementDocumentId();
  const token = prefixedId('recipient');

  // Create document data rows for each item first.
  const itemData = [];
  for (const item of items) {
    const dd = await prisma.documentData.create({
      data: { type: DocumentDataType.BYTES_64, data: item.base64, initialData: item.base64 },
    });
    itemData.push({ ...item, documentDataId: dd.id });
  }

  const envelope = await prisma.envelope.create({
    data: {
      id: prefixedId('envelope'),
      secondaryId: formattedDocumentId,
      internalVersion: 2,
      type: EnvelopeType.DOCUMENT,
      status: DocumentStatus.PENDING,
      title,
      source: DocumentSource.DOCUMENT,
      documentMetaId: documentMeta.id,
      userId: user.id,
      teamId: team.id,
      envelopeItems: {
        create: itemData.map((item, index) => ({
          id: prefixedId('envelope_item'),
          title: item.title,
          documentDataId: item.documentDataId,
          order: index + 1,
        })),
      },
      recipients: {
        create: {
          email: user.email,
          name: user.name || 'Authorized Signatory',
          token,
          sendStatus: SendStatus.SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
          readStatus: ReadStatus.NOT_OPENED,
          role: RecipientRole.SIGNER,
          signingOrder: 1,
        },
      },
    },
    include: { recipients: true, envelopeItems: { orderBy: { order: 'asc' } } },
  });

  const recipient = envelope.recipients[0];
  const primaryItem = envelope.envelopeItems.find((item) => item.title === primary.title)!;

  await prisma.field.createMany({
    data: [
      {
        page: primaryPageCount,
        type: FieldType.SIGNATURE,
        inserted: false,
        customText: '',
        positionX: new Prisma.Decimal(12),
        positionY: new Prisma.Decimal(72),
        width: new Prisma.Decimal(30),
        height: new Prisma.Decimal(7),
        recipientId: recipient.id,
        envelopeId: envelope.id,
        envelopeItemId: primaryItem.id,
        fieldMeta: FIELD_SIGNATURE_META_DEFAULT_VALUES,
      },
      {
        page: primaryPageCount,
        type: FieldType.DATE,
        inserted: false,
        customText: '',
        positionX: new Prisma.Decimal(55),
        positionY: new Prisma.Decimal(72),
        width: new Prisma.Decimal(24),
        height: new Prisma.Decimal(5),
        recipientId: recipient.id,
        envelopeId: envelope.id,
        envelopeItemId: primaryItem.id,
        fieldMeta: FIELD_DATE_META_DEFAULT_VALUES,
      },
    ],
  });

  console.log(`PACKET ${ORG_URL}/${TEAM_URL}: "${title}"`);
  console.log(`  items: ${items.map((i) => i.title).join(' + ')}`);
  console.log(`  envelope: ${envelope.id} (${formattedDocumentId})`);
  console.log(`SIGN_URL /sign/${token}`);
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
