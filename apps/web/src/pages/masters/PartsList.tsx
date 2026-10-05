/**
 * Part Master register. Mirrors `P.parts` in the prototype: toolbar filters,
 * status chips driven by the API's facets, the register table, and the
 * right-hand Part Summary stack.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PART_STATUS, CASTING_PROCESS, nf, type Paginated } from '@erp/shared';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { DataTable, type Column } from '@/components/DataTable';
import {
  PageHeader, Card, CardHead, Split, Toolbar, SearchField, SelectField, Chips,
  Segmented, TableFooter, Badge, Button, MonoLink, CellStack, BigStat, Legend,
  SectionTitle, BarRow, Empty, Mono,
} from '@/components/ui';

export type PartRow = {
  id: string;
  partNo: string;
  name: string;
  status: string;
  customer: { id: string; name: string } | null;
  customerPartNo: string;
  alloy: { id: string; code: string; name: string } | null;
  castingWeightKg: number;
  machinedWeightKg: number | null;
  castingProcess: string | null;
  drawingNo: string | null;
  currentRevision: string | null;
};

export function PartsList() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [alloyId, setAlloyId] = useState('');
  const [process, setProcess] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'partNo', dir: 'asc' });
  const [view, setView] = useState('List');

  const debouncedQ = useDebounced(q, 250);

  const params = {
    q: debouncedQ, status, alloyId, castingProcess: process,
    page, pageSize, sort: sort.key, dir: sort.dir,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['parts', params],
    queryFn: () => api.list<PartRow>('/masters/parts', params),
    // Keeps the previous page visible while the next one loads, so the table
    // does not collapse to skeletons on every keystroke.
    placeholderData: (prev) => prev,
  });

  const { data: alloys } = useQuery({
    queryKey: ['alloy-options'],
    queryFn: () => api.list<{ id: string; code: string; name: string }>('/masters/alloys', { pageSize: 200 }),
    staleTime: 5 * 60_000,
  });

  const chips = useMemo(() => {
    const f = data?.facets ?? {};
    // Facet keys come back in the DB spelling; map them to the display labels.
    const count = (s: string) => f[s.toUpperCase().replace(/[^A-Z0-9]+/g, '_')];
    return [
      { value: '', label: 'All', count: data?.total },
      ...PART_STATUS.map((s) => ({ value: s, label: s, count: count(s) ?? 0 })),
    ];
  }, [data?.facets, data?.total]);

  const columns: Column<PartRow>[] = [
    {
      header: 'Part No', sortKey: 'partNo',
      cell: (r) => <MonoLink to={`/app/masters/parts/${r.id}`}>{r.partNo}</MonoLink>,
    },
    {
      header: 'Part Name', sortKey: 'name',
      cell: (r) => <CellStack main={r.name} sub={r.customer?.name} />,
    },
    {
      header: 'Customer Part No', sortKey: 'customerPartNo',
      cell: (r) => <Mono>{r.customerPartNo}</Mono>,
    },
    { header: 'Grade', cell: (r) => r.alloy?.name ?? '—' },
    { header: 'Cast Wt (kg)', numeric: true, sortKey: 'castingWeightKg', cell: (r) => r.castingWeightKg.toFixed(1) },
    {
      header: 'Mach. Wt (kg)', numeric: true, sortKey: 'machinedWeightKg',
      cell: (r) => (r.machinedWeightKg != null ? r.machinedWeightKg.toFixed(1) : '—'),
    },
    {
      header: 'Drawing',
      cell: (r) =>
        r.drawingNo ? (
          <>
            <Mono>{r.drawingNo}</Mono>
            {r.currentRevision ? (
              <span className="badge b-mute" style={{ marginLeft: 4 }}>{r.currentRevision}</span>
            ) : null}
          </>
        ) : '—',
    },
    { header: 'Process', cell: (r) => r.castingProcess ?? '—' },
    { header: 'Status', sortKey: 'status', cell: (r) => <Badge status={r.status} /> },
  ];

  const byGrade = useMemo(() => summarise(data, (r) => r.alloy?.code ?? 'Unassigned'), [data]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Products & Masters' }, { label: 'Part Master' }]}
        title="Part Master"
        subtitle="Every casting this works makes, with grade, weights and drawing"
        actions={
          <>
            <Button icon="upload">Import</Button>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="add" to="/app/masters/parts/new">Add Part</Button>
          </>
        }
      />

      <Split
        main={
          <Card>
            <CardHead title="Parts">
              <Segmented options={['List', 'Cards']} active={view} onChange={setView} />
            </CardHead>

            <Toolbar>
              <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search part no, name, customer part no…" />
              <SelectField
                label="Grade" value={alloyId}
                onChange={(v) => { setAlloyId(v); setPage(1); }}
                options={[
                  { value: '', label: 'All grades' },
                  ...(alloys?.rows ?? []).map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
              <SelectField
                label="Process" value={process}
                onChange={(v) => { setProcess(v); setPage(1); }}
                options={[
                  { value: '', label: 'All processes' },
                  ...CASTING_PROCESS.map((p) => ({ value: p, label: p })),
                ]}
              />
            </Toolbar>

            <Chips options={chips} active={status} onChange={(v) => { setStatus(v); setPage(1); }} />

            <div className={isFetching && !isLoading ? 'page-loading' : undefined}>
              <DataTable
                columns={columns}
                rows={data?.rows ?? []}
                rowKey={(r) => r.id}
                rowHref={(r) => `/app/masters/parts/${r.id}`}
                loading={isLoading}
                sort={sort}
                onSortChange={(key, dir) => setSort({ key, dir })}
                empty={
                  <Empty
                    icon="category"
                    title={q || status ? 'No parts match these filters' : 'No parts yet'}
                    body={
                      q || status
                        ? 'Try clearing the search or the status filter.'
                        : 'Add your first casting to start quoting and planning production.'
                    }
                    action={<Button variant="primary" icon="add" to="/app/masters/parts/new">Add Part</Button>}
                  />
                }
              />
            </div>

            {data && data.total > 0 ? (
              <TableFooter
                page={page} pageSize={pageSize} total={data.total}
                onPage={setPage}
                onPageSize={(n) => { setPageSize(n); setPage(1); }}
              />
            ) : null}
          </Card>
        }
        aside={
          <>
            <Card bodyPadded className="sum">
              <h2>Part Summary</h2>
              <BigStat
                value={nf.format(data?.total ?? 0)}
                secondary={`/${facet(data, 'RELEASED')}/${facet(data, 'DEVELOPMENT')}`}
                note="Total / Released / In development"
              />
              <Legend tone="--ok" icon="check" label={`Released: ${facet(data, 'RELEASED')}`} />
              <Legend tone="--warn" icon="edit_note" label={`Under revision: ${facet(data, 'UNDER_REVISION')}`} />
              <Legend tone="--fg-3" icon="block" label={`Obsolete: ${facet(data, 'OBSOLETE')}`} />
            </Card>

            <Card bodyPadded>
              <SectionTitle>Parts by grade (this page)</SectionTitle>
              {byGrade.length ? (
                byGrade.map(([label, value]) => (
                  <BarRow key={label} label={label} value={value} max={byGrade[0][1]} />
                ))
              ) : (
                <div className="hint">No parts to summarise</div>
              )}
            </Card>
          </>
        }
      />
    </>
  );
}

const facet = (data: Paginated<PartRow> | undefined, key: string): number => data?.facets?.[key] ?? 0;

/** Groups the current page's rows for the summary bars, highest first. */
function summarise(data: Paginated<PartRow> | undefined, by: (r: PartRow) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of data?.rows ?? []) counts.set(by(r), (counts.get(by(r)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}
