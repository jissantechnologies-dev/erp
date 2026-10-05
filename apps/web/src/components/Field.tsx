/**
 * Form fields, wired to react-hook-form but emitting the prototype's `fld()`
 * markup: `.f` wrapper, `.req` asterisk, `.hint` helper text and the `.err`
 * state that design-system.css already styles.
 *
 * Every field reads its error from the form context, so a server-side
 * fieldErrors response dropped in via `setError` lights up the same styling as
 * client-side Zod validation — one appearance for both.
 */
import { useId, type ReactNode } from 'react';
import { useFormContext, type FieldValues, type Path } from 'react-hook-form';

type Common<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
  /** Grid span, matching the design's `.span2` / `.span3`. */
  span?: 2 | 3;
  readOnly?: boolean;
  disabled?: boolean;
};

function useFieldState<T extends FieldValues>(name: Path<T>) {
  const { formState: { errors } } = useFormContext<T>();
  // Supports nested paths ("contact.email") the way RHF reports them.
  const error = name
    .split('.')
    .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], errors);
  const message = (error as { message?: string } | undefined)?.message;
  return { message };
}

const Wrapper = ({
  id, label, required, help, message, span, children,
}: {
  id: string; label: string; required?: boolean; help?: string;
  message?: string; span?: 2 | 3; children: ReactNode;
}) => (
  <div className={`f ${span ? `span${span}` : ''} ${message ? 'err' : ''}`}>
    <label htmlFor={id}>
      {label}
      {required ? <span className="req"> *</span> : null}
    </label>
    {children}
    {/* The error replaces the hint rather than stacking, as in the design. */}
    {message ? (
      <div className="hint" role="alert">{message}</div>
    ) : help ? (
      <div className="hint">{help}</div>
    ) : null}
  </div>
);

/* --------------------------------- Text ---------------------------------- */

export function TextField<T extends FieldValues>({
  name, label, required, help, placeholder, span, readOnly, disabled,
  type = 'text', inputMode,
}: Common<T> & { type?: string; inputMode?: 'numeric' | 'decimal' | 'tel' | 'email' }) {
  const id = useId();
  const { register } = useFormContext<T>();
  const { message } = useFieldState<T>(name);
  return (
    <Wrapper id={id} label={label} required={required} help={help} message={message} span={span}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={message ? true : undefined}
        {...register(name)}
      />
    </Wrapper>
  );
}

/* -------------------------------- Number --------------------------------- */

/**
 * Numeric input. Registered with `valueAsNumber` so the shared Zod schema
 * receives a number rather than a string, and empty clears to undefined
 * instead of coercing to 0.
 */
export function NumberField<T extends FieldValues>({
  name, label, required, help, placeholder, span, readOnly, disabled, step,
}: Common<T> & { step?: string }) {
  const id = useId();
  const { register } = useFormContext<T>();
  const { message } = useFieldState<T>(name);
  return (
    <Wrapper id={id} label={label} required={required} help={help} message={message} span={span}>
      <input
        id={id}
        type="number"
        step={step ?? 'any'}
        inputMode="decimal"
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={message ? true : undefined}
        {...register(name, {
          setValueAs: (v: string) => (v === '' || v == null ? undefined : Number(v)),
        })}
      />
    </Wrapper>
  );
}

/* -------------------------------- Select --------------------------------- */

export type Option = { value: string; label: string };

export function SelectInput<T extends FieldValues>({
  name, label, required, help, span, disabled, options, placeholder = 'Select…',
}: Common<T> & { options: readonly Option[] | readonly string[]; }) {
  const id = useId();
  const { register } = useFormContext<T>();
  const { message } = useFieldState<T>(name);
  const opts: Option[] = (options as readonly (Option | string)[]).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
  return (
    <Wrapper id={id} label={label} required={required} help={help} message={message} span={span}>
      <select
        id={id}
        disabled={disabled}
        aria-invalid={message ? true : undefined}
        {...register(name)}
        defaultValue=""
      >
        <option value="" disabled={required}>{placeholder}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Wrapper>
  );
}

/* ------------------------------- Textarea -------------------------------- */

export function TextArea<T extends FieldValues>({
  name, label, required, help, placeholder, span = 3, rows = 3, disabled,
}: Common<T> & { rows?: number }) {
  const id = useId();
  const { register } = useFormContext<T>();
  const { message } = useFieldState<T>(name);
  return (
    <Wrapper id={id} label={label} required={required} help={help} message={message} span={span}>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={message ? true : undefined}
        {...register(name)}
      />
    </Wrapper>
  );
}

/* --------------------------- Read-only display --------------------------- */

/** For server-assigned values ("IF-XX-0000 (auto)") and derived ones (Yield %). */
export const ReadOnlyField = ({
  label, value, help, span,
}: { label: string; value: ReactNode; help?: string; span?: 2 | 3 }) => {
  const id = useId();
  return (
    <div className={`f ${span ? `span${span}` : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} readOnly tabIndex={-1} />
      {help ? <div className="hint">{help}</div> : null}
    </div>
  );
};

/** Row of Cancel / Save buttons at the foot of a form. */
export const FormActions = ({ children }: { children: ReactNode }) => (
  <div className="form-actions">{children}</div>
);
