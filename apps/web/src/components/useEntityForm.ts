/**
 * Shared wiring for the Masters create/edit forms: resolver, server-side
 * fieldError mapping, cache invalidation and navigation. Extracted because all
 * five forms need exactly the same behaviour and getting the error mapping
 * subtly different on each one would show up as inconsistent validation.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ZodType } from 'zod';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui';

export type EntityFormOptions<TValues extends FieldValues> = {
  /** Shared Zod schema — the same one the API validates against. */
  schema: ZodType<TValues, any, any>;
  /** Collection path, e.g. "/masters/alloys". */
  path: string;
  /** Record id when editing; undefined when creating. */
  id?: string;
  defaultValues: DefaultValues<TValues>;
  /** Maps the fetched record onto form values. */
  toForm: (record: Record<string, any>) => DefaultValues<TValues>;
  /** React Query keys to invalidate after a successful save. */
  invalidate: string[];
  /** Where to go after saving; receives the saved record. */
  onSaved: (record: Record<string, any>) => string;
  entityLabel: string;
};

export type EntityForm<TValues extends FieldValues> = {
  form: UseFormReturn<TValues>;
  existing: Record<string, any> | undefined;
  isEdit: boolean;
  isLoading: boolean;
  saving: boolean;
  submit: () => void;
  cancel: () => void;
};

export function useEntityForm<TValues extends FieldValues>(
  opts: EntityFormOptions<TValues>,
): EntityForm<TValues> {
  const { schema, path, id, defaultValues, toForm, invalidate, onSaved, entityLabel } = opts;
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TValues>({
    resolver: zodResolver(schema as never),
    defaultValues,
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: [path, id],
    queryFn: () => api.get<Record<string, any>>(`${path}/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) form.reset(toForm(existing));
    // `toForm` is defined inline by callers, so it is deliberately not a dep —
    // resetting should happen when the record arrives, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const save = useMutation({
    mutationFn: (values: TValues) =>
      isEdit
        ? api.patch<Record<string, any>>(`${path}/${id}`, values)
        : api.post<Record<string, any>>(path, values),
    onSuccess: (record) => {
      for (const key of invalidate) void queryClient.invalidateQueries({ queryKey: [key] });
      if (isEdit) void queryClient.invalidateQueries({ queryKey: [path, id] });
      toast(`${entityLabel} ${isEdit ? 'updated' : 'created'}`, 'ok');
      navigate(onSaved(record));
    },
    onError: (err) => {
      // Server field errors land on the matching inputs, so they render with
      // the same `.f.err` styling as client-side validation.
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          form.setError(field as Path<TValues>, { type: 'server', message });
        }
        toast(err.message, 'bad');
        return;
      }
      toast(err instanceof Error ? err.message : `Could not save the ${entityLabel.toLowerCase()}`, 'bad');
    },
  });

  return {
    form,
    existing,
    isEdit,
    isLoading,
    saving: save.isPending,
    submit: form.handleSubmit((v) => save.mutate(v)),
    cancel: () => navigate(path.replace(/^\//, '/app/')),
  };
}
