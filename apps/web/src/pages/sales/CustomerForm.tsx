/** Add / Edit customer — `P["customer-new"]`: basic details plus primary contact. */
import { FormProvider } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { customerSchema, CUSTOMER_STATUS, type CustomerInput } from '@erp/shared';
import { useDocumentTitle } from '@/lib/hooks';
import { useEntityForm } from '@/components/useEntityForm';
import {
  PageHeader, Card, Split, FormSection, FormGrid, Button, SectionTitle, Alert, Timeline,
} from '@/components/ui';
import { TextField, SelectInput, ReadOnlyField, FormActions } from '@/components/Field';

/** States the seeded customers sit in; free text is still accepted. */
const STATES = [
  'Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana',
  'Maharashtra', 'Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Delhi',
  'Punjab', 'Haryana', 'West Bengal', 'Odisha', 'Uttar Pradesh',
];

export function CustomerForm() {
  const { id } = useParams();

  const { form, existing, isEdit, saving, submit, cancel } = useEntityForm<CustomerInput>({
    schema: customerSchema,
    path: '/customers',
    id,
    entityLabel: 'Customer',
    invalidate: ['customers', 'customer-options'],
    defaultValues: { status: 'Prospect' } as never,
    toForm: (c) => ({
      name: c.name,
      city: c.city ?? '',
      state: c.state ?? '',
      industry: c.industry ?? '',
      gstin: c.gstin ?? '',
      status: c.status,
      contact: c.contact
        ? {
            name: c.contact.name,
            designation: c.contact.designation ?? '',
            phone: c.contact.phone ?? '',
            email: c.contact.email ?? '',
          }
        : undefined,
    }) as never,
    onSaved: (c) => `/app/sales/customers/${c.id}`,
  });

  useDocumentTitle(isEdit ? 'Edit Customer' : 'Add Customer');

  return (
    <FormProvider {...form}>
      <PageHeader
        crumbs={[
          { label: 'Sales' },
          { label: 'Customers', to: '/app/sales/customers' },
          { label: isEdit ? 'Edit' : 'Add Customer' },
        ]}
        title={isEdit ? `Edit ${existing?.name ?? 'Customer'}` : 'Add Customer'}
        subtitle="Basic details and the primary contact. Fields marked * are required"
      />

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <Split
          main={
            <Card>
              <FormSection icon="storefront" title="Customer">
                <FormGrid>
                  <ReadOnlyField
                    label="Customer Code"
                    value={existing?.code ?? 'Assigned on save'}
                    help="Assigned from the number series"
                  />
                  <TextField<CustomerInput> name="name" label="Customer Name" required span={2} />
                  <TextField<CustomerInput> name="industry" label="Industry" placeholder="Industrial Pumps" />
                  <TextField<CustomerInput> name="city" label="City" />
                  <SelectInput<CustomerInput> name="state" label="State" options={STATES} placeholder="Select state" />
                  <TextField<CustomerInput>
                    name="gstin" label="GSTIN" placeholder="33ABCDE1234F1Z5"
                    help="15 characters; leave blank for prospects"
                  />
                  <SelectInput<CustomerInput> name="status" label="Status" options={CUSTOMER_STATUS} />
                </FormGrid>
              </FormSection>

              <FormSection icon="contact_phone" title="Primary Contact">
                <FormGrid>
                  <TextField<CustomerInput> name="contact.name" label="Contact Person" />
                  <TextField<CustomerInput> name="contact.designation" label="Designation" placeholder="Purchase Manager" />
                  <TextField<CustomerInput> name="contact.phone" label="Mobile" placeholder="+91 98400 12345" />
                  <TextField<CustomerInput> name="contact.email" label="Email" type="email" inputMode="email" placeholder="name@company.com" span={2} />
                </FormGrid>
              </FormSection>

              <FormActions>
                <Button variant="ghost" type="button" onClick={cancel}>Cancel</Button>
                <Button variant="primary" icon="save" type="submit" loading={saving}>
                  {isEdit ? 'Save Changes' : 'Save Customer'}
                </Button>
              </FormActions>
            </Card>
          }
          aside={
            <>
              <Card bodyPadded>
                <SectionTitle>Tip</SectionTitle>
                <Alert tone="info">
                  Only the contact's name is needed to save; the rest can follow.
                  Further contacts are added from the customer's detail page.
                </Alert>
              </Card>

              <Card bodyPadded>
                <SectionTitle>What happens next</SectionTitle>
                <Timeline
                  items={[
                    { title: 'Customer registered', detail: 'Sales', state: 'now' },
                    { title: 'Parts mapped to their part numbers', detail: 'Masters' },
                    { title: 'Enquiry received', detail: 'Sales' },
                    { title: 'Quotation issued', detail: 'Sales & Costing' },
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
