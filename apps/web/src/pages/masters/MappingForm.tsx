/**
 * Add / Edit a customer part mapping.
 *
 * Price is entered in rupees for the operator but stored in paise, so the
 * field is registered with a rupee<->paise transform rather than exposing the
 * integer representation in the UI.
 */
import { FormProvider } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  partMappingSchema, MAPPING_STATUS, SUPPLY_CONDITION, rupees, type PartMappingInput,
} from '@erp/shared';
import { api } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { useEntityForm } from '@/components/useEntityForm';
import {
  PageHeader, Card, Split, FormSection, FormGrid, Button, SectionTitle, Alert,
} from '@/components/ui';
import { TextField, SelectInput, FormActions } from '@/components/Field';

export function MappingForm() {
  const { id } = useParams();

  const { data: customers } = useQuery({
    queryKey: ['customer-options'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/customers/options'),
    staleTime: 5 * 60_000,
  });
  const { data: parts } = useQuery({
    queryKey: ['part-options'],
    queryFn: () => api.list<{ id: string; partNo: string; name: string }>('/masters/parts', { pageSize: 300 }),
    staleTime: 5 * 60_000,
  });

  const { form, existing, isEdit, saving, submit, cancel } = useEntityForm<PartMappingInput>({
    schema: partMappingSchema,
    path: '/masters/mappings',
    id,
    entityLabel: 'Mapping',
    invalidate: ['mappings'],
    defaultValues: { status: 'Mapped' } as never,
    toForm: (m) => ({
      customerId: m.customer?.id ?? '',
      partId: m.part?.id ?? '',
      customerPartNo: m.customerPartNo,
      drawingRef: m.drawingRef ?? '',
      pricePaise: m.pricePaise ?? undefined,
      supplyCondition: m.supplyCondition ?? undefined,
      status: m.status,
    }) as never,
    onSaved: () => '/app/masters/mapping',
  });

  useDocumentTitle(isEdit ? 'Edit Mapping' : 'Add Mapping');

  const pricePaise = form.watch('pricePaise');

  return (
    <FormProvider {...form}>
      <PageHeader
        crumbs={[
          { label: 'Products & Masters' },
          { label: 'Customer Part Mapping', to: '/app/masters/mapping' },
          { label: isEdit ? 'Edit' : 'Add Mapping' },
        ]}
        title={isEdit ? 'Edit Mapping' : 'Add Customer Part Mapping'}
        subtitle="Fields marked * are required"
      />

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <Split
          main={
            <Card>
              <FormSection icon="link" title="Mapping">
                <FormGrid>
                  <SelectInput<PartMappingInput>
                    name="customerId" label="Customer" required placeholder="Select customer"
                    options={(customers ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  />
                  <SelectInput<PartMappingInput>
                    name="partId" label="Our Part" required placeholder="Select part"
                    options={(parts?.rows ?? []).map((p) => ({ value: p.id, label: `${p.partNo} — ${p.name}` }))}
                  />
                  <TextField<PartMappingInput> name="customerPartNo" label="Customer Part No." required />
                  <TextField<PartMappingInput> name="drawingRef" label="Drawing / Rev" placeholder="ABC-DRG-4410 · C" />
                  <SelectInput<PartMappingInput>
                    name="supplyCondition" label="Supply Condition" options={SUPPLY_CONDITION} placeholder="Select condition"
                  />
                  <SelectInput<PartMappingInput> name="status" label="Status" options={MAPPING_STATUS} />
                </FormGrid>
              </FormSection>

              <FormSection icon="currency_rupee" title="Commercial">
                <FormGrid>
                  {/* Entered in rupees, stored in paise. The transform lives on
                      the field rather than in the submit handler so the value in
                      form state is always the stored representation. */}
                  <div className={`f ${form.formState.errors.pricePaise ? 'err' : ''}`}>
                    <label htmlFor="price-rupees">Agreed Price (₹ per piece)</label>
                    <input
                      id="price-rupees"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="2850.00"
                      {...form.register('pricePaise', {
                        setValueAs: (v: string) =>
                          v === '' || v == null ? undefined : Math.round(Number(v) * 100),
                      })}
                      defaultValue={
                        existing?.pricePaise != null ? String(existing.pricePaise / 100) : ''
                      }
                    />
                    <div className="hint">
                      {pricePaise != null && !Number.isNaN(Number(pricePaise))
                        ? `Stored as ${Number(pricePaise)} paise — displays as ${rupees(Number(pricePaise))}`
                        : 'Stored in paise to avoid rounding drift'}
                    </div>
                  </div>
                </FormGrid>
              </FormSection>

              <FormActions>
                <Button variant="ghost" type="button" onClick={cancel}>Cancel</Button>
                <Button variant="primary" icon="save" type="submit" loading={saving}>
                  {isEdit ? 'Save Changes' : 'Save Mapping'}
                </Button>
              </FormActions>
            </Card>
          }
          aside={
            <Card bodyPadded>
              <SectionTitle>One mapping per customer and part</SectionTitle>
              <Alert tone="info">
                Quotations and sales orders read the price and supply condition
                from here. Mapping the same part to the same customer twice is
                rejected — edit the existing mapping instead.
              </Alert>
            </Card>
          }
        />
      </form>
    </FormProvider>
  );
}
