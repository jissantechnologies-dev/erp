/** Tool detail — life tracking with a shots-posting action. */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nf } from '@erp/shared';
import { api, ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import {
  PageHeader, Card, CardHead, Split, Badge, Button, Mono, MonoLink,
  DescriptionGrid, SummaryGrid, FormSection, SectionTitle, Empty, LifeBar,
  Alert, useToast,
} from '@/components/ui';

type ToolDto = {
  id: string; code: string; type: string; description: string;
  part: { id: string; partNo: string; name: string } | null;
  material: string | null; cavities: number;
  lifeShots: number; usedShots: number; lifeUsedPct: number; lifeTone: string;
  remainingShots: number; location: string | null; status: string; revision: string | null;
};

export function ToolDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [shots, setShots] = useState('');

  const { data: tool, isLoading } = useQuery({
    queryKey: ['tool', id],
    queryFn: () => api.get<ToolDto>(`/masters/tools/${id}`),
  });

  useDocumentTitle(tool?.code ?? 'Tool');

  const post = useMutation({
    mutationFn: (n: number) => api.post<ToolDto>(`/masters/tools/${id}/shots`, { shots: n }),
    onSuccess: (t) => {
      void queryClient.invalidateQueries({ queryKey: ['tool', id] });
      void queryClient.invalidateQueries({ queryKey: ['tools'] });
      setShots('');
      toast(`Recorded — now ${t.lifeUsedPct}% of rated life (${t.status})`, 'ok');
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : 'Could not record shots', 'bad'),
  });

  const crumbs = [
    { label: 'Products & Masters' },
    { label: 'Pattern / Die / Tool', to: '/app/masters/tooling' },
    { label: tool?.code ?? '…' },
  ];

  if (isLoading) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={<span className="skel" style={{ width: 200, height: 28, display: 'inline-block' }} />} />
        <Card bodyPadded>
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="skel" style={{ marginBottom: 12 }} />)}
        </Card>
      </>
    );
  }

  if (!tool) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Tool not found" />
        <Card>
          <Empty icon="search_off" title="We could not find that tool"
            action={<Button variant="primary" to="/app/masters/tooling">Back to tooling</Button>} />
        </Card>
      </>
    );
  }

  const scrapped = tool.status === 'Scrapped';

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={<>{tool.description}{' '}<span className="mono" style={{ fontSize: 20, color: 'var(--fg-3)' }}>{tool.code}</span></>}
        subtitle={`${tool.type}${tool.part ? ` · ${tool.part.name}` : ''}`}
        actions={<Button icon="edit" to={`/app/masters/tooling/${tool.id}/edit`}>Edit Tool</Button>}
      />

      <Split
        main={
          <>
            <Card>
              <FormSection icon="handyman" title="Identification">
                <DescriptionGrid
                  items={[
                    ['Tool Code', <Mono>{tool.code}</Mono>],
                    ['Type', tool.type],
                    ['Status', <Badge status={tool.status} />],
                    ['Description', tool.description],
                    [
                      'Part',
                      tool.part
                        ? <MonoLink to={`/app/masters/parts/${tool.part.id}`}>{tool.part.partNo}</MonoLink>
                        : null,
                    ],
                    ['Built to Revision', tool.revision],
                  ]}
                />
              </FormSection>

              <FormSection icon="construction" title="Construction & Location">
                <DescriptionGrid
                  items={[
                    ['Tool Material', tool.material],
                    ['Cavities', tool.cavities],
                    ['Location', tool.location],
                  ]}
                />
              </FormSection>

              <FormSection icon="speed" title="Life">
                <DescriptionGrid
                  items={[
                    ['Rated Life', `${nf.format(tool.lifeShots)} shots`],
                    ['Shots Used', nf.format(tool.usedShots)],
                    ['Remaining', nf.format(tool.remainingShots)],
                    ['Consumed', `${tool.lifeUsedPct} %`],
                  ]}
                />
              </FormSection>
            </Card>

            <Card>
              <CardHead title="Record Shots" />
              <div className="card-b">
                {scrapped ? (
                  <Alert tone="bad" title="This tool is scrapped">
                    Further shots cannot be recorded against it.
                  </Alert>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="f" style={{ maxWidth: 220 }}>
                        <label htmlFor="shots">Shots produced</label>
                        <input
                          id="shots" type="number" min="1" step="1" inputMode="numeric"
                          value={shots} onChange={(e) => setShots(e.target.value)}
                          placeholder="e.g. 250"
                        />
                      </div>
                      <Button
                        variant="primary" icon="add_task"
                        loading={post.isPending}
                        disabled={!shots || Number(shots) <= 0}
                        onClick={() => post.mutate(Number(shots))}
                      >
                        Record
                      </Button>
                    </div>
                    <div className="kbd-note" style={{ marginTop: 8 }}>
                      Posting shots here stands in for the Production module.
                      Crossing 85 % of rated life sets the tool to Maintenance Due.
                    </div>
                  </>
                )}
              </div>
            </Card>
          </>
        }
        aside={
          <>
            <Card bodyPadded className="sum">
              <h2>Life</h2>
              <LifeBar pct={tool.lifeUsedPct} tone={tool.lifeTone} />
              <div style={{ marginTop: 14 }}>
                <SummaryGrid
                  items={[
                    ['Status', <Badge status={tool.status} />],
                    ['Used', nf.format(tool.usedShots)],
                    ['Remaining', nf.format(tool.remainingShots)],
                    ['Cavities', tool.cavities],
                  ]}
                />
              </div>
            </Card>

            {tool.lifeUsedPct >= 85 && !scrapped ? (
              <Card bodyPadded>
                <SectionTitle>Attention</SectionTitle>
                <Alert tone="warn" title="Past 85 % of rated life">
                  Schedule maintenance before the next run, or the castings risk
                  dimensional drift.
                </Alert>
              </Card>
            ) : null}
          </>
        }
      />
    </>
  );
}
