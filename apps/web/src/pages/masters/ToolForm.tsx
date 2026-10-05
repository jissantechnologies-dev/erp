/** Add / Edit pattern, die, core box or fixture — `P["tool-new"]`. */
import { FormProvider } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toolSchema, TOOL_TYPE, TOOL_STATUS, lifeBarTone, type ToolInput } from '@erp/shared';
import { api } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { useEntityForm } from '@/components/useEntityForm';
import {
  PageHeader, Card, Split, FormSection, FormGrid, Button, SectionTitle, Alert, LifeBar,
} from '@/components/ui';
import {
  TextField, NumberField, SelectInput, ReadOnlyField, FormActions,
} from '@/components/Field';

export function ToolForm() {
  const { id } = useParams();

  const { data: parts } = useQuery({
    queryKey: ['part-options'],
    queryFn: () => api.list<{ id: string; partNo: string; name: string }>('/masters/parts', { pageSize: 300 }),
    staleTime: 5 * 60_000,
  });

  const { form, existing, isEdit, saving, submit, cancel } = useEntityForm<ToolInput>({
    schema: toolSchema,
    path: '/masters/tools',
    id,
    entityLabel: 'Tool',
    invalidate: ['tools', 'tool-options'],
    defaultValues: { status: 'Available', cavities: 1, usedShots: 0 } as never,
    toForm: (t) => ({
      code: t.code,
      type: t.type,
      description: t.description,
      partId: t.part?.id ?? null,
      material: t.material ?? '',
      cavities: t.cavities,
      lifeShots: t.lifeShots,
      usedShots: t.usedShots,
      location: t.location ?? '',
      status: t.status,
      revision: t.revision ?? '',
    }) as never,
    onSaved: (t) => `/app/masters/tooling/${t.id}`,
  });

  useDocumentTitle(isEdit ? 'Edit Tool' : 'Add Tool');

  // Live preview of the life bar, so the consequence of the entered figures is
  // visible before saving.
  const life = lifeBarTone(Number(form.watch('usedShots')) || 0, Number(form.watch('lifeShots')) || 0);

  return (
    <FormProvider {...form}>
      <PageHeader
        crumbs={[
          { label: 'Products & Masters' },
          { label: 'Pattern / Die / Tool', to: '/app/masters/tooling' },
          { label: isEdit ? 'Edit' : 'Add Tool' },
        ]}
        title={isEdit ? `Edit ${existing?.code ?? 'Tool'}` : 'Add Pattern / Die / Tool'}
        subtitle="Fields marked * are required"
      />

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <Split
          main={
            <Card>
              <FormSection icon="handyman" title="Identification">
                <FormGrid>
                  <TextField<ToolInput> name="code" label="Tool Code" required placeholder="PAT-0123" />
                  <SelectInput<ToolInput> name="type" label="Type" required options={TOOL_TYPE} />
                  <SelectInput<ToolInput> name="status" label="Status" options={TOOL_STATUS} />
                  <TextField<ToolInput> name="description" label="Description" required span={2} placeholder="Pump Housing – 2 cavity match plate" />
                  <TextField<ToolInput> name="revision" label="Built to Revision" placeholder="Rev C" />
                </FormGrid>
              </FormSection>

              <FormSection icon="settings_input_component" title="Part & Construction">
                <FormGrid>
                  <SelectInput<ToolInput>
                    name="partId" label="Part"
                    placeholder="Select part"
                    options={(parts?.rows ?? []).map((p) => ({ value: p.id, label: `${p.partNo} — ${p.name}` }))}
                  />
                  <TextField<ToolInput> name="material" label="Tool Material" placeholder="Aluminium / Cast Iron / H13" />
                  <NumberField<ToolInput> name="cavities" label="Cavities" step="1" />
                </FormGrid>
              </FormSection>

              <FormSection icon="speed" title="Life">
                <FormGrid>
                  <NumberField<ToolInput>
                    name="lifeShots" label="Rated Life (shots)" required step="1"
                    help="Total shots the tool is rated for"
                  />
                  <NumberField<ToolInput>
                    name="usedShots" label="Shots Used" step="1"
                    help="Production postings add to this automatically"
                  />
                  <ReadOnlyField label="Life Consumed" value={`${life.pct} %`} />
                  <TextField<ToolInput> name="location" label="Location" span={3} placeholder="Pattern Store · Rack B-04" />
                </FormGrid>
              </FormSection>

              <FormActions>
                <Button variant="ghost" type="button" onClick={cancel}>Cancel</Button>
                <Button variant="primary" icon="save" type="submit" loading={saving}>
                  {isEdit ? 'Save Changes' : 'Save Tool'}
                </Button>
              </FormActions>
            </Card>
          }
          aside={
            <>
              <Card bodyPadded className="sum">
                <h2>Life Preview</h2>
                <LifeBar pct={life.pct} tone={life.tone} />
                <div className="kbd-note" style={{ marginTop: 10 }}>
                  Green under 60 %, amber from 60 %, red from 85 %, grey when
                  fully consumed — the same thresholds the register uses.
                </div>
              </Card>

              <Card bodyPadded>
                <SectionTitle>Automatic flagging</SectionTitle>
                <Alert tone="info">
                  Once 85 % of rated life is consumed, the tool is set to
                  <b> Maintenance Due</b> without anyone having to remember.
                </Alert>
              </Card>
            </>
          }
        />
      </form>
    </FormProvider>
  );
}
