/**
 * Dashboard. The design's full dashboard depends on production, quality and
 * sales data that is not yet modelled, so this shows what the Masters module
 * can answer truthfully today and names the rest as pending rather than
 * rendering invented numbers.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { nf } from '@erp/shared';
import { api } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Card, Split, SectionTitle, Legend, BarRow, Alert, Ms, Button,
} from '@/components/ui';

type Counts = { total: number; facets?: Record<string, number> };

export function Dashboard() {
  const { user } = useAuth();
  useDocumentTitle('Dashboard');

  // Each summary is its own query rather than a shared helper, so the hooks
  // are called directly in the component body as the rules of hooks require.
  const summary = (key: string, path: string) => ({
    queryKey: [key, 'summary'],
    queryFn: () => api.list<unknown>(path, { pageSize: 1 }) as Promise<Counts>,
    staleTime: 60_000,
  });

  const parts = useQuery(summary('parts', '/masters/parts'));
  const alloys = useQuery(summary('alloys', '/masters/alloys'));
  const tools = useQuery(summary('tools', '/masters/tools'));
  const drawings = useQuery(summary('drawings', '/masters/drawings'));
  const customers = useQuery(summary('customers', '/customers'));

  const tile = (label: string, value: number | undefined, icon: string, to: string) => (
    <Link to={to} className="card card-b" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg-3)' }}>
        <Ms name={icon} />
        <span style={{ fontSize: 13 }}>{label}</span>
      </div>
      <div className="bigstat" style={{ marginTop: 6 }}>
        <b>{value != null ? nf.format(value) : <span className="skel" style={{ width: 48, height: 24, display: 'inline-block' }} />}</b>
      </div>
    </Link>
  );

  const toolFacet = (s: string) => tools.data?.facets?.[s] ?? 0;
  const maintenance = toolFacet('MAINTENANCE_DUE') + toolFacet('UNDER_REPAIR');

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Dashboard' }]}
        title={`Good day, ${user?.displayName ?? user?.fullName ?? ''}`.trim()}
        subtitle={user?.tenant.name}
      />

      <Split
        main={
          <>
            <div className="grid2" style={{ marginBottom: 16 }}>
              {tile('Parts', parts.data?.total, 'category', '/app/masters/parts')}
              {tile('Customers', customers.data?.total, 'storefront', '/app/sales/customers')}
              {tile('Alloy grades', alloys.data?.total, 'science', '/app/masters/alloys')}
              {tile('Tooling', tools.data?.total, 'handyman', '/app/masters/tooling')}
            </div>

            <Card bodyPadded>
              <SectionTitle>Part status</SectionTitle>
              {parts.data?.facets ? (
                Object.entries(parts.data.facets)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <BarRow
                      key={k}
                      label={k.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                      value={v}
                      max={Math.max(...Object.values(parts.data!.facets!))}
                    />
                  ))
              ) : (
                <div className="hint">Loading…</div>
              )}
            </Card>

            <Card bodyPadded>
              <SectionTitle>Still to come</SectionTitle>
              <Alert tone="info" title="Production, quality and sales metrics">
                The design's OEE, yield, rejection and order-book charts need the
                Production, Quality and Sales modules. They will appear here as
                each module goes live.
              </Alert>
            </Card>
          </>
        }
        aside={
          <>
            <Card bodyPadded className="sum">
              <h2>Masters health</h2>
              <Legend tone="--ok" icon="check" label={`Drawings registered: ${drawings.data?.total ?? 0}`} />
              <Legend
                tone={maintenance > 0 ? '--warn' : '--ok'}
                icon="build"
                label={`Tooling needing attention: ${maintenance}`}
              />
              <Legend tone="--info" icon="science" label={`Alloy grades: ${alloys.data?.total ?? 0}`} />
            </Card>

            {maintenance > 0 ? (
              <Card bodyPadded>
                <Alert tone="warn" title={`${maintenance} tool${maintenance > 1 ? 's' : ''} need attention`}>
                  Patterns past 85 % of rated life are flagged automatically.
                </Alert>
                <div style={{ marginTop: 10 }}>
                  <Button icon="open_in_new" to="/app/masters/tooling">Open Tooling</Button>
                </div>
              </Card>
            ) : null}
          </>
        }
      />
    </>
  );
}
