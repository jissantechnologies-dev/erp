/** Alloy grade detail — `P.alloy`: Chemistry, Mechanical, Charge Guide, Parts. */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import {
  PageHeader, Card, CardHead, Split, Tabs, Badge, Button, Mono, MonoLink,
  SummaryGrid, Empty,
} from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';

type ChemRow = { id: string; element: string; min: number | null; max: number | null; target: number | null; remarks: string | null };
type MechRow = { id: string; property: string; requirement: string; testMethod: string | null; testBar: string | null };
type ChargeRow = { id: string; input: string; qtyKg: number };
type PartRef = { id: string; partNo: string; name: string; status: string };

type AlloyDto = {
  id: string; code: string; name: string; family: string; standard: string | null;
  equivalentGrades: string | null; status: string;
  tensileStrengthMpa: number | null; proofStressMpa: number | null;
  elongationPct: number | null; hardnessHb: string | null;
  pouringTempC: string | null; densityGCm3: number | null;
  partCount: number;
  chemistry: ChemRow[]; mechanicalProperties: MechRow[]; chargeMix: ChargeRow[];
};

export function AlloyDetail() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState(0);

  const { data: alloy, isLoading } = useQuery({
    queryKey: ['alloy', id],
    queryFn: () => api.get<AlloyDto>(`/masters/alloys/${id}`),
  });

  // Parts using this grade populate the fourth tab.
  const { data: parts } = useQuery({
    queryKey: ['alloy-parts', id],
    queryFn: () => api.list<PartRef>('/masters/parts', { alloyId: id, pageSize: 100 }),
    enabled: Boolean(alloy),
  });

  useDocumentTitle(alloy?.name ?? 'Grade');

  const crumbs = [
    { label: 'Products & Masters' },
    { label: 'Material / Alloy', to: '/app/masters/alloys' },
    { label: alloy?.code ?? '…' },
  ];

  if (isLoading) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={<span className="skel" style={{ width: 220, height: 28, display: 'inline-block' }} />} />
        <Card bodyPadded>
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="skel" style={{ marginBottom: 12 }} />)}
        </Card>
      </>
    );
  }

  if (!alloy) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Grade not found" />
        <Card>
          <Empty icon="search_off" title="We could not find that grade"
            action={<Button variant="primary" to="/app/masters/alloys">Back to grades</Button>} />
        </Card>
      </>
    );
  }

  const tabs = [
    { label: 'Chemistry', count: alloy.chemistry.length || undefined },
    { label: 'Mechanical', count: alloy.mechanicalProperties.length || undefined },
    { label: 'Charge Guide', count: alloy.chargeMix.length || undefined },
    { label: 'Parts', count: alloy.partCount || undefined },
  ];

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={alloy.name}
        subtitle={`${alloy.standard ?? '—'} · ${alloy.family}`}
        actions={
          <>
            <Button icon="edit" to={`/app/masters/alloys/${alloy.id}/edit`}>Edit Grade</Button>
            <Button variant="primary" icon="content_copy">Copy as New Grade</Button>
          </>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <Split
        main={
          <>
            {tab === 0 ? <ChemistryTab rows={alloy.chemistry} /> : null}
            {tab === 1 ? <MechanicalTab rows={alloy.mechanicalProperties} /> : null}
            {tab === 2 ? <ChargeTab rows={alloy.chargeMix} /> : null}
            {tab === 3 ? <PartsTab rows={parts?.rows ?? []} /> : null}
          </>
        }
        aside={
          <Card bodyPadded className="sum">
            <h2>Grade Summary</h2>
            <SummaryGrid
              items={[
                ['Code', <Mono>{alloy.code}</Mono>],
                ['Status', <Badge status={alloy.status} />],
                ['Tensile', alloy.tensileStrengthMpa ? `${alloy.tensileStrengthMpa} MPa min` : '—'],
                ['Hardness', alloy.hardnessHb ? `${alloy.hardnessHb} HB` : '—'],
                ['Density', alloy.densityGCm3 ? `${alloy.densityGCm3} g/cm³` : '—'],
                ['Pouring temp.', alloy.pouringTempC ? `${alloy.pouringTempC} °C` : '—'],
              ]}
            />
          </Card>
        }
      />
    </>
  );
}

function ChemistryTab({ rows }: { rows: ChemRow[] }) {
  // The range bar is positioned within 0–5%, the band that covers every
  // element in a ferrous charge; anything above pins to full width.
  const SCALE = 5;
  return (
    <Card>
      <CardHead title="Chemical Composition (%)">
        <Button icon="add">Add Element</Button>
      </CardHead>
      {rows.length === 0 ? (
        <Empty icon="labs" title="No chemistry limits recorded"
          body="Add the element ranges this grade is controlled to." />
      ) : (
        <>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Element</th>
                  <th className="r">Min</th>
                  <th className="r">Max</th>
                  <th className="r">Target</th>
                  <th style={{ minWidth: 160 }}>Range</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const left = ((c.min ?? 0) / SCALE) * 100;
                  const right = 100 - Math.min(100, ((c.max ?? SCALE) / SCALE) * 100);
                  return (
                    <tr key={c.id}>
                      <td><b className="mono" style={{ fontSize: 14 }}>{c.element}</b></td>
                      <td className="r num">{c.min ?? '—'}</td>
                      <td className="r num">{c.max ?? '—'}</td>
                      <td className="r num">{c.target != null ? c.target.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : '—'}</td>
                      <td>
                        <div style={{ position: 'relative', height: 8, background: 'var(--surface-2)', borderRadius: 4 }}>
                          <div
                            style={{
                              position: 'absolute', left: `${Math.min(95, left)}%`, right: `${Math.max(0, right)}%`,
                              top: 0, bottom: 0, background: 'var(--primary)', borderRadius: 4, opacity: 0.75,
                            }}
                          />
                        </div>
                      </td>
                      <td>{c.remarks ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card-b kbd-note">Range bars are drawn against a 0–5 % scale.</div>
        </>
      )}
    </Card>
  );
}

const MechanicalTab = ({ rows }: { rows: MechRow[] }) => (
  <Card>
    {rows.length === 0 ? (
      <Empty icon="fitness_center" title="No mechanical properties recorded" />
    ) : (
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Property</th><th>Requirement</th><th>Test Method</th><th>Test Bar</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td><b>{m.property}</b></td>
                <td className="num">{m.requirement}</td>
                <td>{m.testMethod ?? '—'}</td>
                <td>{m.testBar ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

function ChargeTab({ rows }: { rows: ChargeRow[] }) {
  const total = rows.reduce((s, r) => s + r.qtyKg, 0);
  return (
    <Card>
      <CardHead title="Typical Charge Mix (per 1,000 kg)" />
      {rows.length === 0 ? (
        <Empty icon="local_fire_department" title="No charge guide recorded"
          body="Add the typical charge mix so Melting can reference it." />
      ) : (
        <>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Input</th><th className="r">Qty (kg)</th><th className="r">Share</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.input}</td>
                    <td className="r num">{r.qtyKg.toLocaleString('en-IN')}</td>
                    <td className="r num">{total > 0 ? `${((r.qtyKg / total) * 100).toFixed(1)} %` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-b kbd-note">
            Referenced by Melting &amp; Furnace once that module is live.
          </div>
        </>
      )}
    </Card>
  );
}

function PartsTab({ rows }: { rows: PartRef[] }) {
  const columns: Column<PartRef>[] = [
    { header: 'Part No', cell: (p) => <MonoLink to={`/app/masters/parts/${p.id}`}>{p.partNo}</MonoLink> },
    { header: 'Part', cell: (p) => p.name },
    { header: 'Status', cell: (p) => <Badge status={p.status} /> },
  ];
  return (
    <Card>
      <DataTable
        columns={columns} rows={rows} rowKey={(p) => p.id}
        rowHref={(p) => `/app/masters/parts/${p.id}`} selectable={false}
        empty={<Empty icon="category" title="No parts use this grade yet" />}
      />
    </Card>
  );
}
