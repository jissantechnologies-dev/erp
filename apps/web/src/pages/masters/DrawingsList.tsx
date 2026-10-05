/** Drawing Register — `P.drawings`: one row per drawing, showing current revision. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DRAWING_STATUS, shortDate } from '@erp/shared';
import { api } from '@/lib/api';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { DataTable, type Column } from '@/components/DataTable';
import {
  PageHeader, Card, CardHead, Split, Toolbar, SearchField, SelectField,
  TableFooter, Badge, Button, MonoLink, CellStack, Empty, Legend, Alert,
} from '@/components/ui';

export type DrawingRow = {
  id: string; drawingNo: string;
  part: { id: string; partNo: string; name: string } | null;
  customer: { id: string; name: string } | null;
  currentRevision: string | null; revisionDate: string | null;
  latestChange: string | null; status: string | null;
  owner: string | null; revisionCount: number;
};

export function DrawingsList() {
  const [q, setQ] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useDocumentTitle('Drawing Revision');
  const debouncedQ = useDebounced(q);

  const params = { q: debouncedQ, customerId, status, page, pageSize };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['drawings', params],
    queryFn: () => api.list<DrawingRow>('/masters/drawings', params),
    placeholderData: (prev) => prev,
  });

  const { data: customers } = useQuery({
    queryKey: ['customer-options'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/customers/options'),
    staleTime: 5 * 60_000,
  });

  // Counted from the current page, since the API facets drawings by revision
  // status rather than returning a global tally.
  const countBy = (s: string) => (data?.rows ?? []).filter((r) => r.status === s).length;
  const pendingRows = (data?.rows ?? []).filter((r) => r.status === 'Pending Approval');

  const columns: Column<DrawingRow>[] = [
    { header: 'Drawing No', sortKey: 'drawingNo', cell: (r) => <MonoLink to={`/app/masters/drawings/${r.id}`}>{r.drawingNo}</MonoLink> },
    { header: 'Current Rev', cell: (r) => <b style={{ fontSize: 15 }}>{r.currentRevision ?? '—'}</b> },
    { header: 'Part', cell: (r) => <CellStack main={r.part?.name ?? '—'} sub={r.part?.partNo} subMono /> },
    { header: 'Customer', cell: (r) => r.customer?.name ?? '—' },
    { header: 'Rev Date', cell: (r) => shortDate(r.revisionDate) },
    { header: 'Latest Change', cell: (r) => r.latestChange ?? '—' },
    { header: 'Revs', numeric: true, cell: (r) => r.revisionCount },
    { header: 'Owner', cell: (r) => r.owner ?? '—' },
    { header: 'Status', cell: (r) => <Badge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Products & Masters' }, { label: 'Drawing Revision' }]}
        title="Drawing Register"
        subtitle="Customer drawings and every revision received"
        actions={
          <>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="upload_file" to="/app/masters/drawings/new">Upload Revision</Button>
          </>
        }
      />

      <Split
        main={
          <Card>
            <CardHead title="Drawings" />
            <Toolbar>
              <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search drawing no, part, customer…" />
              <SelectField
                label="Customer" value={customerId}
                onChange={(v) => { setCustomerId(v); setPage(1); }}
                options={[{ value: '', label: 'All customers' }, ...(customers ?? []).map((c) => ({ value: c.id, label: c.name }))]}
              />
              <SelectField
                label="Status" value={status}
                onChange={(v) => { setStatus(v); setPage(1); }}
                options={[{ value: '', label: 'All statuses' }, ...DRAWING_STATUS.map((s) => ({ value: s, label: s }))]}
              />
            </Toolbar>

            <div className={isFetching && !isLoading ? 'page-loading' : undefined}>
              <DataTable
                columns={columns}
                rows={data?.rows ?? []}
                rowKey={(r) => r.id}
                rowHref={(r) => `/app/masters/drawings/${r.id}`}
                loading={isLoading}
                empty={
                  <Empty
                    icon="architecture"
                    title={q || status ? 'No drawings match these filters' : 'No drawings yet'}
                    body="Register a customer drawing to start tracking its revisions."
                    action={<Button variant="primary" icon="upload_file" to="/app/masters/drawings/new">Upload Revision</Button>}
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
              <h2>Revision Control</h2>
              <Legend tone="--ok" icon="check" label={`Released: ${countBy('Released')}`} />
              <Legend tone="--warn" icon="hourglass_top" label={`Awaiting approval: ${countBy('Pending Approval')}`} />
              <Legend tone="--warn" icon="edit_note" label={`Under revision: ${countBy('Under Revision')}`} />
              <div className="kbd-note" style={{ marginTop: 8 }}>Counts reflect the current page.</div>
            </Card>

            {pendingRows.length > 0 ? (
              <Card bodyPadded>
                <Alert tone="warn" title={`${pendingRows[0].drawingNo} Rev ${pendingRows[0].currentRevision} not yet approved`}>
                  Tooling and fixtures may still be built to the previous revision.
                  Approve it before releasing the part to production.
                </Alert>
              </Card>
            ) : null}
          </>
        }
      />
    </>
  );
}
