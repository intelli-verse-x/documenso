import { prisma } from '@documenso/prisma';
import { EnvelopeType, type Prisma } from '@prisma/client';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import type { FindResultResponse } from '../../types/search-params';
import { getTeams } from '../team/get-teams';

export type FindUserTemplatesOptions = {
  userId: number;
  page?: number;
  perPage?: number;
};

/**
 * Find all templates visible to a user across every team they belong to.
 *
 * Unlike `findTemplates` (which is scoped to a single team via the request
 * header), this aggregates templates from all of the user's teams for use on
 * the cross-team home dashboard. Per-team visibility is respected using each
 * team's highest role, with the owner always able to see their own templates.
 */
export const findUserTemplates = async ({ userId, page = 1, perPage = 10 }: FindUserTemplatesOptions) => {
  const teams = await getTeams({ userId });

  if (teams.length === 0) {
    return {
      data: [],
      count: 0,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: 0,
    } satisfies FindResultResponse<[]>;
  }

  const where: Prisma.EnvelopeWhereInput = {
    type: EnvelopeType.TEMPLATE,
    OR: teams.map((team) => ({
      teamId: team.id,
      OR: [
        {
          visibility: {
            in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
          },
        },
        { userId },
      ],
    })),
  };

  const templateInclude = {
    team: {
      select: {
        id: true,
        url: true,
        name: true,
      },
    },
    fields: true,
    recipients: true,
    documentMeta: true,
    directLink: {
      select: {
        token: true,
        enabled: true,
      },
    },
  } as const;

  const [data, count] = await Promise.all([
    prisma.envelope.findMany({
      where,
      include: templateInclude,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.envelope.count({ where }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
