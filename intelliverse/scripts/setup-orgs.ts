/**
 * Idempotent setup of the Intelliverse + Toba Tech organisations, their teams,
 * and per-tenant signing/email branding (logo colors, company details, brand
 * URL). Run AFTER the app is deployed and the first admin user exists.
 *
 * Per-tenant branding here is what clients see on signing pages and in emails
 * (org/team `OrganisationGlobalSettings`). The app-shell branding is handled
 * separately and is hostname-aware (see apps/remix/app/utils/branding).
 *
 * Logos: this script sets colors + company details + brand URL. Upload the
 * actual logo image per org via the UI (Settings -> Branding) once, or extend
 * this script to call putFileServerSide. Billing must be disabled
 * (NEXT_PUBLIC_FEATURE_BILLING_ENABLED=false) so branding is unlocked and team
 * limits are not enforced.
 *
 * Usage (from repo root, with the app's DATABASE_URL in env):
 *   ADMIN_EMAIL=you@intelli-verse-x.ai npx tsx intelliverse/scripts/setup-orgs.ts
 */
import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { getSubscriptionClaim } from '@documenso/lib/server-only/subscription/get-subscription-claim';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { INTERNAL_CLAIM_ID, type TClaimFlags } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';
import { OrganisationType, type SubscriptionClaim } from '@prisma/client';

type BrandColors = {
  primary: string;
  primaryForeground: string;
  ring: string;
};

type TenantSpec = {
  name: string;
  url: string;
  brandingUrl: string;
  companyDetails: string;
  colors: BrandColors;
  teams: { name: string; url: string }[];
};

const TENANTS: TenantSpec[] = [
  {
    name: 'Intelliverse',
    url: 'intelliverse',
    brandingUrl: 'https://intelli-verse-x.ai',
    companyDetails: 'Intelliverse\nhttps://intelli-verse-x.ai',
    colors: {
      primary: '#6d5ef6',
      primaryForeground: '#ffffff',
      ring: '#6d5ef6',
    },
    teams: [
      { name: 'Clients', url: 'clients' },
      { name: 'Employees & Contractors', url: 'people' },
    ],
  },
  {
    name: 'Toba Tech',
    url: 'toba-tech',
    brandingUrl: 'https://toba-tech.ai',
    companyDetails: 'Toba Tech\nhttps://toba-tech.ai',
    colors: {
      primary: '#0d9488',
      primaryForeground: '#ffffff',
      ring: '#0d9488',
    },
    teams: [{ name: 'Contracts', url: 'contracts' }],
  },
];

// Branding feature flags enabled for both tenants so "Powered by" is hidden and
// custom branding/white-label signing is available.
const BRANDING_FLAGS: TClaimFlags = {
  allowCustomBranding: true,
  hidePoweredBy: true,
  embedSigning: true,
  embedSigningWhiteLabel: true,
  unlimitedDocuments: true,
};

const buildClaim = async (): Promise<Omit<SubscriptionClaim, 'createdAt' | 'updatedAt'>> => {
  const base = await getSubscriptionClaim(INTERNAL_CLAIM_ID.FREE).catch(() => null);

  if (base) {
    return {
      ...base,
      teamCount: 0, // 0 = unlimited
      flags: { ...(base.flags as TClaimFlags), ...BRANDING_FLAGS },
    };
  }

  // Fallback if claims were never seeded: a permissive self-host claim.
  return {
    id: INTERNAL_CLAIM_ID.FREE,
    name: 'Intelliverse Self-Host',
    locked: false,
    teamCount: 0,
    memberCount: 0,
    envelopeItemCount: 0,
    recipientCount: 0,
    documentQuota: 0,
    emailQuota: 0,
    documentRateLimits: [],
    emailRateLimits: [],
    apiRateLimits: [],
    apiQuota: 0,
    emailTransportId: null,
    flags: BRANDING_FLAGS,
  } as unknown as Omit<SubscriptionClaim, 'createdAt' | 'updatedAt'>;
};

const main = async () => {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();

  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL env var is required (the admin user that will own the organisations).');
  }

  const admin = await prisma.user.findFirst({ where: { email: adminEmail } });

  if (!admin) {
    throw new Error(`No user found with email ${adminEmail}. Create the admin user first.`);
  }

  const claim = await buildClaim();

  for (const tenant of TENANTS) {
    let organisation = await prisma.organisation.findFirst({ where: { url: tenant.url } });

    if (!organisation) {
      console.log(`Creating organisation "${tenant.name}" (${tenant.url})`);
      organisation = await createOrganisation({
        name: tenant.name,
        url: tenant.url,
        type: OrganisationType.ORGANISATION,
        userId: admin.id,
        claim,
      });
    } else {
      console.log(`Organisation "${tenant.name}" already exists, updating branding`);
    }

    // Per-tenant signing/email branding.
    await prisma.organisation.update({
      where: { id: organisation.id },
      data: {
        organisationGlobalSettings: {
          update: {
            brandingEnabled: true,
            brandingUrl: tenant.brandingUrl,
            brandingCompanyDetails: tenant.companyDetails,
            brandingColors: tenant.colors,
          },
        },
      },
    });

    // Teams.
    for (const team of tenant.teams) {
      const existing = await prisma.team.findFirst({
        where: { organisationId: organisation.id, url: team.url },
      });

      if (existing) {
        console.log(`  Team "${team.name}" already exists`);
        continue;
      }

      console.log(`  Creating team "${team.name}" (${team.url})`);
      await createTeam({
        userId: admin.id,
        teamName: team.name,
        teamUrl: team.url,
        organisationId: organisation.id,
        inheritMembers: true,
      });
    }
  }

  console.log('\nDone. Upload each org logo via Settings -> Branding if not already set.');
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
