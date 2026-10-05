/**
 * Drawing detail — revision history with the approve action, and a form to add
 * a new revision (which supersedes the current one server-side).
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shortDate } from '@erp/shared';
import { api, ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import {
  PageHeader, Card, CardHead, Split, Badge, Button, Mono,
  SummaryGrid, SectionTitle, Empty, Alert, Timeline, useToast, Dropzone,
} from '@/components/ui';

type Revision = {
  id: string; revision: string; revisionDate: string;
  changeDescription: string; status: string; owner: string | null; approvedAt: string | null;
};
type DrawingDto = {
  id: string; drawingNo: string;
  part: { id: string; partNo: string; name: string } | null;
  customer: { id: string; name: string } | null;
  currentRevision: string | null; revisionDate: string | null;
  latestChange: string | null; status: string | null;
  owner: string | null; revisionCount: number;
  revisions: Revision[];
};

export function DrawingDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [rev, setRev] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [change, setChange] = useState('');

  const { data: drawing, isLoading } = useQuery({
    queryKey: ['drawing', id],
    queryFn: () => api.get<DrawingDto>(`/masters/drawings/${id}`),
  });

  useDocumentTitle(drawing?.drawingNo ?? 'Drawing');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['drawing', id] });
    void queryClient.invalidateQueries({ queryKey: ['drawings'] });
    void queryClient.invalidateQueries({ queryKey: ['parts'] });
  };

  const addRevision = useMutation({
    mutationFn: () =>
      api.post(`/masters/drawings/${id}/revisions`, {
        revision: rev,
        revisionDate: date,
        changeDescription: change,
        status: 'Pending Approval',
      }),
    onSuccess: () => {
      invalidate();
      setAdding(false); setRev(''); setChange('');
      toast('Revision added — previous revision superseded', 'ok');
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : 'Could not add the revision', 'bad'),
  });

  const approve = useMutation({
    mutationFn: (revisionId: string) =>
      api.post(`/masters/drawings/${id}/revisions/${revisionId}/approve`),
    onSuccess: () => {
      invalidate();
      toast('Revision released — part returned to Released', 'ok');
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : 'Could not approve', 'bad'),
  });

  const crumbs = [
    { label: 'Products & Masters' },
    { label: 'Drawing Revision', to: '/app/masters/drawings' },
    { label: drawing?.drawingNo ?? '…' },
  ];

  if (isLoading) {
    return (
      <>
        <PageHeader crumbs={crumbs} title={<span className="skel" style={{ width: 220, height: 28, display: 'inline-block' }} />} />
        <Card bodyPadded>
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="skel" style={{ marginBottom: 12 }} />)}
        </Card>
      </>
    );
  }

  if (!drawing) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Drawing not found" />
        <Card>
          <Empty icon="search_off" title="We could not find that drawing"
            action={<Button variant="primary" to="/app/masters/drawings">Back to drawings</Button>} />
        </Card>
      </>
    );
  }

  const pending = drawing.revisions.find((r) => r.status === 'Pending Approval');

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={drawing.drawingNo}
        subtitle={`${drawing.part?.name ?? '—'} · ${drawing.customer?.name ?? '—'}`}
        actions={
          <>
            {pending ? (
              <Button
                icon="verified" loading={approve.isPending}
                onClick={() => approve.mutate(pending.id)}
              >
                Approve Rev {pending.revision}
              </Button>
            ) : null}
            <Button variant="primary" icon="upload_file" onClick={() => setAdding((a) => !a)}>
              {adding ? 'Close' : 'Add Revision'}
            </Button>
          </>
        }
      />

      <Split
        main={
          <>
            {adding ? (
              <Card>
                <CardHead title="Add Revision" />
                <div className="card-b">
                  <Alert tone="warn" title="This supersedes the current revision">
                    Rev {drawing.currentRevision} will be marked Superseded and the
                    part set to Under Revision until the new revision is approved.
                  </Alert>
                  <div className="form-grid" style={{ marginTop: 14 }}>
                    <div className="f">
                      <label htmlFor="rev">Revision <span className="req">*</span></label>
                      <input id="rev" value={rev} onChange={(e) => setRev(e.target.value)} placeholder="D" />
                    </div>
                    <div className="f">
                      <label htmlFor="revdate">Revision Date <span className="req">*</span></label>
                      <input id="revdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="f span3">
                      <label htmlFor="change">Change Description <span className="req">*</span></label>
                      <textarea id="change" rows={2} value={change} onChange={(e) => setChange(e.target.value)}
                        placeholder="Boss added on flange side" />
                    </div>
                    <div className="span3">
                      <Dropzone hint="Revised drawing PDF or STEP model" />
                    </div>
                  </div>
                  <div className="form-actions">
                    <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                    <Button
                      variant="primary" icon="save" loading={addRevision.isPending}
                      disabled={!rev.trim() || !change.trim()}
                      onClick={() => addRevision.mutate()}
                    >
                      Add Revision
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            <Card>
              <CardHead title={`Revision History (${drawing.revisionCount})`} />
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Rev</th><th>Date</th><th>Change</th>
                      <th>Owner</th><th>Status</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {drawing.revisions.map((r) => (
                      <tr key={r.id}>
                        <td><b style={{ fontSize: 15 }}>{r.revision}</b></td>
                        <td>{shortDate(r.revisionDate)}</td>
                        <td>{r.changeDescription}</td>
                        <td>{r.owner ?? '—'}</td>
                        <td><Badge status={r.status} /></td>
                        <td className="r">
                          {r.status === 'Pending Approval' || r.status === 'Under Revision' ? (
                            <Button
                              icon="verified" loading={approve.isPending}
                              onClick={() => approve.mutate(r.id)}
                            >
                              Approve
                            </Button>
                          ) : r.approvedAt ? (
                            <span className="kbd-note">Released {shortDate(r.approvedAt)}</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        }
        aside={
          <>
            <Card bodyPadded className="sum">
              <h2>Drawing Summary</h2>
              <SummaryGrid
                items={[
                  ['Drawing', <Mono>{drawing.drawingNo}</Mono>],
                  ['Current rev', drawing.currentRevision ?? '—'],
                  ['Status', <Badge status={drawing.status} />],
                  ['Revisions', drawing.revisionCount],
                  ['Rev date', shortDate(drawing.revisionDate)],
                  ['Owner', drawing.owner ?? '—'],
                ]}
              />
            </Card>

            <Card bodyPadded>
              <SectionTitle>Part</SectionTitle>
              {drawing.part ? (
                <>
                  <div style={{ fontWeight: 500, fontSize: 15 }}>{drawing.part.name}</div>
                  <div className="kbd-note" style={{ margin: '2px 0 10px' }}>{drawing.part.partNo}</div>
                  <Button icon="open_in_new" to={`/app/masters/parts/${drawing.part.id}`}>Open Part</Button>
                </>
              ) : <div className="hint">No part linked</div>}
            </Card>

            <Card bodyPadded>
              <SectionTitle>Revision lifecycle</SectionTitle>
              <Timeline
                items={[
                  { title: 'Revision received', detail: 'Sales / Methods', state: 'done' },
                  {
                    title: 'Pending approval',
                    detail: 'Methods & Quality',
                    state: pending ? 'now' : 'done',
                  },
                  { title: 'Released to production', detail: 'Part set to Released' },
                  { title: 'Tooling updated', detail: 'Pattern shop' },
                ]}
              />
            </Card>
          </>
        }
      />
    </>
  );
}
