/**
 * Part detail. Mirrors `P.part`: stepper-free header with actions, six tabs
 * (Overview, Specifications, Drawings, Tooling, Customers, Attachments) and the
 * right-hand summary with the part sketch placeholder and a "Where used" panel.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { kg, pct, rupees, shortDate } from '@erp/shared';
import { api } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { DataTable, type Column } from '@/components/DataTable';
import {
  PageHeader, Card, CardHead, Split, Tabs, Badge, Button, Mono, MonoLink,
  DescriptionGrid, SummaryGrid, FormSection, SectionTitle, Dropzone, FileRow,
  Empty, LifeBar, Ms, Alert,
} from '@/components/ui';

type PartDetailDto = {
  id: string; partNo: string; name: string; category: string | null; status: string;
  customer: { id: string; name: string; code: string } | null;
  customerPartNo: string;
  alloy: { id: string; code: string; name: string; family?: string; standard?: string } | null;
  castingProcess: string | null; heatTreatment: string | null; supplyCondition: string | null;
  primaryTool: { id: string; code: string } | null;
  cavitiesPerMould: number | null; coresPerCasting: number | null;
  castingWeightKg: number; machinedWeightKg: number | null; pouredWeightKg: number | null;
  yieldPct: number | null; machiningLossKg: number | null;
  uom: string; drawingNo: string | null; currentRevision: string | null;
  customerSpec: string | null; generalTolerance: string | null;
  surfaceFinish: string | null; painting: string | null;
  characteristics: {
    id: string; characteristic: string; specification: string;
    method: string | null; stage: string | null; frequency: string | null;
  }[];
  tools: {
    id: string; code: string; type: string; description: string;
    usedShots: number; lifeShots: number; status: string;
  }[];
  mappings: {
    id: string; customerPartNo: string; pricePaise: number | null;
    supplyCondition: string | null; status: string;
    customer: { id: string; name: string } | null;
  }[];
  drawings: {
    id: string; drawingNo: string;
    revisions: {
      id: string; revision: string; revisionDate: string;
      changeDescription: string; status: string;
    }[];
  }[];
};

const CRUMBS = (name?: string) => [
  { label: 'Products & Masters' },
  { label: 'Part Master', to: '/app/masters/parts' },
  { label: name ?? '…' },
];

export function PartDetail() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState(0);

  const { data: part, isLoading, error } = useQuery({
    queryKey: ['part', id],
    queryFn: () => api.get<PartDetailDto>(`/masters/parts/${id}`),
  });

  useDocumentTitle(part?.name ?? 'Part');

  if (isLoading) {
    return (
      <>
        <PageHeader crumbs={CRUMBS()} title={<span className="skel" style={{ width: 240, display: 'inline-block', height: 28 }} />} />
        <Card bodyPadded>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skel" style={{ marginBottom: 12, width: `${90 - i * 8}%` }} />
          ))}
        </Card>
      </>
    );
  }

  if (error || !part) {
    return (
      <>
        <PageHeader crumbs={CRUMBS()} title="Part not found" />
        <Card>
          <Empty
            icon="search_off"
            title="We could not find that part"
            body="It may have been removed, or the link may be out of date."
            action={<Button variant="primary" to="/app/masters/parts">Back to Part Master</Button>}
          />
        </Card>
      </>
    );
  }

  const allRevisions = part.drawings.flatMap((d) =>
    d.revisions.map((r) => ({ ...r, drawingNo: d.drawingNo, drawingId: d.id })),
  );

  const tabs = [
    { label: 'Overview' },
    { label: 'Specifications', count: part.characteristics.length || undefined },
    { label: 'Drawings', count: allRevisions.length || undefined },
    { label: 'Tooling', count: part.tools.length || undefined },
    { label: 'Customers', count: part.mappings.length || undefined },
    { label: 'Attachments' },
  ];

  return (
    <>
      <PageHeader
        crumbs={CRUMBS(part.partNo)}
        title={
          <>
            {part.name}{' '}
            <span className="mono" style={{ fontSize: 20, color: 'var(--fg-3)' }}>{part.partNo}</span>
          </>
        }
        subtitle={`${part.customer?.name ?? '—'} · ${part.alloy?.name ?? '—'}`}
        actions={
          <>
            <Button icon="content_copy">Copy as New</Button>
            <Button icon="edit" to={`/app/masters/parts/${part.id}/edit`}>Edit Part</Button>
            <Button variant="primary" icon="upload_file">New Drawing Revision</Button>
          </>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <Split
        main={
          <>
            {tab === 0 ? <OverviewTab part={part} /> : null}
            {tab === 1 ? <SpecificationsTab part={part} /> : null}
            {tab === 2 ? <DrawingsTab revisions={allRevisions} /> : null}
            {tab === 3 ? <ToolingTab tools={part.tools} /> : null}
            {tab === 4 ? <CustomersTab mappings={part.mappings} /> : null}
            {tab === 5 ? <AttachmentsTab part={part} /> : null}
          </>
        }
        aside={
          <>
            <Card bodyPadded className="sum">
              <h2>Part Summary</h2>
              <div
                style={{
                  border: '1px solid var(--line)', borderRadius: 8, height: 140,
                  marginBottom: 14, display: 'grid', placeItems: 'center', background: 'var(--surface-2)',
                }}
              >
                {/* Placeholder sketch, as in the design — replaced once a
                    drawing thumbnail is attached. */}
                <svg viewBox="0 0 120 90" width="150" aria-label="Part sketch placeholder">
                  <g fill="none" stroke="var(--fg-3)" strokeWidth="2">
                    <circle cx="60" cy="45" r="30" />
                    <circle cx="60" cy="45" r="13" />
                    <path d="M30 45h-14M90 45h14M16 35v20M104 35v20" />
                    <circle cx="60" cy="19" r="3" />
                    <circle cx="60" cy="71" r="3" />
                  </g>
                </svg>
              </div>
              <SummaryGrid
                items={[
                  ['Status', <Badge status={part.status} />],
                  ['Drawing rev', part.currentRevision ?? '—'],
                  ['Cast wt', kg(part.castingWeightKg)],
                  ['Mach. wt', kg(part.machinedWeightKg)],
                  ['Yield', part.yieldPct != null ? pct(part.yieldPct) : '—'],
                  ['UOM', part.uom],
                ]}
              />
            </Card>

            <Card bodyPadded>
              <SectionTitle>Where used</SectionTitle>
              {[
                ['Customer mappings', String(part.mappings.length)],
                ['Tooling', String(part.tools.length)],
                ['Drawings', String(part.drawings.length)],
                ['Open sales orders', '—'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex', justifyContent: 'space-between', padding: '7px 0',
                    borderBottom: '1px solid var(--line)', fontSize: 13.5,
                  }}
                >
                  <span style={{ color: 'var(--fg-3)' }}>{k}</span>
                  <span className="mono">{v}</span>
                </div>
              ))}
              <div className="kbd-note" style={{ marginTop: 10 }}>
                Sales and production links appear once those modules are live.
              </div>
            </Card>
          </>
        }
      />
    </>
  );
}

/* ------------------------------- Tab panels ------------------------------- */

const OverviewTab = ({ part }: { part: PartDetailDto }) => (
  <Card>
    <FormSection icon="settings_input_component" title="Identification">
      <DescriptionGrid
        items={[
          ['Part Number', <Mono>{part.partNo}</Mono>],
          ['Part Name', part.name],
          ['Status', <Badge status={part.status} />],
          ['Customer', part.customer?.name],
          ['Customer Part No.', <Mono>{part.customerPartNo}</Mono>],
          ['Category', part.category],
        ]}
      />
    </FormSection>

    <FormSection icon="science" title="Material & Process">
      <DescriptionGrid
        items={[
          ['Alloy Grade', part.alloy?.name],
          ['Casting Process', part.castingProcess],
          ['Heat Treatment', part.heatTreatment],
          [
            'Pattern / Die',
            part.primaryTool ? (
              <MonoLink to={`/app/masters/tooling/${part.primaryTool.id}`}>{part.primaryTool.code}</MonoLink>
            ) : null,
          ],
          ['Cavities per Mould', part.cavitiesPerMould],
          ['Cores per Casting', part.coresPerCasting],
        ]}
      />
    </FormSection>

    <FormSection icon="scale" title="Weights">
      <DescriptionGrid
        items={[
          ['Casting Weight', kg(part.castingWeightKg, 2)],
          ['Machined Weight', kg(part.machinedWeightKg, 2)],
          ['Poured Weight', kg(part.pouredWeightKg, 2)],
          ['Machining Loss', kg(part.machiningLossKg, 2)],
          ['Yield', part.yieldPct != null ? pct(part.yieldPct) : '—'],
          ['Supply Condition', part.supplyCondition],
        ]}
      />
    </FormSection>

    <FormSection icon="architecture" title="Drawing & Customer Specification">
      <DescriptionGrid
        items={[
          ['Drawing No.', part.drawingNo ? <Mono>{part.drawingNo}</Mono> : null],
          ['Current Revision', part.currentRevision],
          ['Customer Specification', part.customerSpec],
          ['General Tolerance', part.generalTolerance],
          ['Surface Finish', part.surfaceFinish],
          ['Painting', part.painting],
        ]}
      />
    </FormSection>
  </Card>
);

const SpecificationsTab = ({ part }: { part: PartDetailDto }) => (
  <Card>
    <CardHead title="Inspection Characteristics">
      <Button icon="add">Add Characteristic</Button>
    </CardHead>
    {part.characteristics.length === 0 ? (
      <Empty
        icon="rule"
        title="No inspection characteristics yet"
        body="Add the chemical, mechanical and dimensional checks this part is verified against."
        action={<Button variant="primary" icon="add">Add Characteristic</Button>}
      />
    ) : (
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <th>Characteristic</th>
              <th>Specification</th>
              <th>Method</th>
              <th>Stage</th>
              <th>Frequency</th>
            </tr>
          </thead>
          <tbody>
            {part.characteristics.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td><b>{c.characteristic}</b></td>
                <td className="num">{c.specification}</td>
                <td>{c.method ?? '—'}</td>
                <td>{c.stage ?? '—'}</td>
                <td>{c.frequency ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

type RevisionRow = {
  id: string; revision: string; revisionDate: string; changeDescription: string;
  status: string; drawingNo: string; drawingId: string;
};

function DrawingsTab({ revisions }: { revisions: RevisionRow[] }) {
  const columns: Column<RevisionRow>[] = [
    { header: 'Drawing', cell: (r) => <MonoLink to={`/app/masters/drawings/${r.drawingId}`}>{r.drawingNo}</MonoLink> },
    { header: 'Rev', cell: (r) => <b>{r.revision}</b> },
    { header: 'Date', cell: (r) => shortDate(r.revisionDate) },
    { header: 'Change', cell: (r) => r.changeDescription },
    { header: 'Status', cell: (r) => <Badge status={r.status} /> },
  ];
  return (
    <Card>
      <DataTable
        columns={columns}
        rows={revisions}
        rowKey={(r) => r.id}
        rowHref={(r) => `/app/masters/drawings/${r.drawingId}`}
        selectable={false}
        empty={<Empty icon="architecture" title="No drawings linked" body="Register a drawing against this part to track its revisions." />}
      />
    </Card>
  );
}

function ToolingTab({ tools }: { tools: PartDetailDto['tools'] }) {
  const columns: Column<PartDetailDto['tools'][number]>[] = [
    { header: 'Tool Code', cell: (t) => <MonoLink to={`/app/masters/tooling/${t.id}`}>{t.code}</MonoLink> },
    { header: 'Type', cell: (t) => t.type },
    { header: 'Description', cell: (t) => t.description },
    {
      header: 'Life Used',
      cell: (t) => {
        const p = t.lifeShots > 0 ? Math.min(100, Math.round((t.usedShots / t.lifeShots) * 100)) : 0;
        const tone = p >= 100 ? 'var(--fg-3)' : p >= 85 ? 'var(--bad)' : p >= 60 ? 'var(--warn)' : 'var(--ok)';
        return <LifeBar pct={p} tone={tone} />;
      },
    },
    { header: 'Status', cell: (t) => <Badge status={t.status} /> },
  ];
  return (
    <Card>
      <DataTable
        columns={columns}
        rows={tools}
        rowKey={(t) => t.id}
        rowHref={(t) => `/app/masters/tooling/${t.id}`}
        selectable={false}
        empty={<Empty icon="handyman" title="No tooling linked" body="Link the pattern, core box or die used to make this part." />}
      />
    </Card>
  );
}

function CustomersTab({ mappings }: { mappings: PartDetailDto['mappings'] }) {
  const columns: Column<PartDetailDto['mappings'][number]>[] = [
    { header: 'Customer', cell: (m) => m.customer?.name ?? '—' },
    { header: 'Customer Part No', cell: (m) => <Mono>{m.customerPartNo}</Mono> },
    { header: 'Supply Condition', cell: (m) => m.supplyCondition ?? '—' },
    { header: 'Price', numeric: true, cell: (m) => rupees(m.pricePaise) },
    { header: 'Status', cell: (m) => <Badge status={m.status} /> },
  ];
  return (
    <Card>
      <DataTable
        columns={columns}
        rows={mappings}
        rowKey={(m) => m.id}
        rowHref={() => '/app/masters/mapping'}
        selectable={false}
        empty={
          <Empty
            icon="link"
            title="Not mapped to any customer yet"
            body="Map this part to a customer's own part number to quote and invoice against it."
            action={<Button variant="primary" icon="add" to="/app/masters/mapping">Add Mapping</Button>}
          />
        }
      />
    </Card>
  );
}

const AttachmentsTab = ({ part }: { part: PartDetailDto }) => (
  <Card bodyPadded>
    <Alert tone="info">
      File storage is wired to the attachments table; uploading is enabled once
      a storage target is configured.
    </Alert>
    <Dropzone hint="Drawings, method cards, sample reports · max 25 MB each" />
    <div className="files">
      {part.drawingNo ? (
        <FileRow
          name={`${part.drawingNo}_${(part.currentRevision ?? 'RevA').replace(/\s+/g, '')}.pdf`}
          meta="Current drawing"
          kind="PDF"
          tone="#c62828"
        />
      ) : (
        <div className="hint" style={{ padding: '12px 0' }}>
          <Ms name="info" /> No files attached yet.
        </div>
      )}
    </div>
  </Card>
);
