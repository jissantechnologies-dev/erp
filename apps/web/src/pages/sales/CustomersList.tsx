/** Customer register — `P.customers`. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CUSTOMER_STATUS, shortDate } from '@erp/shared';
import { api } from '@/lib/api';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { DataTable, type Column } from '@/components/DataTable';
import {
  PageHeader, Card, CardHead, Split, Toolbar, SearchField, Chips,
  TableFooter, Badge, Button, MonoLink, CellStack, Empty, BigStat, Legend, BarRow, SectionTitle,
} from '@/components/ui';

export type CustomerRow = {
  id: string; code: string; name: string;
  city: string | null; state: string | null; industry: string | null;
  status: string; since: string | null;
  contact: { name: string; designation: string | null; phone: string | null; email: string | null } | null;
  partCount: number;
};

export function CustomersList() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });

  useDocumentTitle('Customers');
  const debouncedQ = useDebounced(q);

  const params = { q: debouncedQ, status, page, pageSize, sort: sort.key, dir: sort.dir };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.list<CustomerRow>('/customers', params),
    placeholderData: (prev) => prev,
  });

  const facet = (s: string) => data?.facets?.[s.toUpperCase()] ?? 0;
  const chips = [
    { value: '', label: 'All', count: data?.total },
    ...CUSTOMER_STATUS.map((s) => ({ value: s, label: s, count: facet(s) })),
  ];

  // Geographic spread from the current page, for the summary bars.
  const byState = Object.entries(
    (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
      const k = r.state ?? 'Unknown';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const columns: Column<CustomerRow>[] = [
    { header: 'Code', sortKey: 'code', cell: (c) => <MonoLink to={`/app/sales/customers/${c.id}`}>{c.code}</MonoLink> },
    { header: 'Customer', sortKey: 'name', cell: (c) => <CellStack main={c.name} sub={c.industry} /> },
    { header: 'Location', sortKey: 'city', cell: (c) => [c.city, c.state].filter(Boolean).join(', ') || '—' },
    {
      header: 'Primary Contact',
      cell: (c) => (c.contact ? <CellStack main={c.contact.name} sub={c.contact.designation} /> : '—'),
    },
    { header: 'Phone', cell: (c) => c.contact?.phone ?? '—' },
    { header: 'Parts', numeric: true, cell: (c) => c.partCount },
    { header: 'Since', sortKey: 'since', cell: (c) => shortDate(c.since) },
    { header: 'Status', sortKey: 'status', cell: (c) => <Badge status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Sales' }, { label: 'Customers' }]}
        title="Customers"
        subtitle="Everyone this works casts for, with their primary contact"
        actions={
          <>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="add" to="/app/sales/customers/new">Add Customer</Button>
          </>
        }
      />

      <Split
        main={
          <Card>
            <CardHead title="Customers" />
            <Toolbar>
              <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, code, city, industry…" />
            </Toolbar>
            <Chips options={chips} active={status} onChange={(v) => { setStatus(v); setPage(1); }} />

            <div className={isFetching && !isLoading ? 'page-loading' : undefined}>
              <DataTable
                columns={columns}
                rows={data?.rows ?? []}
                rowKey={(c) => c.id}
                rowHref={(c) => `/app/sales/customers/${c.id}`}
                loading={isLoading}
                sort={sort}
                onSortChange={(key, dir) => setSort({ key, dir })}
                empty={
                  <Empty
                    icon="storefront"
                    title={q || status ? 'No customers match these filters' : 'No customers yet'}
                    body="Add a customer to start registering enquiries and parts against them."
                    action={<Button variant="primary" icon="add" to="/app/sales/customers/new">Add Customer</Button>}
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
              <h2>Customer Summary</h2>
              <BigStat
                value={data?.total ?? 0}
                secondary={`/${facet('Active')}`}
                note="Total / active"
              />
              <Legend tone="--ok" icon="check" label={`Active: ${facet('Active')}`} />
              <Legend tone="--info" icon="person_add" label={`Prospects: ${facet('Prospect')}`} />
              <Legend tone="--fg-3" icon="block" label={`Inactive: ${facet('Inactive')}`} />
            </Card>

            <Card bodyPadded>
              <SectionTitle>By state (this page)</SectionTitle>
              {byState.length ? (
                byState.map(([label, value]) => (
                  <BarRow key={label} label={label} value={value} max={byState[0][1]} />
                ))
              ) : (
                <div className="hint">Nothing to summarise</div>
              )}
            </Card>
          </>
        }
      />
    </>
  );
}
