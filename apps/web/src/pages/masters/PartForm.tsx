/**
 * Add / Edit Part. Field set, sections and order come from `partForm()` in the
 * prototype. Validation uses the same `partSchema` the API enforces, so a
 * field that passes here cannot fail server-side for a different reason — and
 * server-side fieldErrors are mapped back onto the same inputs.
 */
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  partSchema, PART_STATUS, PART_CATEGORY, CASTING_PROCESS, HEAT_TREATMENT,
  SUPPLY_CONDITION, UOM, yieldPct, type PartInput,
} from '@erp/shared';
import { api, ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import {
  PageHeader, Card, Split, FormSection, FormGrid, Button, Alert, SectionTitle,
  Timeline, Dropzone,
} from '@/components/ui';
import {
  TextField, NumberField, SelectInput, TextArea, ReadOnlyField, FormActions,
} from '@/components/Field';
import { useToast } from '@/components/ui';

type Option = { id: string; name: string; code?: string };

export function PartForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  useDocumentTitle(isEdit ? 'Edit Part' : 'Add Part');

  const { data: customers } = useQuery({
    queryKey: ['customer-options'],
    queryFn: () => api.get<Option[]>('/customers/options'),
    staleTime: 5 * 60_000,
  });
  const { data: alloys } = useQuery({
    queryKey: ['alloy-options'],
    queryFn: () => api.list<Option & { code: string }>('/masters/alloys', { pageSize: 200 }),
    staleTime: 5 * 60_000,
  });
  const { data: tools } = useQuery({
    queryKey: ['tool-options'],
    queryFn: () => api.list<{ id: string; code: string; description: string }>('/masters/tools', { pageSize: 200 }),
    staleTime: 5 * 60_000,
  });

  const { data: existing } = useQuery({
    queryKey: ['part', id],
    queryFn: () => api.get<Record<string, any>>(`/masters/parts/${id}`),
    enabled: isEdit,
  });

  const form = useForm<PartInput>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      status: 'Development',
      heatTreatment: 'None',
      uom: 'Nos',
    },
  });

  // Populate once the record arrives. `reset` rather than per-field setValue, so
  // the form's dirty state starts clean and Cancel is meaningful.
  useEffect(() => {
    if (!existing) return;
    form.reset({
      name: existing.name,
      category: existing.category ?? undefined,
      customerId: existing.customer?.id ?? '',
      customerPartNo: existing.customerPartNo,
      status: existing.status,
      alloyId: existing.alloy?.id ?? '',
      castingProcess: existing.castingProcess ?? undefined,
      heatTreatment: existing.heatTreatment ?? 'None',
      toolId: existing.primaryTool?.id ?? null,
      cavitiesPerMould: existing.cavitiesPerMould ?? undefined,
      coresPerCasting: existing.coresPerCasting ?? undefined,
      castingWeightKg: existing.castingWeightKg,
      machinedWeightKg: existing.machinedWeightKg ?? undefined,
      pouredWeightKg: existing.pouredWeightKg ?? undefined,
      uom: existing.uom,
      supplyCondition: existing.supplyCondition ?? undefined,
      drawingNo: existing.drawingNo ?? '',
      currentRevision: existing.currentRevision ?? '',
      customerSpec: existing.customerSpec ?? '',
      generalTolerance: existing.generalTolerance ?? '',
      surfaceFinish: existing.surfaceFinish ?? '',
      painting: existing.painting ?? '',
    });
  }, [existing, form]);

  // Yield is read-only and recalculates live, as in the design.
  const castingWeight = form.watch('castingWeightKg');
  const pouredWeight = form.watch('pouredWeightKg');
  const liveYield = useMemo(() => {
    const c = Number(castingWeight);
    const p = Number(pouredWeight);
    if (!c || !p) return '';
    const y = yieldPct(c, p);
    return y != null ? `${y.toFixed(1)} %` : '';
  }, [castingWeight, pouredWeight]);

  const save = useMutation({
    mutationFn: (values: PartInput) =>
      isEdit
        ? api.patch<{ id: string }>(`/masters/parts/${id}`, values)
        : api.post<{ id: string }>('/masters/parts', values),
    onSuccess: (part) => {
      void queryClient.invalidateQueries({ queryKey: ['parts'] });
      if (isEdit) void queryClient.invalidateQueries({ queryKey: ['part', id] });
      toast(isEdit ? 'Part updated' : 'Part created', 'ok');
      navigate(`/app/masters/parts/${part.id}`);
    },
    onError: (err) => {
      // Map the server's per-field messages onto the matching inputs so the
      // error appears where the user can fix it, not just in a toast.
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          form.setError(field as keyof PartInput, { type: 'server', message });
        }
        toast(err.message, 'bad');
        return;
      }
      toast(err instanceof Error ? err.message : 'Could not save the part', 'bad');
    },
  });

  const title = isEdit ? `Edit ${existing?.partNo ?? 'Part'}` : 'Add Part';

  return (
    <FormProvider {...form}>
      <PageHeader
        crumbs={[
          { label: 'Products & Masters' },
          { label: 'Part Master', to: '/app/masters/parts' },
          { label: isEdit ? 'Edit' : 'Add Part' },
        ]}
        title={title}
        subtitle="Fields marked * are required"
      />

      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <Split
          main={
            <Card>
              <FormSection icon="settings_input_component" title="Identification">
                <FormGrid>
                  <ReadOnlyField
                    label="Part Number"
                    value={existing?.partNo ?? 'Assigned on save'}
                    help="Assigned from the number series"
                  />
                  <TextField<PartInput> name="name" label="Part Name" required />
                  <SelectInput<PartInput> name="category" label="Part Category" options={PART_CATEGORY} placeholder="Select category" />

                  <SelectInput<PartInput>
                    name="customerId" label="Customer" required
                    placeholder="Select customer"
                    options={(customers ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  />
                  <TextField<PartInput> name="customerPartNo" label="Customer Part No." required />
                  <SelectInput<PartInput> name="status" label="Status" options={PART_STATUS} />
                </FormGrid>
              </FormSection>

              <FormSection icon="science" title="Material & Process">
                <FormGrid>
                  <SelectInput<PartInput>
                    name="alloyId" label="Alloy Grade" required
                    placeholder="Select grade"
                    options={(alloys?.rows ?? []).map((a) => ({ value: a.id, label: a.name }))}
                  />
                  <SelectInput<PartInput> name="castingProcess" label="Casting Process" options={CASTING_PROCESS} placeholder="Select process" />
                  <SelectInput<PartInput> name="heatTreatment" label="Heat Treatment" options={HEAT_TREATMENT} />

                  <SelectInput<PartInput>
                    name="toolId" label="Pattern / Die"
                    placeholder="Select tool"
                    options={(tools?.rows ?? []).map((t) => ({ value: t.id, label: `${t.code} — ${t.description}` }))}
                  />
                  <NumberField<PartInput> name="cavitiesPerMould" label="Cavities per Mould" step="1" />
                  <NumberField<PartInput> name="coresPerCasting" label="Cores per Casting" step="1" />
                </FormGrid>
              </FormSection>

              <FormSection icon="scale" title="Weights">
                <FormGrid>
                  <NumberField<PartInput> name="castingWeightKg" label="Casting Weight (kg)" required step="0.001" />
                  <NumberField<PartInput> name="machinedWeightKg" label="Machined Weight (kg)" step="0.001" />
                  <NumberField<PartInput>
                    name="pouredWeightKg" label="Bunch / Poured Weight (kg)" step="0.001"
                    help="Casting + gating + risers"
                  />
                  <ReadOnlyField
                    label="Yield (%)"
                    value={liveYield}
                    help="Casting ÷ poured weight"
                  />
                  <SelectInput<PartInput> name="uom" label="UOM" options={UOM} />
                  <SelectInput<PartInput> name="supplyCondition" label="Supply Condition" options={SUPPLY_CONDITION} placeholder="Select condition" />
                </FormGrid>
              </FormSection>

              <FormSection icon="architecture" title="Drawing & Customer Specification">
                <FormGrid>
                  <TextField<PartInput> name="drawingNo" label="Drawing No." />
                  <TextField<PartInput> name="currentRevision" label="Current Revision" placeholder="Rev A" />
                  <TextField<PartInput> name="generalTolerance" label="General Tolerance" placeholder="ISO 8062 CT9" />

                  <TextField<PartInput> name="surfaceFinish" label="Surface Finish" placeholder="Ra 3.2 on machined faces" />
                  <TextField<PartInput> name="painting" label="Painting" placeholder="Red oxide primer" />
                  <div />

                  <TextArea<PartInput>
                    name="customerSpec" label="Customer Specification" span={3} rows={2}
                    placeholder="Standards, pressure test, special requirements…"
                  />

                  <div className="span3">
                    <Dropzone hint="Drawing PDF, STEP model, customer specification" />
                  </div>
                </FormGrid>
              </FormSection>

              <FormActions>
                <Button variant="ghost" type="button" onClick={() => navigate('/app/masters/parts')}>
                  Cancel
                </Button>
                <Button variant="primary" icon="save" type="submit" loading={save.isPending}>
                  {isEdit ? 'Save Changes' : 'Save Part'}
                </Button>
              </FormActions>
            </Card>
          }
          aside={
            <>
              {!isEdit ? (
                <Card bodyPadded>
                  <SectionTitle>Tip</SectionTitle>
                  <Alert tone="info">
                    After saving, map the part to the customer's own part number
                    under <b>Customer Part Mapping</b> so quotations can price it.
                  </Alert>
                </Card>
              ) : null}

              <Card bodyPadded>
                <SectionTitle>What happens next</SectionTitle>
                <Timeline
                  items={[
                    { title: 'Part registered', detail: 'Masters', state: 'now' },
                    { title: 'Drawing revision uploaded', detail: 'Methods' },
                    { title: 'Tooling linked', detail: 'Pattern shop' },
                    { title: 'Customer mapping & price', detail: 'Sales' },
                  ]}
                />
              </Card>
            </>
          }
        />
      </form>
    </FormProvider>
  );
}
