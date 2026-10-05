/**
 * Add / Edit alloy grade — `P["alloy-new"]` in the prototype: grade identity,
 * the chemistry-limits table (min/max per element) and mechanical properties.
 */
import { FormProvider, useFieldArray } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import {
  alloySchema, MATERIAL_FAMILY, ALLOY_STATUS, type AlloyInput,
} from '@erp/shared';
import { useDocumentTitle } from '@/lib/hooks';
import { useEntityForm } from '@/components/useEntityForm';
import {
  PageHeader, Card, Split, FormSection, FormGrid, Button, Alert, SectionTitle, Ms,
} from '@/components/ui';
import { TextField, NumberField, SelectInput, FormActions } from '@/components/Field';

/** Elements the design pre-lists in the chemistry grid. */
const DEFAULT_ELEMENTS = ['C', 'Si', 'Mn', 'P', 'S', 'Mg', 'Cr', 'Ni', 'Mo', 'Cu'];

export function AlloyForm() {
  const { id } = useParams();

  const { form, existing, isEdit, saving, submit, cancel } = useEntityForm<AlloyInput>({
    schema: alloySchema,
    path: '/masters/alloys',
    id,
    entityLabel: 'Grade',
    invalidate: ['alloys', 'alloy-options'],
    defaultValues: {
      status: 'Pending Approval',
      chemistry: DEFAULT_ELEMENTS.map((element) => ({ element, min: undefined, max: undefined, remarks: '' })),
      mechanicalProperties: [],
    } as never,
    toForm: (a) => ({
      code: a.code,
      name: a.name,
      family: a.family,
      standard: a.standard ?? '',
      equivalentGrades: a.equivalentGrades ?? '',
      status: a.status,
      tensileStrengthMpa: a.tensileStrengthMpa ?? undefined,
      proofStressMpa: a.proofStressMpa ?? undefined,
      elongationPct: a.elongationPct ?? undefined,
      hardnessHb: a.hardnessHb ?? '',
      pouringTempC: a.pouringTempC ?? '',
      densityGCm3: a.densityGCm3 ?? undefined,
      // Keep whatever chemistry exists; fall back to the default element list
      // so a grade recorded without limits is still easy to fill in.
      chemistry: a.chemistry?.length
        ? a.chemistry.map((c: Record<string, any>) => ({
            element: c.element, min: c.min ?? undefined, max: c.max ?? undefined, remarks: c.remarks ?? '',
          }))
        : DEFAULT_ELEMENTS.map((element) => ({ element, min: undefined, max: undefined, remarks: '' })),
      mechanicalProperties: a.mechanicalProperties?.map((m: Record<string, any>) => ({
        property: m.property, requirement: m.requirement,
        testMethod: m.testMethod ?? '', testBar: m.testBar ?? '',
      })) ?? [],
    }) as never,
    onSaved: (a) => `/app/masters/alloys/${a.id}`,
  });

  const chemistry = useFieldArray({ control: form.control, name: 'chemistry' });
  const mechanical = useFieldArray({ control: form.control, name: 'mechanicalProperties' });

  useDocumentTitle(isEdit ? 'Edit Grade' : 'Add Grade');

  return (
    <FormProvider {...form}>
      <PageHeader
        crumbs={[
          { label: 'Products & Masters' },
          { label: 'Material / Alloy', to: '/app/masters/alloys' },
          { label: isEdit ? 'Edit' : 'Add Grade' },
        ]}
        title={isEdit ? `Edit ${existing?.code ?? 'Grade'}` : 'Add Grade'}
        subtitle="Fields marked * are required"
      />

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <Split
          main={
            <Card>
              <FormSection icon="science" title="Grade">
                <FormGrid>
                  <TextField<AlloyInput> name="code" label="Grade Code" required placeholder="e.g. SG500" />
                  <TextField<AlloyInput> name="name" label="Grade Name" required span={2} placeholder="e.g. SG Iron 500/7" />
                  <SelectInput<AlloyInput> name="family" label="Material Family" required options={MATERIAL_FAMILY} />
                  <TextField<AlloyInput> name="standard" label="Standard" placeholder="IS 1865 / ASTM A536" />
                  <TextField<AlloyInput> name="equivalentGrades" label="Equivalent Grades" placeholder="EN-GJS-500-7, 80-55-06" />
                  <SelectInput<AlloyInput> name="status" label="Status" options={ALLOY_STATUS} />
                </FormGrid>
              </FormSection>

              <FormSection icon="labs" title="Chemistry Limits (%)">
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>Element</th>
                        <th style={{ width: 120 }}>Min</th>
                        <th style={{ width: 120 }}>Max</th>
                        <th>Remarks</th>
                        <th style={{ width: 52 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {chemistry.fields.map((f, i) => (
                        <tr key={f.id}>
                          <td>
                            <div className="f">
                              <input aria-label={`Element ${i + 1}`} className="mono" {...form.register(`chemistry.${i}.element`)} />
                            </div>
                          </td>
                          <td>
                            <div className="f">
                              <input
                                type="number" step="any" placeholder="—" aria-label={`Min ${i + 1}`}
                                {...form.register(`chemistry.${i}.min`, {
                                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                                })}
                              />
                            </div>
                          </td>
                          <td>
                            <div className={`f ${form.formState.errors.chemistry?.[i]?.max ? 'err' : ''}`}>
                              <input
                                type="number" step="any" placeholder="—" aria-label={`Max ${i + 1}`}
                                {...form.register(`chemistry.${i}.max`, {
                                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                                })}
                              />
                              {form.formState.errors.chemistry?.[i]?.max ? (
                                <div className="hint" role="alert">
                                  {form.formState.errors.chemistry[i]?.max?.message}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="f">
                              <input aria-label={`Remarks ${i + 1}`} {...form.register(`chemistry.${i}.remarks`)} />
                            </div>
                          </td>
                          <td>
                            <button
                              type="button" className="icon-btn" onClick={() => chemistry.remove(i)}
                              aria-label={`Remove element row ${i + 1}`}
                            >
                              <Ms name="close" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card-b">
                  <Button
                    type="button" icon="add"
                    onClick={() => chemistry.append({ element: '', min: undefined, max: undefined, remarks: '' } as never)}
                  >
                    Add Element
                  </Button>
                  <div className="kbd-note" style={{ marginTop: 8 }}>
                    Leave both limits blank to skip an element. Rows with an empty
                    element name are rejected on save.
                  </div>
                </div>
              </FormSection>

              <FormSection icon="fitness_center" title="Mechanical Properties">
                <FormGrid>
                  <NumberField<AlloyInput> name="tensileStrengthMpa" label="Tensile Strength (MPa)" placeholder="min" />
                  <NumberField<AlloyInput> name="proofStressMpa" label="Proof Stress (MPa)" placeholder="min" />
                  <NumberField<AlloyInput> name="elongationPct" label="Elongation (%)" placeholder="min" />
                  <TextField<AlloyInput> name="hardnessHb" label="Hardness (HB)" placeholder="170 – 230" />
                  <TextField<AlloyInput> name="pouringTempC" label="Pouring Temperature (°C)" placeholder="1,380 – 1,420" />
                  <NumberField<AlloyInput> name="densityGCm3" label="Density (g/cm³)" step="0.001" />
                </FormGrid>

                {mechanical.fields.length > 0 ? (
                  <div className="tbl-wrap" style={{ marginTop: 12 }}>
                    <table className="tbl">
                      <thead>
                        <tr><th>Property</th><th>Requirement</th><th>Test Method</th><th>Test Bar</th><th style={{ width: 52 }} /></tr>
                      </thead>
                      <tbody>
                        {mechanical.fields.map((f, i) => (
                          <tr key={f.id}>
                            <td><div className="f"><input aria-label={`Property ${i + 1}`} {...form.register(`mechanicalProperties.${i}.property`)} /></div></td>
                            <td><div className="f"><input aria-label={`Requirement ${i + 1}`} {...form.register(`mechanicalProperties.${i}.requirement`)} /></div></td>
                            <td><div className="f"><input aria-label={`Test method ${i + 1}`} {...form.register(`mechanicalProperties.${i}.testMethod`)} /></div></td>
                            <td><div className="f"><input aria-label={`Test bar ${i + 1}`} {...form.register(`mechanicalProperties.${i}.testBar`)} /></div></td>
                            <td>
                              <button type="button" className="icon-btn" onClick={() => mechanical.remove(i)} aria-label={`Remove property ${i + 1}`}>
                                <Ms name="close" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <div className="card-b">
                  <Button
                    type="button" icon="add"
                    onClick={() => mechanical.append({ property: '', requirement: '', testMethod: '', testBar: '' } as never)}
                  >
                    Add Property Row
                  </Button>
                </div>
              </FormSection>

              <FormActions>
                <Button variant="ghost" type="button" onClick={cancel}>Cancel</Button>
                <Button variant="primary" icon="save" type="submit" loading={saving}>
                  {isEdit ? 'Save Changes' : 'Save Grade'}
                </Button>
              </FormActions>
            </Card>
          }
          aside={
            <Card bodyPadded>
              <SectionTitle>Why the limits matter</SectionTitle>
              <Alert tone="info">
                Quality checks every heat against these chemistry and mechanical
                limits, and the charge guide on the grade's detail page is what
                Melting works to. A grade saved without limits can be selected on
                a part but cannot be verified.
              </Alert>
            </Card>
          }
        />
      </form>
    </FormProvider>
  );
}
