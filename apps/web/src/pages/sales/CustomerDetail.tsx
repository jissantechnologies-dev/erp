/** Customer detail — `P.customer`: overview, contacts and the parts we cast for them. */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { kg, shortDate } from '@erp/shared';
import { api } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { DataTable, type Column } from '@/components/DataTable';
import {
  PageHeader, Card, Split, Tabs, Badge, Button, Mono, MonoLink, Ms,
  DescriptionGrid, SummaryGrid, FormSection, SectionTitle, Empty, Alert,
} from '@/components/ui';

type Contact = {
  id: string; name: string; designation: string | null;
  phone: string | null; email: string | null; isPrimary: boolean;
};
type PartRef = { id: string; partNo: string; name: string; status: string; castingWeightKg: number };

type CustomerDto = {
  id: string; code: string; name: string;
  city: string | null; state: string | null; industry: string | null;
  gstin: string | null; status: string; since: string | null;
  contact: { name: string; designation: string | null; phone: string | null; email: string | null } | null;
  contacts: Contact[];
  parts: PartRef[];
  partCount: number; mappingCount: number;
};

export function CustomerDetail() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState(0);

  const { data: c, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<CustomerDto>(`/customers/${id}`),
  });

  useDocumentTitle(c?.name ?? 'Customer');

  const crumbs = [
    { label: 'Sales' },
    { label: 'Customers', to: '/app/sales/customers' },
    { label: c?.code ?? '…' },
  ];

  if (isLoading) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={<span className="skel" style={{ width: 260, height: 28, display: 'inline-block' }} />} />
        <Card bodyPadded>
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="skel" style={{ marginBottom: 12 }} />)}
        </Card>
      </>
    );
  }

  if (!c) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Customer not found" />
        <Card>
          <Empty icon="search_off" title="We could not find that customer"
            action={<Button variant="primary" to="/app/sales/customers">Back to customers</Button>} />
        </Card>
      </>
    );
  }

  const partColumns: Column<PartRef>[] = [
    { header: 'Part No', cell: (p) => <MonoLink to={`/app/masters/parts/${p.id}`}>{p.partNo}</MonoLink> },
    { header: 'Part', cell: (p) => p.name },
    { header: 'Cast Wt', numeric: true, cell: (p) => kg(p.castingWeightKg) },
    {
      header: 'Status',
      // The parts projection returns the DB spelling, so it is humanised here.
      cell: (p) => <Badge status={p.status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())} />,
    },
  ];

  const tabs = [
    { label: 'Overview' },
    { label: 'Contacts', count: c.contacts.length || undefined },
    { label: 'Parts', count: c.partCount || undefined },
  ];

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={<>{c.name}{' '}<span className="mono" style={{ fontSize: 20, color: 'var(--fg-3)' }}>{c.code}</span></>}
        subtitle={[c.industry, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button icon="edit" to={`/app/sales/customers/${c.id}/edit`}>Edit Customer</Button>
            <Button variant="primary" icon="add" to="/app/masters/mapping/new">Add Part Mapping</Button>
          </>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <Split
        main={
          <>
            {tab === 0 ? (
              <Card>
                <FormSection icon="storefront" title="Customer">
                  <DescriptionGrid
                    items={[
                      ['Code', <Mono>{c.code}</Mono>],
                      ['Name', c.name],
                      ['Status', <Badge status={c.status} />],
                      ['Industry', c.industry],
                      ['City', c.city],
                      ['State', c.state],
                    ]}
                  />
                </FormSection>
                <FormSection icon="receipt_long" title="Commercial">
                  <DescriptionGrid
                    items={[
                      ['GSTIN', c.gstin ? <Mono>{c.gstin}</Mono> : null],
                      ['Customer since', shortDate(c.since)],
                      ['Parts', c.partCount],
                      ['Mappings', c.mappingCount],
                    ]}
                  />
                </FormSection>
              </Card>
            ) : null}

            {tab === 1 ? (
              <Card>
                {c.contacts.length === 0 ? (
                  <Empty icon="contact_phone" title="No contacts recorded"
                    body="Add a contact so enquiries and quotations have someone to go to." />
                ) : (
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr><th>Name</th><th>Designation</th><th>Phone</th><th>Email</th><th>Primary</th></tr>
                      </thead>
                      <tbody>
                        {c.contacts.map((x) => (
                          <tr key={x.id}>
                            <td><b>{x.name}</b></td>
                            <td>{x.designation ?? '—'}</td>
                            <td>{x.phone ?? '—'}</td>
                            <td>{x.email ?? '—'}</td>
                            <td>{x.isPrimary ? <Badge status="Active" /> : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : null}

            {tab === 2 ? (
              <Card>
                <DataTable
                  columns={partColumns}
                  rows={c.parts}
                  rowKey={(p) => p.id}
                  rowHref={(p) => `/app/masters/parts/${p.id}`}
                  selectable={false}
                  empty={
                    <Empty
                      icon="category" title="No parts yet"
                      body="Add a part against this customer to start quoting."
                      action={<Button variant="primary" icon="add" to="/app/masters/parts/new">Add Part</Button>}
                    />
                  }
                />
              </Card>
            ) : null}
          </>
        }
        aside={
          <>
            <Card bodyPadded className="sum">
              <h2>Customer Summary</h2>
              <SummaryGrid
                items={[
                  ['Status', <Badge status={c.status} />],
                  ['Since', shortDate(c.since)],
                  ['Parts', c.partCount],
                  ['Mappings', c.mappingCount],
                ]}
              />
            </Card>

            <Card bodyPadded>
              <SectionTitle>Primary contact</SectionTitle>
              {c.contact ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5 }}>
                  <span>
                    <Ms name="person" size={18} /> {c.contact.name}
                    {c.contact.designation ? `, ${c.contact.designation}` : ''}
                  </span>
                  {c.contact.phone ? <span><Ms name="call" size={18} /> {c.contact.phone}</span> : null}
                  {c.contact.email ? <span><Ms name="mail" size={18} /> {c.contact.email}</span> : null}
                </div>
              ) : (
                <div className="hint">No primary contact on file</div>
              )}
            </Card>

            {c.status === 'Prospect' ? (
              <Card bodyPadded>
                <Alert tone="info" title="Still a prospect">
                  Set the status to Active once the first order is confirmed.
                </Alert>
              </Card>
            ) : null}
          </>
        }
      />
    </>
  );
}
