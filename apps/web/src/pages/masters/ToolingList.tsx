/** Pattern / Die / Tool register — `P.tooling`, with the life-used bar. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TOOL_TYPE, TOOL_STATUS } from '@erp/shared';
import { api } from '@/lib/api';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { DataTable, type Column } from '@/components/DataTable';
import {
  PageHeader, Card, CardHead, Split, Toolbar, SearchField, SelectField, Chips,
  TableFooter, Badge, Button, MonoLink, CellStack, Empty, LifeBar, Alert,
  SectionTitle, BigStat,
} from '@/components/ui';

export type ToolRow = {
  id: string; code: string; type: string; description: string;
  part: { id: string; partNo: string; name: string } | null;
  material: string | null; cavities: number;
  lifeShots: number; usedShots: number; lifeUsedPct: number; lifeTone: string;
  remainingShots: number; location: string | null; status: string; revision: string | null;
};

export function ToolingList() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'code', dir: 'asc' });

  useDocumentTitle('Pattern / Die / Tool');
  const debouncedQ = useDebounced(q);

  const params = { q: debouncedQ, type, status, page, pageSize, sort: sort.key, dir: sort.dir };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tools', params],
    queryFn: () => api.list<ToolRow>('/masters/tools', params),
    placeholderData: (prev) => prev,
  });

  const facet = (s: string) => data?.facets?.[s.toUpperCase().replace(/[^A-Z0-9]+/g, '_')] ?? 0;
  const chips = [
    { value: '', label: 'All', count: data?.total },
    ...TOOL_STATUS.map((s) => ({ value: s, label: s, count: facet(s) })),
  ];

  const needsAttention = facet('Maintenance Due') + facet('Under Repair');

  const columns: Column<ToolRow>[] = [
    { header: 'Tool Code', sortKey: 'code', cell: (t) => <MonoLink to={`/app/masters/tooling/${t.id}`}>{t.code}</MonoLink> },
    { header: 'Type', sortKey: 'type', cell: (t) => t.type },
    { header: 'Description', cell: (t) => <CellStack main={t.description} sub={t.part?.partNo} subMono /> },
    { header: 'Material', cell: (t) => t.material ?? '—' },
    { header: 'Cav.', numeric: true, cell: (t) => t.cavities },
    { header: 'Life Used', sortKey: 'usedShots', cell: (t) => <LifeBar pct={t.lifeUsedPct} tone={t.lifeTone} /> },
    { header: 'Remaining', numeric: true, cell: (t) => t.remainingShots.toLocaleString('en-IN') },
    { header: 'Location', cell: (t) => t.location ?? '—' },
    { header: 'Status', sortKey: 'status', cell: (t) => <Badge status={t.status} /> },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Products & Masters' }, { label: 'Pattern / Die / Tool' }]}
        title="Pattern, Die & Tool Register"
        subtitle="Tooling with rated life, location and condition"
        actions={
          <>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="add" to="/app/masters/tooling/new">Add Tool</Button>
          </>
        }
      />

      <Split
        main={
          <Card>
            <CardHead title="Tooling" />
            <Toolbar>
              <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search code, description, location…" />
              <SelectField
                label="Type" value={type}
                onChange={(v) => { setType(v); setPage(1); }}
                options={[{ value: '', label: 'All types' }, ...TOOL_TYPE.map((t) => ({ value: t, label: t }))]}
              />
            </Toolbar>
            <Chips options={chips} active={status} onChange={(v) => { setStatus(v); setPage(1); }} />

            <div className={isFetching && !isLoading ? 'page-loading' : undefined}>
              <DataTable
                columns={columns}
                rows={data?.rows ?? []}
                rowKey={(t) => t.id}
                rowHref={(t) => `/app/masters/tooling/${t.id}`}
                loading={isLoading}
                sort={sort}
                onSortChange={(key, dir) => setSort({ key, dir })}
                empty={
                  <Empty
                    icon="handyman"
                    title={q || status ? 'No tooling matches these filters' : 'No tooling yet'}
                    body="Register the patterns, core boxes, dies and fixtures this works uses."
                    action={<Button variant="primary" icon="add" to="/app/masters/tooling/new">Add Tool</Button>}
                  />
                }
              />
            </div>

            {data && data.total > 0 ? (
              <TableFooter
                page={page} pageSize={pageSize} total={data.total}
                onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }}
              />
            ) : null}
          </Card>
        }
        aside={
          <>
            <Card bodyPadded className="sum">
              <h2>Tooling Summary</h2>
              <BigStat
                value={data?.total ?? 0}
                secondary={`/${facet('In Use')}`}
                note="Total tools / currently in use"
              />
            </Card>

            {needsAttention > 0 ? (
              <Card bodyPadded>
                <SectionTitle>Attention</SectionTitle>
                <Alert tone="warn" title={`${needsAttention} tool${needsAttention > 1 ? 's' : ''} need attention`}>
                  {facet('Maintenance Due')} due for maintenance, {facet('Under Repair')} under repair.
                  Tools are flagged automatically once 85 % of rated life is consumed.
                </Alert>
              </Card>
            ) : null}
          </>
        }
      />
    </>
  );
}
