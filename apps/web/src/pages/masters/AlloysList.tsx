/** Material & Alloy Grades register — `P.alloys` in the prototype. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MATERIAL_FAMILY, ALLOY_STATUS } from '@erp/shared';
import { api } from '@/lib/api';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { DataTable, type Column } from '@/components/DataTable';
import {
  PageHeader, Card, CardHead, Split, Toolbar, SearchField, SelectField,
  TableFooter, Badge, Button, MonoLink, Empty, Legend, Hint,
} from '@/components/ui';

export type AlloyRow = {
  id: string; code: string; name: string; family: string;
  standard: string | null; status: string;
  tensileStrengthMpa: number | null; hardnessHb: string | null; partCount: number;
};

export function AlloysList() {
  const [q, setQ] = useState('');
  const [family, setFamily] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'code', dir: 'asc' });

  useDocumentTitle('Material & Alloy');
  const debouncedQ = useDebounced(q);

  const params = { q: debouncedQ, family, status, page, pageSize, sort: sort.key, dir: sort.dir };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['alloys', params],
    queryFn: () => api.list<AlloyRow>('/masters/alloys', params),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AlloyRow>[] = [
    { header: 'Code', sortKey: 'code', cell: (r) => <MonoLink to={`/app/masters/alloys/${r.id}`}>{r.code}</MonoLink> },
    { header: 'Grade Name', sortKey: 'name', cell: (r) => <b>{r.name}</b> },
    { header: 'Family', sortKey: 'family', cell: (r) => r.family },
    { header: 'Standard', sortKey: 'standard', cell: (r) => r.standard ?? '—' },
    {
      header: 'Tensile', numeric: true,
      cell: (r) => (r.tensileStrengthMpa != null ? `${r.tensileStrengthMpa} MPa min` : '—'),
    },
    { header: 'Hardness (HB)', cell: (r) => r.hardnessHb ?? '—' },
    { header: 'Parts', numeric: true, cell: (r) => r.partCount },
    { header: 'Status', sortKey: 'status', cell: (r) => <Badge status={r.status} /> },
  ];

  const familyCount = (f: string) => data?.facets?.[f] ?? 0;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Products & Masters' }, { label: 'Material / Alloy' }]}
        title="Material & Alloy Grades"
        subtitle="Grades with chemistry and mechanical property limits"
        actions={
          <>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="add" to="/app/masters/alloys/new">Add Grade</Button>
          </>
        }
      />

      <Split
        main={
          <Card>
            <CardHead title="Grades" />
            <Toolbar>
              <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search grade, standard…" />
              <SelectField
                label="Family" value={family}
                onChange={(v) => { setFamily(v); setPage(1); }}
                options={[{ value: '', label: 'All families' }, ...MATERIAL_FAMILY.map((f) => ({ value: f, label: f }))]}
              />
              <SelectField
                label="Status" value={status}
                onChange={(v) => { setStatus(v); setPage(1); }}
                options={[{ value: '', label: 'All statuses' }, ...ALLOY_STATUS.map((s) => ({ value: s, label: s }))]}
              />
            </Toolbar>

            <div className={isFetching && !isLoading ? 'page-loading' : undefined}>
              <DataTable
                columns={columns}
                rows={data?.rows ?? []}
                rowKey={(r) => r.id}
                rowHref={(r) => `/app/masters/alloys/${r.id}`}
                loading={isLoading}
                sort={sort}
                onSortChange={(key, dir) => setSort({ key, dir })}
                empty={
                  <Empty
                    icon="science"
                    title={q ? 'No grades match your search' : 'No grades yet'}
                    body="Add the alloy grades this foundry pours, with their chemistry and mechanical limits."
                    action={<Button variant="primary" icon="add" to="/app/masters/alloys/new">Add Grade</Button>}
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
              <h2>Grade Summary</h2>
              {MATERIAL_FAMILY.map((f) => (
                <Legend key={f} tone="--info" icon="category" label={`${f}: ${familyCount(f)}`} />
              ))}
            </Card>
            <Card>
              <Hint>Select a grade to view its chemistry limits and charge guide</Hint>
            </Card>
          </>
        }
      />
    </>
  );
}
