import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import type { TFindTemplatesResponse } from '@documenso/trpc/server/template-router/schema';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { TemplateType } from '~/components/general/template/template-type';

type DashboardTemplatesTableRow = TFindTemplatesResponse['data'][number];

export const DashboardTemplatesTable = () => {
  const { _, i18n } = useLingui();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);

  const { data, isLoading, isLoadingError } = trpc.template.findUserTemplates.useQuery({
    page,
    perPage,
  });

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Title`),
        cell: ({ row }) =>
          row.original.team ? (
            <Link
              to={`${formatTemplatesPath(row.original.team.url)}/${row.original.envelopeId}`}
              className="block max-w-[10rem] cursor-pointer truncate font-medium hover:underline md:max-w-[20rem]"
            >
              {row.original.title}
            </Link>
          ) : (
            <span className="block max-w-[10rem] truncate font-medium md:max-w-[20rem]">{row.original.title}</span>
          ),
      },
      {
        header: _(msg`Team`),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.team?.name ?? '—'}</span>,
      },
      {
        header: _(msg`Type`),
        accessorKey: 'type',
        cell: ({ row }) => <TemplateType type={row.original.type} />,
      },
    ] satisfies DataTableColumnDef<DashboardTemplatesTableRow>[];
  }, [_, i18n]);

  const onPaginationChange = (newPage: number, newPerPage: number) => {
    setPage(newPage);
    setPerPage(newPerPage);
  };

  const results = data ?? {
    data: [],
    perPage,
    currentPage: page,
    totalPages: 1,
  };

  return (
    <DataTable
      columns={columns}
      data={results.data}
      perPage={results.perPage}
      currentPage={results.currentPage}
      totalPages={results.totalPages}
      onPaginationChange={onPaginationChange}
      error={{
        enable: isLoadingError || false,
      }}
      emptyState={
        <div className="flex h-60 flex-col items-center justify-center gap-y-4 text-muted-foreground/60">
          <p>
            <Trans>Templates from your teams will appear here</Trans>
          </p>
        </div>
      }
      skeleton={{
        enable: isLoading || false,
        rows: 5,
        component: (
          <>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-40 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
          </>
        ),
      }}
    >
      {(table) => results.totalPages > 1 && <DataTablePagination additionalInformation="VisibleCount" table={table} />}
    </DataTable>
  );
};
