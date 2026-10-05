/** Customer Part Mapping — `P.mapping`: our part number against the customer's. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MAPPING_STATUS, rupees } from '@erp/shared';
import { api } from '@/lib/api';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { DataTable, type Column } from '@/components/DataTable';
import {
  PageHeader, Card, CardHead, Split, Toolbar, SearchField, SelectField, Chips,
  TableFooter, Badge, Button, MonoLink, CellStack, Mono, Empty, SectionTitle, Alert,
} from '@/components/ui';

export type MappingRow = {
  id: string;
  customer: { id: string; name: string } | null;
  part: { id: string; partNo: string; name: string } | null;
  customerPartNo: string; drawingRef: string | null;
  pricePaise: number | null; priceDisplay: string;
  supplyCondition: string | null; status: string;
};

export function MappingList() {
  const [q, setQ] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useDocumentTitle('Customer Part Mapping');
  const debouncedQ = useDebounced(q);

  const params = { q: debouncedQ, customerId, status, page, pageSize };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['mappings', params],
    queryFn: () => api.list<MappingRow>('/masters/mappings', params),
    placeholderData: (prev) => prev,
  });

  const { data: customers } = useQuery({
    queryKey: ['customer-options'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/customers/options'),
    staleTime: 5 * 60_000,
  });

  const facet = (s: string) => data?.facets?.[s.toUpperCase().replace(/[^A-Z0-9]+/g, '_')] ?? 0;
  const chips = [
    { value: '', label: 'All', count: data?.total },
    ...MAPPING_STATUS.map((s) => ({ value: s, label: s, count: facet(s) })),
  ];

  // Unpriced mappings block quoting, so they are surfaced rather than buried.
  const unpriced = (data?.rows ?? []).filter((r) => r.pricePaise == null).length;

  const columns: Column<MappingRow>[] = [
    { header: 'Customer', cell: (m) => m.customer?.name ?? '—' },
    { header: 'Customer Part No', cell: (m) => <Mono>{m.customerPartNo}</Mono> },
    {
      header: 'Our Part',
      cell: (m) =>
        m.part ? (
          <CellStack main={m.part.name} sub={<MonoLink to={`/app/masters/parts/${m.part.id}`}>{m.part.partNo}</MonoLink>} />
        ) : '—',
    },
    { header: 'Drawing / Rev', cell: (m) => (m.drawingRef ? <Mono>{m.drawingRef}</Mono> : '—') },
    { header: 'Supply Condition', cell: (m) => m.supplyCondition ?? '—' },
    {
      header: 'Price', numeric: true,
      cell: (m) =>
        m.pricePaise != null ? rupees(m.pricePaise) : <span className="badge b-warn">Not set</span>,
    },
    { header: 'Status', cell: (m) => <Badge status={m.status} /> },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Products & Masters' }, { label: 'Customer Part Mapping' }]}
        title="Customer Part Mapping"
        subtitle="Our part number against the customer's, with the agreed price"
        actions={
          <>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="add" to="/app/masters/mapping/new">Add Mapping</Button>
          </>
        }
      />

      <Split
        main={
          <Card>
            <CardHead title="Mappings" />
            <Toolbar>
              <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search customer part no, drawing…" />
              <SelectField
                label="Customer" value={customerId}
                onChange={(v) => { setCustomerId(v); setPage(1); }}
                options={[{ value: '', label: 'All customers' }, ...(customers ?? []).map((c) => ({ value: c.id, label: c.name }))]}
              />
            </Toolbar>
            <Chips options={chips} active={status} onChange={(v) => { setStatus(v); setPage(1); }} />

            <div className={isFetching && !isLoading ? 'page-loading' : undefined}>
              <DataTable
                columns={columns}
                rows={data?.rows ?? []}
                rowKey={(m) => m.id}
                loading={isLoading}
                empty={
                  <Empty
                    icon="link"
                    title={q || status ? 'No mappings match these filters' : 'No mappings yet'}
                    body="Map a part to a customer's own part number so quotations and orders can price it."
                    action={<Button variant="primary" icon="add" to="/app/masters/mapping/new">Add Mapping</Button>}
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
              <h2>Mapping Summary</h2>
              <SectionTitle>Why this matters</SectionTitle>
              <div className="kbd-note">
                Quotations and sales orders read the agreed price and supply
                condition from here, so a part without a mapping cannot be quoted.
              </div>
            </Card>

            {unpriced > 0 ? (
              <Card bodyPadded>
                <Alert tone="warn" title={`${unpriced} mapping${unpriced > 1 ? 's' : ''} without a price`}>
                  Set a price so Sales can quote against these parts.
                </Alert>
              </Card>
            ) : null}
          </>
        }
      />
    </>
  );
}
