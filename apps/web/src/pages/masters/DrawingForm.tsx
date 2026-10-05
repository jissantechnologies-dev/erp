/**
 * Register a drawing with its first revision. The design reaches this through
 * "Upload Revision"; adding a revision to an *existing* drawing is done from
 * that drawing's detail page, which posts to /revisions.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { DRAWING_STATUS, req } from '@erp/shared';
import { api, ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import {
  PageHeader, Card, Split, FormSection, FormGrid, Button, SectionTitle, Alert,
  Dropzone, useToast,
} from '@/components/ui';
import { TextField, SelectInput, TextArea, FormActions } from '@/components/Field';

/**
 * Combines the drawing identity and its first revision into one form, which is
 * how the design presents it. The API takes the revision nested under
 * `firstRevision`, so submit reshapes it.
 */
const formSchema = z.object({
  drawingNo: req('Drawing No.', 80),
  partId: req('Part'),
  customerId: req('Customer'),
  revision: req('Revision', 16),
  revisionDate: req('Revision Date', 20),
  changeDescription: req('Change Description', 400),
  status: z.enum(DRAWING_STATUS).default('Pending Approval'),
});
type FormValues = z.infer<typeof formSchema>;

export function DrawingForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<string[]>([]);

  useDocumentTitle('Upload Drawing Revision');

  const { data: customers } = useQuery({
    queryKey: ['customer-options'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/customers/options'),
    staleTime: 5 * 60_000,
  });
  const { data: parts } = useQuery({
    queryKey: ['part-options'],
    queryFn: () =>
      api.list<{ id: string; partNo: string; name: string; customer: { id: string } | null }>(
        '/masters/parts', { pageSize: 300 },
      ),
    staleTime: 5 * 60_000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      revision: 'A',
      revisionDate: new Date().toISOString().slice(0, 10),
      changeDescription: 'First issue',
      status: 'Pending Approval',
    },
  });

  // Selecting a part implies its customer, so the customer field is filled in
  // rather than left for the user to get wrong.
  const partId = form.watch('partId');
  const selectedPart = parts?.rows.find((p) => p.id === partId);
  if (selectedPart?.customer?.id && form.getValues('customerId') !== selectedPart.customer.id) {
    form.setValue('customerId', selectedPart.customer.id);
  }

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      api.post<{ id: string }>('/masters/drawings', {
        drawingNo: v.drawingNo,
        partId: v.partId,
        customerId: v.customerId,
        firstRevision: {
          revision: v.revision,
          revisionDate: v.revisionDate,
          changeDescription: v.changeDescription,
          status: v.status,
        },
      }),
    onSuccess: (d) => {
      void queryClient.invalidateQueries({ queryKey: ['drawings'] });
      void queryClient.invalidateQueries({ queryKey: ['parts'] });
      toast('Drawing registered', 'ok');
      navigate(`/app/masters/drawings/${d.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          form.setError(field as keyof FormValues, { type: 'server', message });
        }
        toast(err.message, 'bad');
        return;
      }
      toast(err instanceof Error ? err.message : 'Could not register the drawing', 'bad');
    },
  });

  return (
    <FormProvider {...form}>
      <PageHeader
        crumbs={[
          { label: 'Products & Masters' },
          { label: 'Drawing Revision', to: '/app/masters/drawings' },
          { label: 'Register Drawing' },
        ]}
        title="Register Drawing"
        subtitle="Creates the drawing and its first revision. Fields marked * are required"
      />

      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <Split
          main={
            <Card>
              <FormSection icon="architecture" title="Drawing">
                <FormGrid>
                  <TextField<FormValues> name="drawingNo" label="Drawing No." required placeholder="ABC-DRG-4410" />
                  <SelectInput<FormValues>
                    name="partId" label="Part" required placeholder="Select part"
                    options={(parts?.rows ?? []).map((p) => ({ value: p.id, label: `${p.partNo} — ${p.name}` }))}
                  />
                  <SelectInput<FormValues>
                    name="customerId" label="Customer" required placeholder="Select customer"
                    options={(customers ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  />
                </FormGrid>
              </FormSection>

              <FormSection icon="history_edu" title="First Revision">
                <FormGrid>
                  <TextField<FormValues> name="revision" label="Revision" required placeholder="A" />
                  <TextField<FormValues> name="revisionDate" label="Revision Date" required type="date" />
                  <SelectInput<FormValues> name="status" label="Status" options={DRAWING_STATUS} />
                  <TextArea<FormValues>
                    name="changeDescription" label="Change Description" required span={3} rows={2}
                    placeholder="First issue / Boss added on flange side"
                  />
                  <div className="span3">
                    <Dropzone
                      hint="Drawing PDF, STEP model, customer specification"
                      onFiles={(f) => setFiles([...f].map((x) => x.name))}
                    />
                    {files.length ? (
                      <div className="kbd-note" style={{ marginTop: 8 }}>
                        Selected: {files.join(', ')} — upload is enabled once a
                        storage target is configured.
                      </div>
                    ) : null}
                  </div>
                </FormGrid>
              </FormSection>

              <FormActions>
                <Button variant="ghost" type="button" onClick={() => navigate('/app/masters/drawings')}>
                  Cancel
                </Button>
                <Button variant="primary" icon="save" type="submit" loading={save.isPending}>
                  Register Drawing
                </Button>
              </FormActions>
            </Card>
          }
          aside={
            <Card bodyPadded>
              <SectionTitle>Revision control</SectionTitle>
              <Alert tone="info">
                Revisions are append-only. Adding a later revision supersedes the
                current one automatically and sets the part to Under Revision
                until the new revision is approved.
              </Alert>
            </Card>
          }
        />
      </form>
    </FormProvider>
  );
}
