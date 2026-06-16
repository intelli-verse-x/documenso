import { prisma } from '../../packages/prisma';

const ID = process.env.ENVELOPE_ID || '';

const main = async () => {
  const env = await prisma.envelope.findFirstOrThrow({
    where: { id: ID },
    include: {
      recipients: true,
      envelopeItems: { orderBy: { order: 'asc' }, include: { documentData: true } },
      _count: { select: { auditLogs: true } },
    },
  });

  console.log(`title: ${env.title}`);
  console.log(`status: ${env.status}`);
  console.log(`completedAt: ${env.completedAt?.toISOString() ?? '(none)'}`);
  console.log(
    `recipients signed: ${env.recipients.filter((r) => r.signingStatus === 'SIGNED').length}/${env.recipients.length}`,
  );
  console.log(`audit logs: ${env._count.auditLogs}`);
  for (const item of env.envelopeItems) {
    const initial = item.documentData.initialData?.length ?? 0;
    const sealed = item.documentData.data?.length ?? 0;
    const resealed = item.documentData.data !== item.documentData.initialData;
    console.log(`  - ${item.title}: initial=${initial} sealed=${sealed} resealed=${resealed ? 'YES' : 'no'}`);
  }
};

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
